const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const config = require('./config');

const webhookRoutes = require('./routes/webhook');
const buildRoutes   = require('./routes/builds');

const app = express();

app.use(cors({ origin: config.clientUrl }));

// Rate limit API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api', apiLimiter);

// Routes
// Webhooks need the exact bytes GitHub signed; do not parse them as JSON first.
app.use('/api/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use('/api/builds',  buildRoutes);

app.get('/api/health', (_, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 'ok' : 'degraded';
  const statusCode = isDbConnected ? 200 : 503;
  res.status(statusCode).json({
    status,
    database: isDbConnected ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    time: new Date(),
  });
});

const { recoverOrphanedBuilds, cleanupActiveRuns } = require('./utils/pipeline');

// Connect and start
if (require.main === module) {
  const missing = [
    !process.env.MONGODB_URI && 'MONGODB_URI',
    !config.apiToken && 'API_AUTH_TOKEN',
    !config.allowedRepos.length && 'ALLOWED_REPOS',
    config.webhookVerificationEnabled && !config.webhookSecret && 'GITHUB_SECRET',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing required configuration: ${missing.join(', ')}`);
    process.exit(1);
  }
  mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await recoverOrphanedBuilds();
    const PORT = config.port;
    const server = app.listen(PORT, () => console.log(`🚀 CI/CD server on port ${PORT}`));

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await cleanupActiveRuns();
        await mongoose.connection.close();
        console.log('👋 Server shut down cleanly');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch(err => { console.error('DB error:', err); process.exit(1); });
}

module.exports = app;
