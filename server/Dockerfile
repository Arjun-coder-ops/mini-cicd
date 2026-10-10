FROM node:20-alpine

# Set node env
ENV NODE_ENV=production

WORKDIR /app

# Install native tools needed by CI/CD worker (git, python, rsync, openssh, bash)
RUN apk add --no-cache git rsync openssh python3 py3-pip bash && \
    git config --system --add safe.directory '*'

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY . .

# Ensure builds directory exists and is writable by node user
RUN mkdir -p /app/.tmp/cicd-builds && chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "index.js"]
