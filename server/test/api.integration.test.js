process.env.API_AUTH_TOKEN = 'integration-token';
process.env.GITHUB_SECRET = 'integration-secret';
process.env.ALLOWED_REPOS = 'acme/demo';
process.env.WEBHOOK_VERIFICATION_ENABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const Build = require('../models/Build');
const Counter = require('../models/Counter');

const uri = 'mongodb://127.0.0.1:27017/mini_cicd_phase21_test';
const auth = { Authorization: 'Bearer integration-token' };
const payload = { ref: 'refs/heads/main', after: 'abcdef0123456789', repository: { full_name: 'acme/demo' }, head_commit: { id: 'abcdef0123456789', message: 'test', author: { name: 'tester' } } };

test.before(async () => { await mongoose.connect(uri); await mongoose.connection.dropDatabase(); });
test.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
test.beforeEach(async () => { await Build.deleteMany({}); await Counter.deleteMany({}); });

test('protected endpoints reject missing and invalid credentials', async () => {
  for (const endpoint of ['/api/builds', '/api/builds/507f1f77bcf86cd799439011', '/api/builds/507f1f77bcf86cd799439011/logs']) {
    assert.equal((await request(app).get(endpoint)).status, 401);
    assert.equal((await request(app).get(endpoint).set('Authorization', 'Bearer wrong')).status, 401);
  }
  assert.equal((await request(app).post('/api/builds/507f1f77bcf86cd799439011/retry')).status, 401);
  assert.equal((await request(app).post('/api/builds/507f1f77bcf86cd799439011/cancel')).status, 401);
});

test('authenticated API accepts valid requests and rejects invalid trigger/query values', async () => {
  assert.equal((await request(app).get('/api/builds').set(auth)).status, 200);
  for (const body of [{ repo: 'other/repo' }, { repo: 'invalid' }, { repo: 'acme/demo', branch: '../bad' }, { repo: 'acme/demo', commit: 'not-a-sha' }]) {
    assert.equal((await request(app).post('/api/builds/trigger').set(auth).send(body)).status, 400);
  }
  assert.equal((await request(app).get('/api/builds?page=-1').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/builds?limit=101').set(auth)).status, 400);
  assert.equal((await request(app).get('/api/builds/not-an-id').set(auth)).status, 400);
});

test('webhook verifies the exact raw body before accepting a signed event', async () => {
  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac('sha256', 'integration-secret').update(Buffer.from(raw)).digest('hex')}`;
  const valid = await request(app).post('/api/webhook').set('X-GitHub-Event', 'ping').set('X-Hub-Signature-256', signature).set('Content-Type', 'application/json').send(raw);
  assert.equal(valid.status, 200);
  assert.equal((await request(app).post('/api/webhook').set('X-GitHub-Event', 'ping').send(raw)).status, 401);
  assert.equal((await request(app).post('/api/webhook').set('X-GitHub-Event', 'ping').set('X-Hub-Signature-256', 'sha256=bad').send(raw)).status, 401);
});

test('atomic numbering is unique for concurrent MongoDB creates', async () => {
  const builds = await Promise.all(Array.from({ length: 10 }, (_, index) => Build.create({ repo: 'acme/demo', branch: 'main', commit: `${index}`.padStart(7, 'a') })));
  const numbers = builds.map(build => build.number);
  assert.equal(new Set(numbers).size, 10);
  assert.deepEqual([...numbers].sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
});

test('healthcheck endpoint reports status and database connectivity', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'connected');
  assert.equal(typeof res.body.uptime, 'number');
});

test('recoverOrphanedBuilds marks leftover queued and running builds as failed', async () => {
  const { recoverOrphanedBuilds } = require('../utils/pipeline');
  await Build.create({ repo: 'acme/demo', branch: 'main', commit: 'abcdef01', status: 'queued' });
  await Build.create({ repo: 'acme/demo', branch: 'main', commit: 'abcdef02', status: 'running' });
  await Build.create({ repo: 'acme/demo', branch: 'main', commit: 'abcdef03', status: 'success' });

  const recovered = await recoverOrphanedBuilds();
  assert.equal(recovered, 2);

  const queued = await Build.find({ status: 'queued' });
  const running = await Build.find({ status: 'running' });
  const failed = await Build.find({ status: 'failed' });
  const success = await Build.find({ status: 'success' });

  assert.equal(queued.length, 0);
  assert.equal(running.length, 0);
  assert.equal(failed.length, 2);
  assert.equal(success.length, 1);
});
