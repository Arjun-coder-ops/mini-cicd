const path = require('path');

const positiveInt = (value, fallback, name) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
};

const allowedRepos = (process.env.ALLOWED_REPOS || '')
  .split(',').map(value => value.trim()).filter(Boolean);

module.exports = {
  port: positiveInt(process.env.PORT, 4000, 'PORT'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5174',
  buildsDir: path.resolve(process.env.BUILDS_DIR || path.join(process.cwd(), '.tmp', 'cicd-builds')),
  apiToken: process.env.API_AUTH_TOKEN || '',
  webhookSecret: process.env.GITHUB_SECRET || '',
  webhookVerificationEnabled: process.env.WEBHOOK_VERIFICATION_ENABLED !== 'false',
  allowedRepos,
  maxConcurrentBuilds: positiveInt(process.env.MAX_CONCURRENT_BUILDS, 2, 'MAX_CONCURRENT_BUILDS'),
  stepTimeoutMs: positiveInt(process.env.STEP_TIMEOUT_MS, 5 * 60 * 1000, 'STEP_TIMEOUT_MS'),
  pipelineTimeoutMs: positiveInt(process.env.PIPELINE_TIMEOUT_MS, 20 * 60 * 1000, 'PIPELINE_TIMEOUT_MS'),
  deployKnownHostsPath: process.env.DEPLOY_KNOWN_HOSTS_PATH || '',
  gitBaseUrl: (process.env.GIT_BASE_URL || 'https://github.com').replace(/\/$/, ''),
};
