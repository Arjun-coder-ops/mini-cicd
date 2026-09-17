const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const Build = require('../models/Build');
const config = require('../config');

const sseClients = new Map();
const activeRuns = new Map();
class PipelineError extends Error { constructor(message, code) { super(message); this.code = code; } }
const addSseClient = (id, res) => { if (!sseClients.has(id)) sseClients.set(id, new Set()); sseClients.get(id).add(res); };
const removeSseClient = (id, res) => { const clients = sseClients.get(id); if (!clients) return; clients.delete(res); if (!clients.size) sseClients.delete(id); };
const emit = (id, event, data) => (sseClients.get(id) || []).forEach(res => { try { res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`); } catch {} });
const broadcast = (id, line) => emit(id, '', { line });
const hasCapacity = () => activeRuns.size < config.maxConcurrentBuilds;
const log = async (id, line, file) => { const output = `[${new Date().toISOString()}] ${line}`; await fsp.appendFile(file, `${output}\n`); broadcast(id, output); };
const kill = state => { if (!state.proc || state.proc.exitCode !== null) return; try { state.proc.kill('SIGTERM'); } catch {} setTimeout(() => { try { if (state.proc?.exitCode === null) state.proc.kill('SIGKILL'); } catch {} }, 3000).unref(); };

const IS_WIN = process.platform === 'win32';
const resolveCmd = cmd => (IS_WIN && ['npm', 'pip', 'npx'].includes(cmd) ? (cmd === 'pip' ? 'pip' : `${cmd}.cmd`) : cmd);
const TERMINAL = ['success', 'failed', 'cancelled', 'timed_out'];

const runCommand = (cmd, args, options, id, file, state) => new Promise(async (resolve, reject) => {
  if (state.cancelled) return reject(new PipelineError('Build cancelled', 'cancelled'));
  if (state.timedOut) return reject(new PipelineError('Pipeline timed out', 'timed_out'));
  await log(id, `$ ${cmd} ${args.join(' ')}`, file);
  const targetCmd = resolveCmd(cmd);
  const isBatch = IS_WIN && (targetCmd.endsWith('.cmd') || targetCmd.endsWith('.bat'));
  const proc = spawn(targetCmd, args, { ...options, shell: options?.shell ?? isBatch }); state.proc = proc;
  const timer = setTimeout(() => { state.stepTimedOut = true; kill(state); }, config.stepTimeoutMs);
  const output = (prefix, data) => data.toString().split(/\r?\n/).filter(Boolean).forEach(line => log(id, `${prefix}${line}`, file).catch(() => {}));
  proc.stdout.on('data', data => output('', data)); proc.stderr.on('data', data => output('  ', data));
  proc.once('error', err => { clearTimeout(timer); reject(err); });
  proc.once('close', code => { clearTimeout(timer); state.proc = null; if (state.cancelled) return reject(new PipelineError('Build cancelled', 'cancelled')); if (state.timedOut || state.stepTimedOut) return reject(new PipelineError('Pipeline timed out', 'timed_out')); return code === 0 ? resolve() : reject(new PipelineError(`Command exited with code ${code}`, 'failed')); });
});

const updateStep = async (build, name, status) => {
  const step = build.steps.find(value => value.name === name);
  if (!step) return;
  step.status = status;
  if (status === 'running') step.startedAt = new Date();
  if (TERMINAL.includes(status)) {
    step.finishedAt = new Date();
    step.duration = step.startedAt ? step.finishedAt - step.startedAt : 0;
  }
  await Build.updateOne(
    { _id: build._id, 'steps.name': name },
    {
      $set: {
        'steps.$.status': step.status,
        'steps.$.startedAt': step.startedAt,
        'steps.$.finishedAt': step.finishedAt,
        'steps.$.duration': step.duration,
      }
    }
  );
  emit(build.id, 'step', { name, status, duration: step.duration });
};
const finish = async (build, status, file, message) => {
  if (message) await log(build.id || build._id.toString(), message, file);
  const finishedAt = new Date();
  const duration = build.startedAt ? finishedAt - build.startedAt : 0;
  const updated = await Build.findOneAndUpdate(
    { _id: build._id, status: { $nin: TERMINAL } },
    { status, finishedAt, duration },
    { new: true }
  );
  if (!updated) return;
  build.status = updated.status;
  build.finishedAt = updated.finishedAt;
  build.duration = updated.duration;
  emit(build.id || build._id.toString(), 'done', { status: updated.status, duration: updated.duration });
};

const cancelPipeline = async id => {
  const state = activeRuns.get(id);
  if (state) { state.cancelled = true; kill(state); }
  const finishedAt = new Date();
  const build = await Build.findById(id);
  if (!build) return false;
  const duration = build.startedAt ? finishedAt - build.startedAt : 0;
  const updated = await Build.findOneAndUpdate(
    { _id: id, status: { $nin: TERMINAL } },
    { status: 'cancelled', finishedAt, duration },
    { new: true }
  );
  if (!updated) return false;
  if (updated.logFile) await log(id, 'Build cancelled by user', updated.logFile);
  emit(id, 'done', { status: 'cancelled', duration: updated.duration });
  return true;
};

const runPipeline = async id => {
  if (!activeRuns.has(id) && !hasCapacity()) throw new PipelineError('Pipeline capacity reached', 'capacity');
  const state = activeRuns.get(id) || { proc: null, cancelled: false, timedOut: false, stepTimedOut: false }; activeRuns.set(id, state);
  const workDir = path.join(config.buildsDir, `build-${id}`); const logFile = path.join(config.buildsDir, `${id}.log`);
  const startedAt = new Date();
  const steps = ['clone', 'install', 'build', 'test', 'deploy'].map(name => ({ name, status: 'pending' }));
  const build = await Build.findOneAndUpdate(
    { _id: id, status: { $nin: TERMINAL } },
    { logFile, status: 'running', startedAt, steps },
    { new: true }
  );
  if (!build || build.status === 'cancelled') { activeRuns.delete(id); return; }
  const overall = setTimeout(() => { state.timedOut = true; kill(state); }, config.pipelineTimeoutMs);
  try {
    await fsp.mkdir(config.buildsDir, { recursive: true }); await log(id, `Build #${build.number}: ${build.repo}@${build.branch}`, logFile);
    const step = async (name, fn) => { state.stepTimedOut = false; await updateStep(build, name, 'running'); try { await fn(); await updateStep(build, name, 'success'); } catch (err) { await updateStep(build, name, err.code === 'cancelled' ? 'cancelled' : err.code === 'timed_out' ? 'timed_out' : 'failed'); throw err; } };
    await step('clone', async () => { const url = `${config.gitBaseUrl}/${build.repo}.git`; if (build.commit === 'HEAD') { await runCommand('git', ['clone', '--depth', '1', '--branch', build.branch, url, workDir], {}, id, logFile, state); } else { await runCommand('git', ['clone', '--branch', build.branch, url, workDir], {}, id, logFile, state); await runCommand('git', ['checkout', build.commit], { cwd: workDir }, id, logFile, state); } });
    const hasPackage = fs.existsSync(path.join(workDir, 'package.json')); const hasRequirements = fs.existsSync(path.join(workDir, 'requirements.txt'));
    await step('install', async () => { if (hasPackage) await runCommand('npm', ['ci', '--prefer-offline'], { cwd: workDir }, id, logFile, state); else if (hasRequirements) await runCommand('pip', ['install', '-r', 'requirements.txt'], { cwd: workDir }, id, logFile, state); else await log(id, 'No dependency manifest found; install skipped', logFile); });
    await step('build', async () => { if (!hasPackage) return log(id, 'No Node build step detected; build skipped', logFile); const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json'))); if (pkg.scripts?.build) await runCommand('npm', ['run', 'build'], { cwd: workDir }, id, logFile, state); else await log(id, 'No build script; build skipped', logFile); });
    await step('test', async () => { if (!hasPackage) return log(id, 'No Node test runner detected; tests skipped', logFile); const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json'))); if (pkg.scripts?.test && !pkg.scripts.test.includes('no test')) await runCommand('npm', ['test', '--', '--passWithNoTests'], { cwd: workDir }, id, logFile, state); else await log(id, 'No test script; tests skipped', logFile); });
    await step('deploy', async () => { const { DEPLOY_HOST, DEPLOY_USER = 'ubuntu', DEPLOY_PATH = '/var/www/app', DEPLOY_KEY_PATH } = process.env; if (!DEPLOY_HOST || !DEPLOY_KEY_PATH) return log(id, 'Deployment simulated: DEPLOY_HOST and DEPLOY_KEY_PATH are not configured', logFile); if (!config.deployKnownHostsPath || !fs.existsSync(config.deployKnownHostsPath)) throw new PipelineError('DEPLOY_KNOWN_HOSTS_PATH must point to an existing known_hosts file', 'failed'); const dist = fs.existsSync(path.join(workDir, 'dist')) ? `${path.join(workDir, 'dist')}/` : `${workDir}/`; const ssh = `ssh -i ${DEPLOY_KEY_PATH} -o UserKnownHostsFile=${config.deployKnownHostsPath} -o StrictHostKeyChecking=yes`; await runCommand('rsync', ['-az', '--delete', '-e', ssh, dist, `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`], {}, id, logFile, state); await runCommand('ssh', ['-i', DEPLOY_KEY_PATH, '-o', `UserKnownHostsFile=${config.deployKnownHostsPath}`, '-o', 'StrictHostKeyChecking=yes', `${DEPLOY_USER}@${DEPLOY_HOST}`, 'pm2 restart app || pm2 serve /var/www/app 3000 --name app --spa'], {}, id, logFile, state); });
    await finish(build, 'success', logFile, `Pipeline complete in ${((Date.now() - build.startedAt) / 1000).toFixed(1)}s`);
  } catch (err) { const status = state.cancelled || err.code === 'cancelled' ? 'cancelled' : state.timedOut || err.code === 'timed_out' ? 'timed_out' : 'failed'; await finish(build, status, logFile, `${status}: ${err.message}`); }
  finally { clearTimeout(overall); activeRuns.delete(id); await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {}); }
};
const recoverOrphanedBuilds = async () => {
  const result = await Build.updateMany(
    { status: { $in: ['queued', 'running'] } },
    { status: 'failed', finishedAt: new Date(), duration: 0 }
  );
  if (result.modifiedCount > 0) {
    console.log(`🧹 Recovered ${result.modifiedCount} orphaned build(s) left in non-terminal state`);
  }
  return result.modifiedCount;
};

const cleanupActiveRuns = async () => {
  if (!activeRuns.size) return;
  const runningIds = Array.from(activeRuns.keys());
  for (const [, state] of activeRuns) {
    state.cancelled = true;
    kill(state);
  }
  activeRuns.clear();
  await Build.updateMany(
    { _id: { $in: runningIds }, status: { $nin: TERMINAL } },
    { status: 'cancelled', finishedAt: new Date() }
  );
};

module.exports = { runPipeline, cancelPipeline, hasCapacity, addSseClient, removeSseClient, broadcast, PipelineError, resolveCmd, recoverOrphanedBuilds, cleanupActiveRuns };
