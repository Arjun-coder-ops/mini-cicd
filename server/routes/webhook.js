const express = require('express');
const crypto = require('crypto');
const Build = require('../models/Build');
const { runPipeline, hasCapacity } = require('../utils/pipeline');
const config = require('../config');
const { validateRepo, validateBranch, validateCommit, ValidationError } = require('../utils/validation');

const router = express.Router();

// Verify GitHub webhook signature
const verifySignature = (req) => {
  if (!config.webhookVerificationEnabled) return true;
  const secret = config.webhookSecret;
  if (!secret) return false;
  const sig = req.headers['x-hub-signature-256'];
  if (typeof sig !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(sig) || !Buffer.isBuffer(req.body)) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.body);
  const expected = `sha256=${hmac.digest('hex')}`;
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
};

// POST /api/webhook — GitHub push event
router.post('/', async (req, res) => {
  try {
    // Verify signature
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const event = req.headers['x-github-event'];

    // Only handle push events
    if (event !== 'push') {
      return res.status(200).json({ message: `Ignored event: ${event}` });
    }

    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); }
    catch { return res.status(400).json({ error: 'Invalid JSON payload' }); }
    const branch = validateBranch(payload.ref?.replace('refs/heads/', '') || 'main');
    const repo = validateRepo(payload.repository?.full_name || '');
    const commit = validateCommit(payload.after || payload.head_commit?.id || 'HEAD');
    const commitMsg = payload.head_commit?.message?.split('\n')[0] || '';
    const author = payload.head_commit?.author?.name || 'unknown';

    // Skip branch deletions
    if (payload.deleted) {
      return res.status(200).json({ message: 'Branch deleted — skipped' });
    }

    if (!hasCapacity()) return res.status(429).json({ error: 'Pipeline capacity reached; try again later' });

    // Create build record
    const build = await Build.create({
      repo,
      branch,
      commit,
      commitMsg,
      author,
      trigger: 'push',
      status: 'queued',
    });

    // Acknowledge webhook immediately, run pipeline async
    res.status(202).json({ buildId: build._id, buildNumber: build.number });

    // Run pipeline in background (no await)
    runPipeline(build._id.toString()).catch(async err => {
      console.error(err);
      await Build.findOneAndUpdate(
        { _id: build._id, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
        { status: 'failed', finishedAt: new Date(), duration: 0 }
      ).catch(console.error);
    });

  } catch (err) {
    if (err instanceof ValidationError) return res.status(403).json({ error: err.message });
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.verifySignature = verifySignature;
