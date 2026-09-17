process.env.API_AUTH_TOKEN = 'test-api-token';
process.env.GITHUB_SECRET = 'test-webhook-secret';
process.env.ALLOWED_REPOS = 'acme/demo';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { tokensMatch } = require('../utils/auth');
const { verifySignature } = require('../routes/webhook');
const { validateRepo, validateBranch, validateCommit, validateBuildId, validatePagination, ValidationError } = require('../utils/validation');
const Build = require('../models/Build');

const signedRequest = (body, signature) => ({ body, headers: { 'x-hub-signature-256': signature } });
test('accepts a valid raw GitHub signature', () => {
  const body = Buffer.from('{"repository":"acme/demo"}');
  const signature = `sha256=${crypto.createHmac('sha256', process.env.GITHUB_SECRET).update(body).digest('hex')}`;
  assert.equal(verifySignature(signedRequest(body, signature)), true);
});
test('rejects invalid, missing, malformed, and wrong-secret webhook signatures', () => {
  const body = Buffer.from('{}');
  const wrong = `sha256=${crypto.createHmac('sha256', 'wrong').update(body).digest('hex')}`;
  assert.equal(verifySignature(signedRequest(body, wrong)), false);
  assert.equal(verifySignature({ body, headers: {} }), false);
  assert.equal(verifySignature(signedRequest(body, 'not-a-signature')), false);
});
test('compares API tokens safely', () => { assert.equal(tokensMatch('test-api-token', 'test-api-token'), true); assert.equal(tokensMatch('wrong', 'test-api-token'), false); });
test('allows only configured repositories', () => { assert.equal(validateRepo('acme/demo'), 'acme/demo'); assert.throws(() => validateRepo('other/repo'), ValidationError); });
test('validates branch, commit, build IDs, and pagination bounds', () => {
  assert.equal(validateBranch('feature/api'), 'feature/api'); assert.throws(() => validateBranch('../bad'), ValidationError);
  assert.equal(validateCommit('abcdef0'), 'abcdef0'); assert.throws(() => validateCommit('command;rm'), ValidationError);
  assert.throws(() => validateBuildId('invalid'), ValidationError); assert.deepEqual(validatePagination({ page: '2', limit: '100' }), { page: 2, limit: 100 }); assert.throws(() => validatePagination({ limit: '101' }), ValidationError);
});
test('build status schema allows timed_out', () => {
  assert.equal(Build.schema.path('status').enumValues.includes('timed_out'), true);
});
