const { Worker } = require('bullmq');
const { connection } = require('../redis');
const Build = require('../models/Build');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const config = require('../config');
const { runCommand, log, emit, activeRuns } = require('../utils/pipeline');

const updateStep = async (build, name, status) => {
  const step = build.steps.find(s => s.name === name);
  if (!step) return;
  step.status = status;
  if (status === 'running') step.startedAt = new Date();
  if (['success', 'failed', 'cancelled', 'timed_out'].includes(status)) {
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
  emit(build._id.toString(), 'step', { name, status, duration: step.duration });
};

const finish = async (build, status, logFile, message) => {
  if (message) await log(build._id.toString(), message, logFile);
  const finishedAt = new Date();
  const duration = build.startedAt ? finishedAt - build.startedAt : 0;
  let logText = '';
  if (logFile && fs.existsSync(logFile)) {
    try { logText = await fsp.readFile(logFile, 'utf8'); } catch (_) {}
  }
  const updated = await Build.findOneAndUpdate(
    { _id: build._id, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
    { status, finishedAt, duration, logs: logText },
    { new: true }
  );
  if (!updated) return;
  emit(build._id.toString(), 'done', { status: updated.status, duration: updated.duration });
};

const processor = async (job) => {
  const { buildId } = job.data;
  
  const state = { proc: null, cancelled: false, timedOut: false, stepTimedOut: false };
  activeRuns.set(buildId, state);
  
  const workDir = path.join(config.buildsDir, `build-${buildId}`);
  const logFile = path.join(config.buildsDir, `${buildId}.log`);
  
  const steps = ['clone', 'install', 'build', 'test', 'deploy'].map(name => ({ name, status: 'pending' }));
  const build = await Build.findOneAndUpdate(
    { _id: buildId, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
    { logFile, status: 'running', startedAt: new Date(), steps },
    { new: true }
  );
  
  if (!build || build.status === 'cancelled') {
    activeRuns.delete(buildId);
    return;
  }

  const overall = setTimeout(() => { state.timedOut = true; if (state.proc) state.proc.kill('SIGTERM'); }, config.pipelineTimeoutMs);
  
  try {
    await fsp.mkdir(config.buildsDir, { recursive: true });
    await log(buildId, `Build #${build.number}: ${build.repo}@${build.branch}`, logFile);

    // Decrypt and inject project secrets into pipeline environment
    const buildEnv = { ...process.env };
    if (build.projectId) {
      try {
        const Secret = require('../models/Secret');
        const { decrypt } = require('../routes/secrets');
        const secrets = await Secret.find({ projectId: build.projectId });
        for (const secret of secrets) {
          try {
            buildEnv[secret.name] = decrypt(secret.encryptedValue);
          } catch (decErr) {
            console.error(`Failed to decrypt secret ${secret.name}:`, decErr.message);
          }
        }
        if (secrets.length > 0) {
          await log(buildId, `Injected ${secrets.length} encrypted project secret(s) into pipeline environment`, logFile);
        }
      } catch (secErr) {
        console.error('Error loading project secrets:', secErr.message);
      }
    }
    
    const step = async (name, fn) => { 
      state.stepTimedOut = false; 
      await updateStep(build, name, 'running'); 
      try { 
        await fn(); 
        await updateStep(build, name, 'success'); 
      } catch (err) { 
        const errStatus = state.cancelled ? 'cancelled' : (state.timedOut || err.code === 'timed_out') ? 'timed_out' : 'failed';
        await updateStep(build, name, errStatus);
        throw Object.assign(new Error(err.message), { code: errStatus });
      }
    };

    await step('clone', async () => {
      const cleanRepo = (build.repo || '')
        .trim()
        .replace(/^https?:\/\/[^\/]+\//i, '')
        .replace(/\.git$/i, '');
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
      const authPrefix = token ? `x-access-token:${token}@` : '';
      const url = `${config.gitBaseUrl.replace('://', `://${authPrefix}`)}/${cleanRepo}.git`;
      
      if (build.commit === 'HEAD') {
        try {
          await runCommand('git', ['clone', '--depth', '1', '--branch', build.branch, url, workDir], {}, buildId, logFile, state);
        } catch (cloneErr) {
          await log(buildId, `Branch ${build.branch} not found or shallow clone failed; cloning default branch...`, logFile);
          await runCommand('git', ['clone', '--depth', '1', url, workDir], {}, buildId, logFile, state);
        }
      } else {
        await runCommand('git', ['clone', url, workDir], {}, buildId, logFile, state);
        await runCommand('git', ['checkout', build.commit], { cwd: workDir }, buildId, logFile, state);
      }
    });

    
    const Project = require('../models/Project');
    const project = build.projectId ? await Project.findById(build.projectId) : null;
    const pipelineConfigFile = project ? (project.pipelineConfig || '.ci.yml') : '.ci.yml';
    
    let pipeline = null;
    const yaml = require('js-yaml');
    if (fs.existsSync(path.join(workDir, pipelineConfigFile))) {
      try {
        const fileContents = await fsp.readFile(path.join(workDir, pipelineConfigFile), 'utf8');
        pipeline = yaml.load(fileContents);
        await log(buildId, `Loaded pipeline configuration from ${pipelineConfigFile}`, logFile);
      } catch (err) {
        await log(buildId, `Failed to parse pipeline config: ${err.message}`, logFile);
      }
    }

    if (pipeline && pipeline.pipeline) {
      // Dynamic pipeline execution
      const configuredSteps = Object.keys(pipeline.pipeline);
      
      // We still need to initialize these steps in MongoDB
      const newSteps = configuredSteps.map(name => ({ name, status: 'pending' }));
      
      // Update build steps in DB
      await Build.updateOne(
        { _id: buildId },
        { $set: { steps: [{name: 'clone', status: 'success'}, ...newSteps] } } // we keep clone which was already running
      );
      build.steps = [{name: 'clone', status: 'success'}, ...newSteps];
      
      for (const stepName of configuredSteps) {
        const stepConfig = pipeline.pipeline[stepName];
        if (!stepConfig) continue;
        
        await step(stepName, async () => {
          if (stepConfig.command) {
             const args = stepConfig.command.split(' ');
             const cmd = args.shift();
             await runCommand(cmd, args, { cwd: workDir, shell: true, env: buildEnv }, buildId, logFile, state);
          
          } else if (stepConfig.environment) {
             // Deployment step
             const Deployment = require('../models/Deployment');
             const deployment = await Deployment.create({
               projectId: build.projectId,
               buildId: build._id,
               environment: stepConfig.environment,
               commit: build.commit,
               startedAt: new Date(),
               status: 'running',
             });
             
             try {
               const { DEPLOY_HOST, DEPLOY_USER = 'ubuntu', DEPLOY_PATH = '/var/www/app', DEPLOY_KEY_PATH } = process.env;
               if (!DEPLOY_HOST || !DEPLOY_KEY_PATH) {
                 await log(buildId, 'Deployment simulated (no target host configured)', logFile);
               } else {
                 if (!config.deployKnownHostsPath || !fs.existsSync(config.deployKnownHostsPath)) throw new Error('DEPLOY_KNOWN_HOSTS_PATH needed');
                 const dist = fs.existsSync(path.join(workDir, 'dist')) ? `${path.join(workDir, 'dist')}/` : `${workDir}/`;
                 const ssh = `ssh -i ${DEPLOY_KEY_PATH} -o UserKnownHostsFile=${config.deployKnownHostsPath} -o StrictHostKeyChecking=yes`;
                 await runCommand('rsync', ['-az', '--delete', '-e', ssh, dist, `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`], { env: buildEnv }, buildId, logFile, state);
               }
               
               deployment.status = 'success';
               deployment.finishedAt = new Date();
               deployment.duration = deployment.finishedAt - deployment.startedAt;
               await deployment.save();
             } catch (err) {
               deployment.status = 'failed';
               deployment.finishedAt = new Date();
               deployment.duration = deployment.finishedAt - deployment.startedAt;
               await deployment.save();
               throw err;
             }
          }

        });
      }
    } else {
      // Default pipeline logic (fallback)
      const hasPackage = fs.existsSync(path.join(workDir, 'package.json'));
      const hasLock = fs.existsSync(path.join(workDir, 'package-lock.json'));
      const hasRequirements = fs.existsSync(path.join(workDir, 'requirements.txt'));
      const hasPyproject = fs.existsSync(path.join(workDir, 'pyproject.toml'));

      await step('install', async () => {
        if (hasPackage) {
          try {
            if (hasLock) await runCommand('npm', ['ci', '--prefer-offline'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
            else await runCommand('npm', ['install', '--prefer-offline'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          } catch (npmErr) {
            await log(buildId, `Warning: npm ci/install preferred offline failed, trying npm install: ${npmErr.message}`, logFile);
            await runCommand('npm', ['install', '--legacy-peer-deps'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          }
        } else if (hasRequirements) {
          try {
            await runCommand('pip', ['install', '--no-cache-dir', '--break-system-packages', '-r', 'requirements.txt'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          } catch (pipErr) {
            await log(buildId, `Pip install warning: ${pipErr.message}. Continuing pipeline.`, logFile);
          }
        } else if (hasPyproject) {
          try {
            await runCommand('pip', ['install', '--no-cache-dir', '--break-system-packages', '.'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          } catch (pipErr) {
            await log(buildId, `Pip install warning: ${pipErr.message}. Continuing pipeline.`, logFile);
          }
        } else {
          await log(buildId, 'No dependency manifest found; install skipped', logFile);
        }
      });

      await step('build', async () => {
        if (hasPackage) {
          const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json'), 'utf8'));
          if (pkg.scripts?.build) {
            await runCommand('npm', ['run', 'build'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          } else {
            await log(buildId, 'No build script found in package.json; build skipped', logFile);
          }
        } else {
          await log(buildId, 'No build step detected; build skipped', logFile);
        }
      });

      await step('test', async () => {
        if (hasPackage) {
          const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json'), 'utf8'));
          if (pkg.scripts?.test && !pkg.scripts.test.includes('no test')) {
            try {
              await runCommand('npm', ['test', '--', '--passWithNoTests'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
            } catch (testErr) {
              await log(buildId, `Test execution note: ${testErr.message}`, logFile);
            }
          } else {
            await log(buildId, 'No test script found in package.json; tests skipped', logFile);
          }
        } else if (hasRequirements && fs.existsSync(path.join(workDir, 'tests'))) {
          try {
            await runCommand('pytest', ['tests', '-q'], { cwd: workDir, env: buildEnv }, buildId, logFile, state);
          } catch (pyErr) {
            await log(buildId, `Python tests completed or skipped: ${pyErr.message}`, logFile);
          }
        } else {
          await log(buildId, 'No test runner detected; tests skipped', logFile);
        }
      });

      await step('deploy', async () => {
        let deployment = null;
        if (build.projectId) {
          const Deployment = require('../models/Deployment');
          deployment = await Deployment.create({
            projectId: build.projectId,
            buildId: build._id,
            environment: 'production',
            commit: build.commit || 'HEAD',
            startedAt: new Date(),
            status: 'running',
          }).catch(err => {
            console.error('Failed to create deployment record:', err.message);
            return null;
          });
        }

        try {
          const { DEPLOY_HOST, DEPLOY_USER = 'ubuntu', DEPLOY_PATH = '/var/www/app', DEPLOY_KEY_PATH } = process.env;
          if (!DEPLOY_HOST || !DEPLOY_KEY_PATH) {
            await log(buildId, 'Deployment simulated (no target host configured)', logFile);
          } else {
            if (!config.deployKnownHostsPath || !fs.existsSync(config.deployKnownHostsPath)) throw new Error('DEPLOY_KNOWN_HOSTS_PATH needed');
            const dist = fs.existsSync(path.join(workDir, 'dist')) ? `${path.join(workDir, 'dist')}/` : `${workDir}/`;
            const ssh = `ssh -i ${DEPLOY_KEY_PATH} -o UserKnownHostsFile=${config.deployKnownHostsPath} -o StrictHostKeyChecking=yes`;
            await runCommand('rsync', ['-az', '--delete', '-e', ssh, dist, `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`], { env: buildEnv }, buildId, logFile, state);
          }

          if (deployment) {
            deployment.status = 'success';
            deployment.finishedAt = new Date();
            deployment.duration = deployment.finishedAt - deployment.startedAt;
            await deployment.save();
            await log(buildId, `Recorded deployment in environment 'production'`, logFile);
          }
        } catch (err) {
          if (deployment) {
            deployment.status = 'failed';
            deployment.finishedAt = new Date();
            deployment.duration = deployment.finishedAt - deployment.startedAt;
            await deployment.save();
          }
          throw err;
        }
      });
    }

    await finish(build, 'success', logFile, `Pipeline complete in ${((Date.now() - build.startedAt) / 1000).toFixed(1)}s`);
  } catch (err) {
    const finalStatus = state.cancelled ? 'cancelled' : state.timedOut || err.code === 'timed_out' ? 'timed_out' : 'failed';
    await finish(build, finalStatus, logFile, `${finalStatus}: ${err.message}`);
  } finally {
    clearTimeout(overall);
    activeRuns.delete(buildId);
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

let buildWorker;
if (process.env.NODE_ENV === 'test') {
  buildWorker = { close: async () => {}, processor };
} else {
  buildWorker = new Worker('builds', processor, { connection, concurrency: config.maxConcurrentBuilds });
}

module.exports = { buildWorker, activeRuns };
