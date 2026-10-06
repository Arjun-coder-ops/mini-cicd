const { Queue } = require('bullmq');
const { connection } = require('../redis');

let buildQueue;
if (process.env.NODE_ENV === 'test') {
  buildQueue = {
    add: async (name, data) => {
      // In tests, synchronously run the worker logic or just no-op
      const { buildWorker } = require('../workers/buildWorker');
      if (buildWorker.processor) {
        // we can run it in background for tests if needed, or just let it be queued in memory
        setTimeout(() => buildWorker.processor({ data }), 0);
      }
      return { id: 'mock-job-id' };
    }
  };
} else {
  buildQueue = new Queue('builds', { connection });
}

module.exports = buildQueue;
