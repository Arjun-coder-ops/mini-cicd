const path = require('path');

const positiveInt = (val, def, name) => {
  if (val === undefined || val === '') return def;
  const num = parseInt(val, 10);
  if (Number.isNaN(num) || num <= 0) throw new Error(`Invalid ${name}`);
  return num;
};

const getSecret = (envVar, defaultVal) => {
  const val = process.env[envVar];
  if (process.env.NODE_ENV === 'production') {
    if (!val) throw new Error(`${envVar} is required in production`);
    return val;
  }
  return val || defaultVal;
};

module.exports = {
  port: positiveInt(process.env.PORT, 4000, 'PORT'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5174',
  buildsDir: path.resolve(process.env.BUILDS_DIR || path.join(process.cwd(), '.tmp', 'cicd-builds')),
  jwtSecret: getSecret('JWT_SECRET', 'fallback-jwt-secret-for-dev'),
  refreshTokenSecret: getSecret('REFRESH_TOKEN_SECRET', 'fallback-refresh-secret-for-dev'),
  webhookSecret: process.env.GITHUB_SECRET || process.env.GITHUB_WEBHOOK_SECRET || '',
  webhookVerificationEnabled: process.env.WEBHOOK_VERIFICATION_ENABLED !== 'false',
  maxConcurrentBuilds: positiveInt(process.env.MAX_CONCURRENT_BUILDS, 2, 'MAX_CONCURRENT_BUILDS'),
  stepTimeoutMs: positiveInt(process.env.STEP_TIMEOUT_MS, 5 * 60 * 1000, 'STEP_TIMEOUT_MS'),
  pipelineTimeoutMs: positiveInt(process.env.PIPELINE_TIMEOUT_MS, 20 * 60 * 1000, 'PIPELINE_TIMEOUT_MS'),
  deployKnownHostsPath: process.env.DEPLOY_KNOWN_HOSTS_PATH || '',
  gitBaseUrl: (process.env.GIT_BASE_URL || 'https://github.com').replace(/\/$/, ''),
  apiToken: process.env.API_AUTH_TOKEN || '',
  allowedRepos: (process.env.ALLOWED_REPOS || '*').split(',').map(r => r.trim()).filter(Boolean)
};
