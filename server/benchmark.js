const autocannon = require('autocannon');
const { spawn } = require('child_process');

// Run the server
const server = spawn('node', ['index.js'], { env: { ...process.env, NODE_ENV: 'test' } });

server.stdout.on('data', data => {
  if (data.toString().includes('CI/CD server on port')) {
    console.log('Server started, running benchmark...');
    const instance = autocannon({
      url: 'http://localhost:3000/api/health',
      connections: 100,
      pipelining: 1,
      duration: 5
    }, (err, result) => {
      server.kill();
      if (err) {
        console.error('Benchmark failed', err);
      } else {
        console.log('Benchmark Results:');
        console.log(`Req/Sec: ${result.requests.average}`);
        console.log(`Latency (ms): ${result.latency.average}`);
        console.log(`Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
        console.log(`Total Requests: ${result.requests.total}`);
      }
    });

    autocannon.track(instance, { renderProgressBar: true });
  }
});
