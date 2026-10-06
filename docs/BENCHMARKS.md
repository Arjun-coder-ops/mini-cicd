# API Benchmarks

Date: 2026-10-06T14:54:55.111Z
Environment: Node.js v22.18.0

| Connections | Req/Sec | Avg Latency | p50 | p95 | p99 | Total | Errors |
|---|---|---|---|---|---|---|---|
| 10 | 5879 | 1.28ms | 1ms | undefinedms | 7ms | 29395 | 0 |
| 50 | 5713.4 | 8.26ms | 7ms | undefinedms | 30ms | 28563 | 0 |
| 100 | 6741.2 | 14.34ms | 14ms | undefinedms | 32ms | 33703 | 0 |


## Docker API Benchmarks

Date: 2026-10-06T15:08:44Z
Environment: Dockerized Node.js v20.20.2

| Connections | Req/Sec | Avg Latency | p50 | p95 | p99 | Total | Errors |
|---|---|---|---|---|---|---|---|
| 10 | 3218.6 | 2.61ms | 2ms | undefinedms | 10ms | 15973 | 0 |
| 50 | 3798 | 12.66ms | 11ms | undefinedms | 35ms | 18986 | 0 |
| 100 | 3687.6 | 26.59ms | 22ms | undefinedms | 79ms | 18437 | 0 |
