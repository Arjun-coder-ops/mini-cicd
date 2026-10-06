FROM node:20-alpine

# Set node env
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies for native tools if needed
# The worker needs to run node/python directly? Wait, the API doesn't. 
# Oh wait, the worker container might need Python if it executes Python.
# I'll create a separate Dockerfile.worker for the worker.

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY . .

# Run as non-root
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "index.js"]
