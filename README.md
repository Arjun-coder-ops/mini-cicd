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

Without deployment configuration, the deploy stage is simulated. With it, the runner syncs `dist` when present (otherwise the working directory) and restarts PM2. The target must already be present in `DEPLOY_KNOWN_HOSTS_PATH`.
