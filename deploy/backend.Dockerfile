# Backend image (deployed on Northflank / any container host).
# Build context MUST be the repo root (monorepo layout is preserved so the
# backend can spawn the MCP servers at ../mcp-*/dist/server.js).

# ---- builder: install all workspace deps + compile the deployed TS packages ----
# Builder is Debian-based (not alpine) so npm resolves the GLIBC @img/sharp
# binaries during install - sharp is an optional dep of @xenova/transformers
# and next, and mixing musl/glibc prebuilds crashes the runner.
FROM node:22-slim AS builder
WORKDIR /src

# npm workspaces demand every workspace's package.json at install time, and
# they must match the lockfile. Copy all of them before `npm ci`.
COPY package.json package-lock.json ./
RUN mkdir -p \
    apps/backend apps/frontend \
    apps/mcp-gmail-calendar apps/mcp-linkedin apps/mcp-github apps/mcp-web-search \
    apps/mcp-filesystem apps/desktop
COPY apps/backend/package.json             apps/backend/package.json
COPY apps/frontend/package.json            apps/frontend/package.json
COPY apps/mcp-gmail-calendar/package.json  apps/mcp-gmail-calendar/package.json
COPY apps/mcp-linkedin/package.json        apps/mcp-linkedin/package.json
COPY apps/mcp-github/package.json          apps/mcp-github/package.json
COPY apps/mcp-web-search/package.json      apps/mcp-web-search/package.json
COPY apps/mcp-filesystem/package.json      apps/mcp-filesystem/package.json
COPY apps/desktop/package.json             apps/desktop/package.json

RUN npm ci

# sharp (optional dep of @xenova/transformers / next) installs its glibc
# prebuilt binary during `npm rebuild` on a glibc builder - ensure it's present.
RUN npm rebuild sharp --foreground-scripts && ls node_modules/sharp/build/Release/

# Source for the apps that actually ship in this image
COPY apps/backend apps/backend
COPY apps/mcp-github apps/mcp-github
COPY apps/mcp-gmail-calendar apps/mcp-gmail-calendar
COPY apps/mcp-linkedin apps/mcp-linkedin
COPY apps/mcp-web-search apps/mcp-web-search

RUN npm run build --workspace=@ai-assistant/backend && \
    npm run build --workspace=@ai-assistant/mcp-github && \
    npm run build --workspace=@ai-assistant/mcp-gmail-calendar && \
    npm run build --workspace=@ai-assistant/mcp-linkedin && \
    npm run build --workspace=@ai-assistant/mcp-web-search

# The migration runner reads *.sql from a folder next to its own compiled
# output (dist/db/migrations) - tsc doesn't copy .sql files, so do it here.
RUN cp -r apps/backend/src/db/migrations apps/backend/dist/db/migrations

# ---- runner: node_modules + compiled apps only ----
# NOTE: must be a glibc base (not alpine) - @xenova/transformers loads
# onnxruntime-node's prebuilt glibc binary, which 404s its dynamic linker
# loader on musl.
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /src/package.json /src/package-lock.json ./
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/apps ./apps

WORKDIR /app/apps/backend

# Migrations first (all files are idempotent, re-running is safe), then the server.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]