const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const config = require('./config');

const webhookRoutes = require('./routes/webhook');
const buildRoutes   = require('./routes/builds');
const authRoutes    = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const { router: secretsRoutes } = require('./routes/secrets');
const metricsRoutes = require('./routes/metrics');

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    const allowed = [config.clientUrl, 'https://mini-cicd.vercel.app', 'http://localhost:5174', 'http://localhost:3000'];
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(cookieParser());

// Rate limit API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api', apiLimiter);

// Routes
// Webhooks need the exact bytes GitHub signed; do not parse them as JSON first.
app.use('/api/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', secretsRoutes);
app.use('/api/builds',  buildRoutes);
app.use('/api/metrics', metricsRoutes);

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

// Serve frontend production build when present, or serve landing portal with dashboard redirect
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        name: 'Mini CI/CD Pipeline API',
        status: 'online',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        dashboard: config.clientUrl,
        health: '/api/health',
        docs: 'https://github.com/Arjun-coder-ops/mini-cicd#readme'
      });
    }

    const uptime = Math.floor(process.uptime());
    const isDbConnected = mongoose.connection.readyState === 1;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini CI/CD Engine — Online</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%3E<text y=%2226%22 font-size=%2226%22>🚀</text></svg>">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 14px;
      max-width: 520px;
      width: 100%;
      padding: 36px 32px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(63, 185, 80, 0.15);
      border: 1px solid rgba(63, 185, 80, 0.3);
      color: #3fb950;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 20px;
      margin-bottom: 20px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: #3fb950;
      border-radius: 50%;
      box-shadow: 0 0 8px #3fb950;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #f0f6fc;
      margin-bottom: 8px;
    }
    p {
      color: #8b949e;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 24px;
      text-align: left;
    }
    .stat {
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .stat-label {
      font-size: 11px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 13px;
      font-weight: 600;
      color: #e6edf3;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      background: #238636;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      padding: 13px 20px;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }
    .btn:hover {
      background: #2ea043;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(46, 160, 67, 0.3);
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid #30363d;
      color: #8b949e;
      margin-top: 10px;
      font-size: 12px;
      padding: 8px 14px;
    }
    .btn-secondary:hover {
      background: #21262d;
      color: #c9d1d9;
    }
    .countdown {
      font-size: 12px;
      color: #8b949e;
      margin-top: 14px;
    }
    .countdown span {
      color: #58a6ff;
      font-weight: 600;
    }
    .links {
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid #21262d;
      display: flex;
      justify-content: center;
      gap: 16px;
      font-size: 12px;
    }
    .links a {
      color: #58a6ff;
      text-decoration: none;
    }
    .links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <div class="badge-dot"></div>
      Backend Engine Active
    </div>
    <h1>Mini CI/CD API & Runner</h1>
    <p>The backend CI/CD pipeline service and BullMQ worker are running.</p>

    <div class="grid">
      <div class="stat">
        <div class="stat-label">Database</div>
        <div class="stat-value">${isDbConnected ? '🟢 Connected' : '🔴 Degraded'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Queue Runner</div>
        <div class="stat-value">⚡ BullMQ Active</div>
      </div>
      <div class="stat">
        <div class="stat-label">Hosting</div>
        <div class="stat-value">☁️ Render Cloud</div>
      </div>
      <div class="stat">
        <div class="stat-label">Uptime</div>
        <div class="stat-value">⏱️ ${uptime}s</div>
      </div>
    </div>

    <a href="${config.clientUrl}" class="btn" id="launchBtn">
      <span>Open Web Dashboard</span>
      <span>&rarr;</span>
    </a>

    <div class="countdown" id="countdown">
      Redirecting to dashboard in <span id="timer">3</span>s...
    </div>

    <button class="btn btn-secondary" id="cancelBtn" onclick="cancelRedirect()">
      Stay on API status page
    </button>

    <div class="links">
      <a href="/api/health" target="_blank">Health Check</a>
      <a href="/api/metrics" target="_blank">Metrics</a>
      <a href="https://github.com/Arjun-coder-ops/mini-cicd" target="_blank">GitHub</a>
    </div>
  </div>

  <script>
    let seconds = 3;
    let timerEl = document.getElementById('timer');
    let countdownEl = document.getElementById('countdown');
    let cancelBtn = document.getElementById('cancelBtn');
    let target = "${config.clientUrl}";

    let interval = setInterval(() => {
      seconds--;
      if (timerEl) timerEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        window.location.href = target;
      }
    }, 1000);

    function cancelRedirect() {
      clearInterval(interval);
      countdownEl.textContent = "Automatic redirect paused.";
      cancelBtn.style.display = 'none';
    }
  </script>
</body>
</html>`);
  });

  // Redirect any other non-API routes directly to frontend dashboard
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.redirect(`${config.clientUrl}${req.originalUrl}`);
  });
}

const { recoverOrphanedBuilds, cleanupActiveRuns } = require('./utils/pipeline');
const { buildWorker } = require('./workers/buildWorker');

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
        await buildWorker.close();
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
