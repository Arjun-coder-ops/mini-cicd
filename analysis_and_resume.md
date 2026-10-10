# Mini CI/CD - Technical Analysis & Resume Guide

This document is generated based *strictly* on the actual codebase implementation without embellishments.

## PHASE 1 — DEEP REPOSITORY INSPECTION
- **Architecture**: A Monorepo with `client` (React/Vite) and `server` (Node.js/Express/MongoDB/Redis).
- **Authentication**: JWT-based authentication with separate short-lived `accessToken` and long-lived HTTPOnly strict cookie `refreshToken`. Standard stateless validation (no stateful token rotation/revocation table).
- **Authorization/RBAC**: Full multi-tenant project isolation via `ProjectMember` model with strict roles (OWNER, ADMIN, DEVELOPER, VIEWER).
- **API-key System**: Implemented in `ApiKey.js` with SHA-256 hashed storage, scoped per-project.
- **Build Pipeline & Workers**: BullMQ manages the asynchronous job queue running on Redis. The worker process clones the GitHub repository and runs native shell commands (`spawn`) directly on the host (NO sandbox isolation). 
- **GitHub Webhooks**: Full timing-safe SHA-256 HMAC signature verification. 
- **Replay Protection**: Enforced using `WebhookDelivery` model utilizing unique `deliveryId` and `payloadHash`.
- **Logs/SSE**: Real-time Server-Sent Events (SSE) stream build logs directly to the client.
- **Secrets Management**: Secrets are encrypted at rest using `AES-256-CBC` (not GCM).
- **Metrics**: A Prometheus-style text endpoint exists exposing total builds, success/fail ratios, and average durations.
- **Docker**: Full Dockerization exists with a 5-container `docker-compose.yml` configuration (frontend, api, worker, mongodb, redis) utilizing internal bridge networking and health checks.

## PHASE 2 — BUILD THE TRUE ARCHITECTURE

**User Flow**:
User → React/Vite Frontend → Express API → JWT/API-Key Auth → Project Authorization Check → Build Request Created (MongoDB) → Job pushed to BullMQ (Redis) → Worker Container picks up job → Pipeline executed via native OS `spawn` → Logs written to disk and emitted via SSE → Database Updated → Deployment step executes `rsync` over SSH.

**Webhook Flow**:
GitHub push event → Express API (`/api/webhook`) → Timing-safe SHA-256 HMAC verification → Replay protection via `deliveryId` in MongoDB → Repository resolution → Build created → BullMQ.

**Technologies Actually Used**:
- React 18, Vite
- Node.js (v20/v22), Express
- MongoDB (Mongoose), Redis (ioredis)
- BullMQ
- GitHub Webhooks (HMAC verification)
- Server-Sent Events (SSE)
- JWT (with HTTPOnly cookies for refresh)
- API Keys (SHA-256 hashed)
- AES-256-CBC encryption for secrets
- Prometheus-style metrics
- Docker & Docker Compose (Nginx for SPA routing)

## PHASE 3 — SECURITY ANALYSIS
- **Cross-project IDOR protection**: IMPLEMENTED (via `requireProjectRole` middleware).
- **RBAC**: IMPLEMENTED (OWNER, ADMIN, DEVELOPER, VIEWER).
- **Scoped API keys**: IMPLEMENTED (Hashed at rest, verified against `projectId`).
- **Webhook HMAC verification**: IMPLEMENTED (Timing-safe SHA-256).
- **Webhook replay protection**: IMPLEMENTED (`WebhookDelivery` unique index).
- **Encrypted secrets**: IMPLEMENTED (AES-256-CBC).
- **Strict SSH Deployment**: IMPLEMENTED (`StrictHostKeyChecking=yes` with explicit `UserKnownHostsFile`).
- **Sandbox Isolation**: **NOT IMPLEMENTED** (Worker executes arbitrary repo code directly on its host OS).
- **Refresh-token rotation/revocation**: **NOT IMPLEMENTED** (Stateless JWTs only).

## PHASE 4 — CI/CD ENGINEERING DEPTH
- **Build Execution**: Builds run sequentially per pipeline, executing commands from a `.ci.yml` file or falling back to default NPM scripts. Commands are executed directly on the worker via `child_process.spawn`. 
- **Queuing & Concurrency**: Handled entirely by BullMQ with a configurable in-process concurrency limit.
- **Retries**: BullMQ handles exponential backoff retries (up to 3 attempts) for failed job processing.
- **Orphan Recovery**: On API startup, a script reaps "running/queued" builds left in a ghost state due to a crash, marking them "failed".
- **Real-time Logs**: Handled by an in-memory `Map` binding SSE client connections to running build IDs, broadcasting `stdout`/`stderr` events instantly.

