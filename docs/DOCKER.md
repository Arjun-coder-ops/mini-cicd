# Mini CI/CD Docker Documentation

This document describes the Dockerized setup of the Mini CI/CD project.

## Architecture

The system is split into multiple services running in containers, orchestrated by `docker-compose.yml`.

- **frontend**: Nginx container serving the built React/Vite SPA.
- **api**: Node.js API server running Express.
- **worker**: Node.js worker process executing BullMQ jobs for the CI/CD pipeline.
- **mongodb**: MongoDB database storing projects, builds, and logs.
- **redis**: Redis instance for BullMQ job queues and rate limiting (if applicable).

These services communicate over an internal Docker bridge network (`cicd_network`). Data for MongoDB and Redis is persisted in Docker volumes.

## Docker Setup & Startup

To run the full stack:

1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
2. Adjust variables in `.env` as needed.
3. Start the containers in the background:
   ```bash
   docker compose up -d
   ```
4. Verify services are running and healthy:
   ```bash
   docker compose ps
   ```

The frontend will be accessible at `http://localhost`, and the API routes at `http://localhost:3000`. Wait for the services to show a `healthy` status before sending requests.

## Known Limitations

- **Worker Environment Execution**: The CI/CD worker container executes cloned repository code directly (e.g. running `npm ci` and `npm test`). It is **not** a secure sandbox. Only use this system with trusted, allowlisted repositories.
- **Worker Dependencies**: The `worker` image includes basic tooling (git, rsync, openssh, python3, pip, and node), but repositories requiring custom build tools or additional runtime dependencies will fail unless you extend `server/Dockerfile.worker`.
- **Scaling Limits**: Due to filesystem-based cloning and logging, scaling the worker service beyond a single replica may require shared volumes or switching to a completely stateless worker approach. Currently, it's designed to run as a single container managing multiple concurrent builds.
