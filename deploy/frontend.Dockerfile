# Frontend image (deployed on Northflank / any container host). Build context
# MUST be the repo root.
# `NEXT_PUBLIC_API_BASE_URL` is baked into the static bundle at build time, so
# pass the backend's public URL as --build-arg.

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /src

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Same workspace dance as the backend image.
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

# Frontend source only.
COPY apps/frontend ./apps/frontend

RUN npm run build --workspace=@ai-assistant/frontend

# ---- runner ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /src/package.json /src/package-lock.json ./
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend
EXPOSE 8080

# next start picks up $PORT (Northflank injects it for web services). In a npm
# workspace the binary is hoisted to the root node_modules/.bin, so call it by
# full path.
CMD ["sh", "-c", "/app/node_modules/.bin/next start -p ${PORT:-8080}"]