## PHASE 5 — PERFORMANCE / BENCHMARK ANALYSIS
- **Tool**: `autocannon` testing the `/api/health` endpoint.
- **Native Node.js**: ~6,741 Req/Sec at 100 concurrent connections.
- **Dockerized Node.js**: ~3,687 Req/Sec at 100 concurrent connections.
- **Latency**: Native p99 is ~32ms; Docker p99 is ~79ms.
- **Significance**: Proves the API router and Mongoose connection pool are stable under concurrent load. Do NOT claim this as "pipeline throughput" or "builds per second".

## PHASE 6 — TESTING ANALYSIS
- **Framework**: Native Node.js Test Runner (`node --test`).
- **Count**: 13 passing tests.
- **Coverage**: Tests validate API authentication, webhook signature validation, idempotency (duplicate delivery), orphaned build recovery, input validation, and health checks.

## PHASE 7 — DOCKER ANALYSIS
- **Configuration**: Uses `docker-compose.yml` with 5 services.
- **Images**: API and Worker use `node:20-alpine`; Frontend uses multi-stage builds ending in `nginx:alpine` (unprivileged `nginx` user).
- **Security**: Containers run as non-root users (`node`, `nginx`).
- **Isolation**: Docker isolates the worker from the host OS, but **does not isolate builds from each other**. Multiple builds running on the same worker container share the same filesystem and memory space.

---

## FINAL OUTPUTS

### 1. BEST PROJECT TITLE
**Mini CI/CD Platform** (or **Distributed CI/CD Pipeline**)

### 2. BEST TECH STACK LINE
Node.js, Express, React, MongoDB, Redis, BullMQ, Docker, Nginx, Server-Sent Events (SSE)

### 3. BEST 3 RESUME BULLETS
- Architected a distributed CI/CD platform using Node.js and React, implementing multi-tenant project isolation and role-based access control (RBAC) backed by MongoDB.
- Engineered a reliable asynchronous build execution engine utilizing Redis and BullMQ, featuring exponential backoff retries, orphan-job recovery, and real-time Server-Sent Events (SSE) for live log streaming.
- Hardened system security by implementing timing-safe SHA-256 HMAC webhook verification, cryptographic replay protection, and AES-256-CBC encryption for environment secrets at rest.

### 4. BEST 2 RESUME BULLETS
- Architected a containerized CI/CD pipeline engine utilizing Node.js, Redis, and BullMQ to process asynchronous builds with exponential backoff and real-time Server-Sent Events (SSE) log streaming.
- Implemented robust multi-tenant security featuring timing-safe SHA-256 GitHub webhook verification, cryptographic replay protection, AES-256-CBC secret encryption, and strict role-based access control (RBAC).

### 5. BEST README DESCRIPTION
Mini CI/CD is a distributed pipeline execution engine built with Node.js, React, MongoDB, and Redis. It provides multi-tenant project environments where GitHub push events trigger asynchronous build pipelines managed by BullMQ. The platform features strict RBAC, AES-256-CBC encrypted secrets, timing-safe HMAC webhook verification with replay protection, and real-time pipeline observability via Server-Sent Events (SSE). The entire stack is fully Dockerized for reproducible deployments.

### 6. BEST LINKEDIN DESCRIPTION
I built a distributed CI/CD platform from scratch using Node.js, Redis, and React. It processes GitHub webhooks securely using timing-safe HMAC verification and replay protection, schedules builds via BullMQ with exponential backoff, and streams live execution logs to the frontend using Server-Sent Events (SSE). To ensure data security, I implemented multi-tenant RBAC and AES-256-CBC encryption for environment secrets.

### 7. BEST 60–90 SECOND INTERVIEW EXPLANATION
"I built a custom CI/CD platform to understand the distributed systems challenges behind tools like GitHub Actions. 
The architecture consists of a React frontend, a Node.js Express API, MongoDB for persistence, and Redis powering a BullMQ asynchronous job queue. 
When a GitHub webhook comes in, the API verifies the HMAC signature using timing-safe comparisons and checks a MongoDB unique index to prevent replay attacks. The job is then pushed to Redis where a worker container picks it up, clones the repo, and runs the build natively via Node's `child_process.spawn`.
The hardest engineering challenge was real-time observability. I implemented Server-Sent Events (SSE) where the worker broadcasts `stdout` and `stderr` streams directly to the Express API, which fans them out to connected clients.
For reliability, I utilized BullMQ's exponential backoff for failed jobs and wrote a startup script that reaps 'ghost' jobs if a worker container crashes unexpectedly. 
If I were to improve it next, I would implement true per-build container sandboxing, because right now the worker executes arbitrary repository code directly on its own filesystem, which limits security in a multi-tenant environment."

