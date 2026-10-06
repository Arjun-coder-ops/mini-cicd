# Architecture

## Current Architecture

The existing system is a lightweight, single-process CI/CD server that handles webhooks and UI requests simultaneously. 

### Data Flow
- **Frontend**: React SPA using Axios, running against the Express server's `/api` routes.
- **Backend**: Node.js Express server connected to MongoDB.
- **Execution**: The server executes `child_process.spawn` locally to clone, install, build, test, and deploy (via SSH/rsync/PM2).
- **Authentication**: Single shared static token (`API_AUTH_TOKEN`) passed via Bearer auth, both for the API and the React client via an environment variable.

### Build Lifecycle
1. **Trigger**: GitHub push webhook, manual API call, or UI trigger.
2. **Validation**: HMAC webhook validation, branch/commit verification.
3. **Queue**: Build is inserted into MongoDB with `status: 'queued'`.
4. **Execution**: The Express server background loop pops queued builds, spawns shell commands.
5. **Logs**: Streams via Server-Sent Events (SSE) and writes to disk (`.tmp/cicd-builds/*.log`).
6. **Completion**: Updates status to success/failed and cleans up workspace.

## Target Architecture

The target system is a distributed, multi-tenant build and deployment platform with strong security boundaries.

### Data Flow
- **Frontend**: React Dashboard handling authentication, RBAC, and multi-project views.
- **API Server**: Node.js API that purely handles requests, queuing, and webhooks. It will no longer execute builds locally.
- **Database**: MongoDB for domain models (Users, Projects, Builds, Deployments, Secrets, Keys, Logs).
- **Message Broker**: Redis + BullMQ for asynchronous task execution.
- **Worker**: A separate Node.js process (or isolated container) that connects to BullMQ, pulls jobs, and executes them.

### Authentication & Authorization Flow
1. **User Authentication**: JWT-based login (access/refresh tokens).
2. **RBAC**: Project-level roles (OWNER, ADMIN, DEVELOPER, VIEWER).
3. **API Keys**: Scoped project API keys for external access.
4. **Webhook Security**: Delivery tracking for replay protection, idempotency keys, and HMAC signatures.

### Build & Deployment Lifecycle
1. **Trigger**: Webhook arrives, verified for signature and idempotency.
2. **Enqueue**: API verifies permissions and inserts job into Redis/BullMQ.
3. **Worker Processing**: Worker picks up job, executes isolated pipeline steps based on `.ci.yml`.
4. **Deployment**: If deploying, worker executes deployment logic (SSH/rsync) to environments (staging, production).
5. **Completion**: Worker updates MongoDB and fires webhook/events back to the system.

### Failure / Recovery Model
- **Worker Crash**: BullMQ will handle stalled jobs and retry based on configuration.
- **Webhook Replays**: Deduplicated using `X-GitHub-Delivery`.
- **Idempotency**: API handles duplicated requests gracefully.
- **Rate Limiting & Timeouts**: Enforced at the API and worker levels.
