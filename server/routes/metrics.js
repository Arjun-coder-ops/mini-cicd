const express = require('express');
const Build = require('../models/Build');
const Deployment = require('../models/Deployment');
const WebhookDelivery = require('../models/WebhookDelivery');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [
      buildsTotal,
      buildsSuccess,
      buildsFailed,
      buildsCancelled,
      deploymentsTotal,
      webhooksTotal
    ] = await Promise.all([
      Build.countDocuments(),
      Build.countDocuments({ status: 'success' }),
      Build.countDocuments({ status: 'failed' }),
      Build.countDocuments({ status: 'cancelled' }),
      Deployment.countDocuments(),
      WebhookDelivery.countDocuments(),
    ]);

    const avgDurationResult = await Build.aggregate([
      { $match: { status: 'success', duration: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$duration' } } },
    ]);

    const avgDurationMs = avgDurationResult[0] ? Math.round(avgDurationResult[0].avg) : 0;

    const metrics = [
      `# HELP builds_total Total number of builds`,
      `# TYPE builds_total counter`,
      `builds_total ${buildsTotal}`,
      `builds_success_total ${buildsSuccess}`,
      `builds_failed_total ${buildsFailed}`,
      `builds_cancelled_total ${buildsCancelled}`,
      `# HELP build_duration_ms Average successful build duration`,
      `# TYPE build_duration_ms gauge`,
      `build_duration_ms ${avgDurationMs}`,
      `# HELP deployment_total Total number of deployments`,
      `# TYPE deployment_total counter`,
      `deployment_total ${deploymentsTotal}`,
      `# HELP webhook_total Total number of webhooks received`,
      `# TYPE webhook_total counter`,
      `webhook_total ${webhooksTotal}`,
    ].join('\n');

    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
