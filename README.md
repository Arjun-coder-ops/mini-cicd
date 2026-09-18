# Mini CI/CD Pipeline

A portfolio CI/CD dashboard: GitHub push webhooks or authenticated manual triggers create MongoDB build records and run a five-stage pipeline with live Server-Sent Event (SSE) logs.

## Architecture

```text
React/Vite dashboard -> Express API -> MongoDB
                         |              |
                         +-> in-process pipeline runner -> Git, npm/pip, optional SSH deploy
                                                        -> filesystem logs -> SSE
```

This is an in-process runner, not Docker-isolated, distributed, or a production-grade sandbox.

## Pipeline

1. Clone an allowlisted GitHub repository.
2. Install dependencies with `npm ci` or `pip install -r requirements.txt`.
3. Run `npm run build` when present.
4. Run `npm test` when present.
5. Deploy via rsync/SSH/PM2 when configured, otherwise simulate deployment.

## Setup

```powershell
npm.cmd run install:all
Copy-Item server/.env.example server/.env
npm.cmd run dev
```

The frontend runs at `http://localhost:5174`; the backend at `http://localhost:4000`. For UI requests create `client/.env.local`:

```env
VITE_API_AUTH_TOKEN=the_same_value_as_API_AUTH_TOKEN
```

## Environment

| Variable | Required | Description |
|---|---:|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `API_AUTH_TOKEN` | Yes | Bearer token for all build APIs |
| `GITHUB_SECRET` | Yes when enabled | GitHub webhook HMAC secret |
| `WEBHOOK_VERIFICATION_ENABLED` | No | Defaults to `true`; disable only for explicit local testing |
| `ALLOWED_REPOS` | Yes | Comma-separated `owner/repository` allowlist |
| `MAX_CONCURRENT_BUILDS` | No | Process-local limit, default 2 |
| `STEP_TIMEOUT_MS` | No | Per-command timeout, default 300000 |
| `PIPELINE_TIMEOUT_MS` | No | Overall timeout, default 1200000 |
| `BUILDS_DIR` | No | Build/log directory, default `.tmp/cicd-builds` |
| `GIT_BASE_URL` | No | Git base URL, default `https://github.com`; useful for local fixtures |
| `CLIENT_URL` | No | Allowed frontend origin |
| `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_KEY_PATH` | No | Enable deployment |
| `DEPLOY_KNOWN_HOSTS_PATH` | For deploy | Existing known-hosts file for strict SSH verification |

## API and webhooks

All `/api/builds` endpoints require `Authorization: Bearer <API_AUTH_TOKEN>`. Browser SSE additionally accepts `?token=` because native `EventSource` cannot set Authorization headers. Available operations are list/stats, manual trigger, build details/logs/stream, retry, and cancel. Pagination is capped at 100.

Configure GitHub to POST `application/json` push events to `/api/webhook` with the same secret as `GITHUB_SECRET`. The server validates `X-Hub-Signature-256` against the raw request body using timing-safe SHA-256 HMAC comparison. Both webhook and manual requests require repositories in `ALLOWED_REPOS`.

## Security and reliability

Only allowlisted repositories may run, but an allowed repository's scripts still execute on the runner: this is **not a sandbox**. SSH deployment uses strict host-key checking and an explicit known-hosts file. Running processes are retained for real cancellation; cancellation and timeout terminal states cannot become success later. Temporary clone directories are removed after terminal outcomes.

Concurrency is intentionally an in-process limit, not a durable queue or distributed scheduler. A server restart loses active runner state. Python support currently detects only installation; build/test support is Node-focused.

## Testing and build

```powershell
cd server; npm.cmd test
cd client; npm.cmd run build
cd server; npm.cmd audit --omit=dev
cd client; npm.cmd audit --omit=dev
```

## Deployment

### Pipeline Target Deployment

Without target deployment configuration, the pipeline's deploy stage is simulated. When configured with `DEPLOY_HOST` and `DEPLOY_KEY_PATH`, the runner syncs `dist` (or working directory) via `rsync` over SSH and restarts PM2. The target host key must pre-exist in `DEPLOY_KNOWN_HOSTS_PATH`.

### Deploying the Mini CI/CD Application

You can host Mini CI/CD either as a unified single service or as decoupled frontend/backend services:

#### Option 1: Unified Service (Render / Railway / VPS)

The Express server serves the compiled React frontend from `client/dist` with SPA fallback routing for any non-API request.

1. **Build command**:
   ```bash
   npm run install:all && npm run build
   ```
2. **Start command**:
   ```bash
   npm start
   ```
3. **Environment variables**:
   - `MONGODB_URI`: MongoDB connection string
   - `API_AUTH_TOKEN`: Secret Bearer token for API authentication
   - `ALLOWED_REPOS`: Comma-separated list of `owner/repo`
   - `GITHUB_SECRET`: GitHub webhook secret
   - `CLIENT_URL`: URL of the app (e.g. `https://mini-cicd.onrender.com`)
4. **Health check endpoint**:
   - `/api/health` returns `200 OK` with database status and uptime. Returns `503` if MongoDB disconnects.

#### Option 2: Decoupled Deployment (Vercel + Cloud Backend)

1. **Backend (Render / Fly.io / Railway)**:
   - Root directory: `server`
   - Build: `npm install`
   - Start: `npm start`
   - Set `CLIENT_URL=https://your-app.vercel.app` for strict CORS.
2. **Frontend (Vercel / Netlify / Cloudflare Pages)**:
   - Root directory: `client`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `VITE_API_AUTH_TOKEN=your_api_auth_token`
   - Configure rewrite in `vercel.json` to proxy `/api/*` to your backend URL.

### Process Resilience & Recovery

- **Orphaned build recovery**: On startup, the server automatically recovers builds left in `queued` or `running` state from an unexpected crash or container restart, transitioning them to `failed`.
- **Graceful shutdown**: When receiving `SIGTERM` or `SIGINT`, active runner processes are terminated, runs marked cancelled, and database connections closed cleanly within a 10-second window.
