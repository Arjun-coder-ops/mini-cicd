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
  const updated = await Build.findOneAndUpdate(
    { _id: build._id, status: { $nin: ['success', 'failed', 'cancelled', 'timed_out'] } },
    { status, finishedAt, duration },
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
      const url = `${config.gitBaseUrl}/${build.repo}.git`;
      if (build.commit === 'HEAD') {
        await runCommand('git', ['clone', '--depth', '1', '--branch', build.branch, url, workDir], {}, buildId, logFile, state);
      } else {
        await runCommand('git', ['clone', '--branch', build.branch, url, workDir], {}, buildId, logFile, state);
        await runCommand('git', ['checkout', build.commit], { cwd: workDir }, buildId, logFile, state);
      }
    });

    
    const Project = require('../models/Project');
    const project = await Project.findById(build.projectId);
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
             await runCommand(cmd, args, { cwd: workDir }, buildId, logFile, state);
          
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
                 await log(buildId, 'Deployment simulated', logFile);
               } else {
                 if (!config.deployKnownHostsPath || !fs.existsSync(config.deployKnownHostsPath)) throw new Error('DEPLOY_KNOWN_HOSTS_PATH needed');
                 const dist = fs.existsSync(path.join(workDir, 'dist')) ? `${path.join(workDir, 'dist')}/` : `${workDir}/`;
                 const ssh = `ssh -i ${DEPLOY_KEY_PATH} -o UserKnownHostsFile=${config.deployKnownHostsPath} -o StrictHostKeyChecking=yes`;
                 await runCommand('rsync', ['-az', '--delete', '-e', ssh, dist, `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`], {}, buildId, logFile, state);
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

      await step('install', async () => {
        if (hasPackage) {
          if (hasLock) await runCommand('npm', ['ci', '--prefer-offline'], { cwd: workDir }, buildId, logFile, state);
          else await runCommand('npm', ['install', '--prefer-offline'], { cwd: workDir }, buildId, logFile, state);
        } else {
          await log(buildId, 'No dependency manifest found; install skipped', logFile);
        }
      });

      await step('build', async () => {
        if (!hasPackage) return log(buildId, 'No Node build step detected; build skipped', logFile);
        const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json')));
        if (pkg.scripts?.build) await runCommand('npm', ['run', 'build'], { cwd: workDir }, buildId, logFile, state);
        else await log(buildId, 'No build script; build skipped', logFile);
      });

      await step('test', async () => {
        if (!hasPackage) return log(buildId, 'No Node test runner detected; tests skipped', logFile);
        const pkg = JSON.parse(await fsp.readFile(path.join(workDir, 'package.json')));
        if (pkg.scripts?.test && !pkg.scripts.test.includes('no test')) await runCommand('npm', ['test', '--', '--passWithNoTests'], { cwd: workDir }, buildId, logFile, state);
        else await log(buildId, 'No test script; tests skipped', logFile);
      });

      await step('deploy', async () => {
        const { DEPLOY_HOST, DEPLOY_USER = 'ubuntu', DEPLOY_PATH = '/var/www/app', DEPLOY_KEY_PATH } = process.env;
        if (!DEPLOY_HOST || !DEPLOY_KEY_PATH) return log(buildId, 'Deployment simulated', logFile);
        if (!config.deployKnownHostsPath || !fs.existsSync(config.deployKnownHostsPath)) throw new Error('DEPLOY_KNOWN_HOSTS_PATH needed');
        const dist = fs.existsSync(path.join(workDir, 'dist')) ? `${path.join(workDir, 'dist')}/` : `${workDir}/`;
        const ssh = `ssh -i ${DEPLOY_KEY_PATH} -o UserKnownHostsFile=${config.deployKnownHostsPath} -o StrictHostKeyChecking=yes`;
        await runCommand('rsync', ['-az', '--delete', '-e', ssh, dist, `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`], {}, buildId, logFile, state);
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
