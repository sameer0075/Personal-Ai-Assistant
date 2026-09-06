# Deploying to Northflank

Two web services on Northflank (region: us-east-1 / Virginia):
- **backend**  — the API + agent graph + bundled MCP servers (Docker image, port 4000)
- **frontend** — the Next.js app (Docker image, port 3000)

The Dockerfiles in this folder are platform-agnostic and already build fine
(both images verified locally: backend boots, runs migrations, spawns the MCP
GitHub server with all 10 tools; frontend serves 200 on `/` and `/integrations`).

## Northflank flow (local Docker push — no VCS link needed)

### 1. One-time: link a container registry
Dashboard → **Integrations → Container Registry → Add Registry → Northflank**.
This gives you a registry URL like `registry.northflank.com/<team>/...`.

### 2. Build & push the images
Make sure Docker is running, then from the repo root:

```bash
# backend image
docker build -f deploy/backend.Dockerfile -t registry.northflank.com/<team>/ai-assistant-backend:latest .
docker push  registry.northflank.com/<team>/ai-assistant-backend:latest

# frontend image (backend URL MUST be known first — see "URLs" below)
docker build --build-arg NEXT_PUBLIC_API_BASE_URL="https://<backend-public-url>/api" \
  -f deploy/frontend.Dockerfile \
  -t registry.northflank.com/<team>/ai-assistant-frontend:latest .
docker push  registry.northflank.com/<team>/ai-assistant-frontend:latest
```

### 3. Create the two services (dashboard)
Dashboard → **Create Service → Deployment Service → "from Container Registry"**,
pick the image you pushed.

- Group both under one **Project** (e.g. `ai-assistant`).
- On each, go to **Networking → Ports**, define the port and **enable public**:
  - backend: internal port **4000** (public)
  - frontend: internal port **3000** (public)
- Northflank issues each a public URL like `https://<service>-<hash>.<region>.northflank.com`.

### 4. URL ORDER MATTERS (why it's step-by-step)
The frontend bakes the backend's URL into its static bundle at build time, so:
1. Deploy **backend** first → note its public URL.
2. Build/push **frontend** with `NEXT_PUBLIC_API_BASE_URL=<backend URL>/api` (step 2).
3. Create the **frontend** service → note its public URL.
4. Set these on the **backend** service's Runtime Environment:
   - `CORS_ORIGIN = <frontend URL>`
   - `FRONTEND_BASE_URL = <frontend URL>`
   - `GOOGLE_OAUTH_REDIRECT_URI = <backend URL>/api/google/callback`
   - `LINKEDIN_OAUTH_REDIRECT_URI = <backend URL>/api/linkedin/callback`

### 5. Environment variables
The backend needs the same vars it reads from `apps/backend/.env`. Add them on
the backend under **Runtime → Environment**. Everything except these comes
straight from `apps/backend/.env`:
- `NODE_ENV: production`
- `PORT: 4000`
- **MCP spawn args** (the image ships compiled JS, not `npx tsx`):
  ```
  MCP_GMAIL_CALENDAR_SERVER_COMMAND: node
  MCP_GMAIL_CALENDAR_SERVER_ARGS: ../mcp-gmail-calendar/dist/server.js
  MCP_LINKEDIN_SERVER_COMMAND: node
  MCP_LINKEDIN_SERVER_ARGS: ../mcp-linkedin/dist/server.js
  MCP_GITHUB_SERVER_COMMAND: node
  MCP_GITHUB_SERVER_ARGS: ../mcp-github/dist/server.js
  MCP_WEB_SEARCH_SERVER_COMMAND: node
  MCP_WEB_SEARCH_SERVER_ARGS: ../mcp-web-search/dist/server.js
  ```
- `CORS_ORIGIN`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI`,
  `LINKEDIN_OAUTH_REDIRECT_URI` (from step 4)

> Tip: Northflank lets you add all of it as a single key=value block (paste
> from your `apps/backend/.env`), then override the handful above.

### 6. OAuth redirect URIs in the provider consoles
- **Google** (console → OAuth client → Authorized redirect URIs):
  `<backend URL>/api/google/callback`
- **LinkedIn** (app → OAuth 2.0 redirect URL):
  `<backend URL>/api/linkedin/callback`

### 7. Migrations
Migrations run automatically at backend boot (all files are idempotent). No
extra step needed; just make sure the backend starts once after adding the
`DATABASE_URL`.

## About scale-to-zero / cron
Northflank web services are **always-on** (unlike Cloud Run's scale-to-zero), so
your scheduled automations (node-cron) DO run — one of the reasons Northflank is
a better fit here. Just ensure the backend has `minInstances`/replicas >= 1.
