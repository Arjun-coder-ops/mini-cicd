const autocannon = require('autocannon');
const { spawn } = require('child_process');
const fs = require('fs');

const server = spawn('node', ['index.js'], { env: { ...process.env, NODE_ENV: 'test', PORT: 3001 } });

async function runBenchmark(connections) {
  return new Promise((resolve) => {
    console.log(`Running benchmark with ${connections} connections...`);
    const instance = autocannon({
      url: 'http://localhost:3001/api/health',
      connections,
      pipelining: 1,
      duration: 5
    }, (err, result) => {
      if (err) {
        console.error('Benchmark failed', err);
        resolve(null);
      } else {
        const stats = {
          connections,
          requestsPerSec: result.requests.average,
          latencyAvg: result.latency.average,
          p50: result.latency.p50,
          p95: result.latency.p95,
          p99: result.latency.p99,
          totalRequests: result.requests.total,
          errors: result.errors,
          timeouts: result.timeouts
        };
        resolve(stats);
      }
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

server.stdout.on('data', async data => {
  if (data.toString().includes('CI/CD server on port')) {
    console.log('Server started, running benchmark...');
    
    const results = [];
    for (const conn of [10, 50, 100]) {
      const res = await runBenchmark(conn);
      if (res) results.push(res);
      // Wait a bit between runs
      await new Promise(r => setTimeout(r, 2000));
    }
    
    server.kill();
    
    let md = '# API Benchmarks\\n\\n';
    md += `Date: ${new Date().toISOString()}\\n`;
    md += `Environment: Node.js ${process.version}\\n\\n`;
    md += '| Connections | Req/Sec | Avg Latency | p50 | p95 | p99 | Total | Errors |\\n';
    md += '|---|---|---|---|---|---|---|---|\\n';
    for (const r of results) {
      md += `| ${r.connections} | ${r.requestsPerSec} | ${r.latencyAvg}ms | ${r.p50}ms | ${r.p95}ms | ${r.p99}ms | ${r.totalRequests} | ${r.errors + r.timeouts} |\\n`;
    }
    
    fs.writeFileSync('../docs/BENCHMARKS.md', md);
    console.log('Saved to docs/BENCHMARKS.md');
    process.exit(0);
  }
});

server.stderr.on('data', data => {
  console.error(data.toString());
});