### 8. TOP 10 TECHNICAL TALKING POINTS
1. Using BullMQ and Redis for reliable async job processing and exponential backoff.
2. Webhook security: Timing-safe SHA-256 HMAC verification.
3. Idempotency: Defeating webhook replay attacks using unique `deliveryId` indexing.
4. Real-time observability using Server-Sent Events (SSE) vs WebSockets.
5. Orphan job recovery: Reaping ghost jobs upon server restart.
6. Multi-tenancy: Project isolation and RBAC implementation.
7. Cryptography: Encrypting user secrets at rest using AES-256-CBC and `crypto.createCipheriv`.
8. API Key design: Storing SHA-256 hashes of API keys rather than plaintext.
9. Safely spawning child processes in Node.js and handling standard I/O streams.
10. Docker containerization, non-root users, and healthcheck orchestration.

### 9. TOP 10 QUESTIONS AN INTERVIEWER MAY ASK
1. *Why did you choose SSE over WebSockets for live logs?* (Answer: Unidirectional data flow, native browser reconnection, simpler scaling).
2. *How exactly does your replay protection work?* (Answer: Tracking GitHub's `X-GitHub-Delivery` ID in a unique MongoDB index).
3. *What happens if the worker crashes mid-build?* (Answer: BullMQ stalls the job, and the API's `recoverOrphanedBuilds` reaps it on restart).
4. *How are API keys generated and validated?* (Answer: Prefix generated, random string hashed via SHA-256 and stored; compared at runtime).
5. *If a user submits a malicious `.ci.yml` file, what prevents them from deleting your server?* (Answer: Acknowledge the lack of sandbox isolation. The worker runs as a non-root user in Docker, but it is fundamentally a trusted-code-only system right now).
6. *How did you handle database connections during high-load benchmarking?*
7. *Why AES-256-CBC and not AES-256-GCM for secrets?* (Answer: Be honest if you didn't need authenticated encryption, but acknowledge GCM is better practice).
8. *How do you prevent Race Conditions when updating the build status from the worker?*
9. *How does BullMQ guarantee at-least-once delivery?*
10. *How would you scale this to 1,000 concurrent builds?* (Answer: Move to ephemeral Kubernetes pods or AWS ECS tasks per build, decoupling the worker from the host).

### 10. RED FLAGS / CLAIMS I MUST NOT MAKE
- 🚫 **Do NOT claim "Sandboxed Build Environments".** The worker spawns child processes directly on its own OS.
- 🚫 **Do NOT claim "Stateful Refresh Token Rotation".** You issue refresh tokens as HTTPOnly cookies, but you do not track/revoke them in the database.
- 🚫 **Do NOT claim "7,000 Builds per Second".** The benchmark tested the lightweight `/api/health` endpoint, not the pipeline execution throughput.
- 🚫 **Do NOT claim "AES-256-GCM".** The code explicitly uses `aes-256-cbc`.
- 🚫 **Do NOT claim "Enterprise-grade".** While it is a fantastic project, true enterprise CI/CD requires ephemeral isolated runners, granular audit trailing, and distributed state management. Call it "production-oriented" instead.

---
### INTERVIEW DEFENSE MATRIX

| Resume Claim | Evidence in Code | Where | How I Should Explain It |
| :--- | :--- | :--- | :--- |
| **Multi-tenant project isolation & RBAC** | `ProjectMember` model validates user roles (OWNER, ADMIN, etc.) per project | `server/middleware/auth.js` `requireProjectRole` | "I built middleware that intercepts requests, checks the user's ID against the ProjectMember collection, and validates their enum role." |
| **Async builds with BullMQ & Redis** | `buildQueue.add(...)` pushes to Redis; `new Worker()` consumes it | `server/utils/pipeline.js` & `server/workers/buildWorker.js` | "I decoupled the API from build execution by having the API publish job IDs to a Redis queue, which a separate worker loop consumes." |
| **Exponential backoff retries** | `backoff: { type: 'exponential', delay: 2000 }` | `server/utils/pipeline.js` | "I utilized BullMQ's native backoff options so if a temporary failure occurs, it waits incrementally longer before retrying up to 3 times." |
| **Real-time SSE log streaming** | `sseClients = new Map()`, `res.write('data: ...')` | `server/utils/pipeline.js` | "I mapped running build IDs to a Set of Express response objects. As `child_process` emitted `stdout`, I wrote formatted SSE strings directly to the clients." |
| **Timing-safe HMAC webhook verification** | `crypto.timingSafeEqual` against `x-hub-signature-256` | `server/routes/webhook.js` | "I took the raw buffer of the GitHub webhook, hashed it with my secret using crypto's HMAC, and compared it using timing-safe equal to prevent timing attacks." |
| **Cryptographic replay protection** | `WebhookDelivery.create({ deliveryId })` catching `err.code === 11000` | `server/routes/webhook.js` | "I extracted the unique delivery ID from GitHub's headers and attempted to insert it into a MongoDB collection with a unique index. If it threw a duplicate key error, I dropped the request." |
| **AES-256-CBC secret encryption** | `crypto.createCipheriv('aes-256-cbc', ...)` | `server/routes/secrets.js` | "When a user saves an environment variable, I generate a random IV, encrypt the value using AES-256-CBC, and store the IV prepended to the ciphertext." |
