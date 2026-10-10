const express = require('express');
const fs = require('fs');
const Build = require('../models/Build');
const { runPipeline, cancelPipeline, hasCapacity, addSseClient, removeSseClient } = require('../utils/pipeline');
const { requireAuth, requireProjectRole } = require('../middleware/auth');
const { ValidationError, validateRepo, validateBranch, validateCommit, validateBuildId, validatePagination } = require('../utils/validation');

const router = express.Router();
router.use(requireAuth);

// GET /api/builds — List builds (paginated)
router.get('/', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query);
    const skip  = (page - 1) * limit;
    const filter = { projectId: req.query.projectId || req.body.projectId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.repo)   filter.repo   = req.query.repo;
    if (req.query.branch) filter.branch = req.query.branch;

    const [builds, total] = await Promise.all([
      Build.find(filter).sort({ number: -1 }).skip(skip).limit(limit),
      Build.countDocuments(filter),
    ]);

    res.json({ builds, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/builds/stats — Dashboard stats
router.get('/stats', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
    const projectId = req.query.projectId;
  try {
    const [total, success, failed, running] = await Promise.all([
      Build.countDocuments({ projectId, projectId }),
      Build.countDocuments({ projectId, status: 'success' }),
      Build.countDocuments({ projectId, status: 'failed' }),
      Build.countDocuments({ projectId, status: { $in: ['queued', 'running'] } }),
    ]);

    const avgDurationResult = await Build.aggregate([
      { $match: { projectId: new (require('mongoose').Types.ObjectId)(projectId), status: 'success', duration: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$duration' } } },
    ]);

    const recent = await Build.find({ projectId }).sort({ number: -1 }).limit(5);

    res.json({
      total,
      success,
      failed,
      running,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgDuration: avgDurationResult[0]?.avg
        ? Math.round(avgDurationResult[0].avg / 1000)
        : 0,
      recent,
    });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/builds/:id — Single build
router.get('/:id', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  try {
    validateBuildId(req.params.id);
    const build = await Build.findById(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    res.json({ build });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/builds/trigger — Manual build trigger
router.post('/trigger', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), async (req, res) => {
  try {
    const repo = validateRepo(req.body.repo);
    const branch = validateBranch(req.body.branch || 'main');
    const commit = validateCommit(req.body.commit || 'HEAD');
    if (!hasCapacity()) return res.status(429).json({ error: 'Pipeline capacity reached; try again later' });

    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existing = await Build.findOne({ idempotencyKey });
      if (existing) return res.status(200).json({ build: existing, idempotency: true });
    }

    const build = await Build.create({
      repo,
      branch,
      commit,
      commitMsg: 'Manual trigger',
      author: 'manual',
      trigger: 'manual',
      projectId: req.query.projectId || req.body.projectId,
      status: 'queued',
      idempotencyKey
    });

    res.status(201).json({ build });

    // Run pipeline async
    runPipeline(build._id.toString()).catch(async err => {
      console.error(err);
      await Build.findOneAndUpdate(
        { _id: build._id, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
        { status: 'failed', finishedAt: new Date(), duration: 0 }
      ).catch(console.error);
    });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/builds/:id/cancel — Cancel a running build
router.post('/:id/cancel', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), async (req, res) => {
  try {
    validateBuildId(req.params.id);
    const build = await Build.findById(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    if (!['queued', 'running'].includes(build.status))
      return res.status(400).json({ error: 'Build is not running' });

    await cancelPipeline(req.params.id);

    res.json({ message: 'Build cancelled' });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/builds/:id/retry — Re-run a failed build
router.post('/:id/retry', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER']), async (req, res) => {
  try {
    validateBuildId(req.params.id);
    if (!hasCapacity()) return res.status(429).json({ error: 'Pipeline capacity reached; try again later' });
    const original = await Build.findById(req.params.id);
    if (!original) return res.status(404).json({ error: 'Build not found' });

    const newBuild = await Build.create({
      projectId: original.projectId,
      repo:      original.repo,
      branch:    original.branch,
      commit:    original.commit,
      commitMsg: original.commitMsg,
      author:    original.author,
      trigger:   'manual',
      status:    'queued',
    });

    res.status(201).json({ build: newBuild });
    runPipeline(newBuild._id.toString()).catch(async err => {
      console.error(err);
      await Build.findOneAndUpdate(
        { _id: newBuild._id, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
        { status: 'failed', finishedAt: new Date(), duration: 0 }
      ).catch(console.error);
    });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/builds/:id/logs — Full log file
router.get('/:id/logs', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  try {
    validateBuildId(req.params.id);
    const build = await Build.findById(req.params.id);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    if (build.logFile && fs.existsSync(build.logFile)) {
      const logs = fs.readFileSync(build.logFile, 'utf8');
      return res.json({ logs });
    }
    if (build.logs) {
      return res.json({ logs: build.logs });
    }
    res.json({ logs: '' });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/builds/:id/stream — SSE log stream
router.get('/:id/stream', requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER']), async (req, res) => {
  let build;
  try { validateBuildId(req.params.id); build = await Build.findById(req.params.id); }
  catch { return res.status(400).json({ error: 'invalid build ID' }); }
  if (!build) return res.status(404).end();

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // If build already finished, send the full log and close
  if (['success', 'failed', 'cancelled', 'timed_out'].includes(build.status)) {
    let logContent = '';
    if (build.logFile && fs.existsSync(build.logFile)) {
      logContent = fs.readFileSync(build.logFile, 'utf8');
    } else if (build.logs) {
      logContent = build.logs;
    }
    if (logContent) {
      const lines = logContent.split('\n').filter(Boolean);
      lines.forEach(line => res.write(`data: ${JSON.stringify({ line })}\n\n`));
    }
    res.write(`event: done\ndata: ${JSON.stringify({ status: build.status })}\n\n`);
    return res.end();
  }

  // Stream existing log first (catch-up)
  if (build.logFile && fs.existsSync(build.logFile)) {
    const existing = fs.readFileSync(build.logFile, 'utf8').split('\n').filter(Boolean);
    existing.forEach(line => res.write(`data: ${JSON.stringify({ line })}\n\n`));
  } else if (build.logs) {
    const existing = build.logs.split('\n').filter(Boolean);
    existing.forEach(line => res.write(`data: ${JSON.stringify({ line })}\n\n`));
  }

  // Register client for live updates
  const id = build._id.toString();
  addSseClient(id, res);

  // Heartbeat every 15s to keep connection alive
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    removeSseClient(id, res);
  });
});

module.exports = router;
