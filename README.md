# Personal AI Assistant

A full-stack personal productivity and research assistant built as a monorepo. It combines RAG over your own knowledge, multi-agent orchestration, OAuth-connected integrations, automation scheduling, and a desktop workspace assistant.

## Project overview

This project is a real working assistant, not just a prototype. The backend exposes authenticated APIs for chat, documents, search, Google/Gmail/Calendar, LinkedIn, GitHub, and scheduled automations. The frontend is a Next.js app with a chat UI, search view, integrations dashboard, agent roster, and automation management. The desktop app adds a workspace-aware coding assistant for local project work.

## Core features

### 1. Personal knowledge base with CV/document ingestion
- Upload PDF, DOCX, and TXT files into the system
- Classify them by source type: `cv`, `email`, `pr`, `linkedin`, `calendar`, or `general`
- Parse and chunk document text for vector retrieval
- Store embeddings in Postgres with pgvector
- Answer questions grounded in the user’s own uploaded data and indexed knowledge

### 2. Chat assistant with long-lived sessions
- Authenticated chat sessions stored per user
- Streaming chat responses using SSE
- Message editing and rerun flow
- Persistent assistant history and recall indexing
- Tool-call tracing and assistant metadata in chat responses

### 3. Multi-agent orchestration
- Supervisor agent routes requests to specialized agents
- Specialists include:
  - Email agent
  - Calendar agent
  - LinkedIn agent
  - GitHub agent
  - Web/general agent
  - Knowledge agent
- Each specialist can call MCP tools and backend tools within a narrow scope
- Approval-gated actions require human confirmation before sending, publishing, or creating external artifacts

### 4. Gmail and Google Calendar integration
- Google OAuth sign-in flow
- Gmail message listing and reading
- Gmail sending and bulk-send support
- Calendar event listing, creation, and deletion
- Sync Gmail and Calendar data into the personal knowledge base for later retrieval

### 5. LinkedIn integration
- LinkedIn OAuth login flow
- LinkedIn post creation, listing, and deletion
- Drafting posts through approval before they are published
- Sync recent LinkedIn activity into the personal knowledge base

### 6. GitHub integration
- GitHub auth connection and status checks
- Repository, issue, and pull request read access
- PR diff inspection and review flow
- Draft issue/comment creation queued for approval
- GitHub actions can be orchestrated through the agent system

### 7. Search across everything the assistant knows
- Unified semantic/keyword search across:
  - chat history
  - document knowledge
  - emails
  - calendar events
  - LinkedIn posts
- Results grouped by source with relevance metadata

### 8. Scheduled automations
- Create one-off, interval, or cron-based automations
- Deliver results to chat, email, or both
- Run tasks immediately or on schedule
- Automated worker wakes up and executes due jobs

### 9. Human approval workflow for sensitive actions
- Draft actions are created as pending actions
- User can approve or reject before real external operations execute
- This applies to email drafts, LinkedIn drafts, and GitHub issue/comment drafts

### 10. Desktop coding assistant
- Electron app for local workspace-aware agent work
- Connects to MCP servers and workspace filesystem tools
- Supports approval-aware tool execution in the desktop environment

### 11. Voice + UI experience
- Voice-first composer and speech-to-text support in the frontend
- Text-to-speech output for assistant responses
- Modern dashboard UI built with Next.js and MUI

## Architecture

```
Personal-Ai-Assistant/
├── docker-compose.yml
├── package.json
├── README.md
├── apps/
│   ├── backend/                 # Express + TypeScript API + RAG + agents
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   ├── modules/
│   │   │   ├── routes/
│   │   │   ├── security/
│   │   │   ├── types/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   └── package.json
│   ├── frontend/                # Next.js dashboard and chat UI
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── mcp-gmail-calendar/      # Gmail + Calendar MCP server
│   ├── mcp-linkedin/            # LinkedIn MCP server
│   ├── mcp-github/              # GitHub MCP server
│   ├── mcp-web-search/          # Web search MCP server
│   ├── mcp-filesystem/          # Filesystem MCP server
│   └── desktop/                 # Electron desktop app
└──
```

## Tech stack

- Backend: Node.js, Express, TypeScript
- Frontend: Next.js, React, MUI
- Database: PostgreSQL + pgvector
- AI orchestration: LangGraph
- LLM: Google Gemini
- Embeddings: Xenova/Transformers.js
- OAuth: Google and LinkedIn
- Desktop: Electron + Vite
- MCP: Model Context Protocol servers for external tools

## Environment setup

### 1. Start PostgreSQL
```bash
docker compose up -d
```

### 2. Backend setup
```bash
cd apps/backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

The backend listens on:
- http://localhost:4000

### 3. Frontend setup
```bash
cd apps/frontend
npm install
npm run dev
```

The frontend runs on:
- http://localhost:3000

### 4. Desktop app setup
```bash
cd apps/desktop
npm install
npm run dev
```

## Required environment variables

The backend expects a populated `.env` file based on `apps/backend/.env.example`. At minimum, configure:

- `DATABASE_URL`
- `GOOGLE_API_KEY`
- `JWT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
- `LINKEDIN_OAUTH_CLIENT_ID` and `LINKEDIN_OAUTH_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `LINKEDIN_TOKEN_ENCRYPTION_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY`
- MCP server command arguments for Gmail/Calendar, LinkedIn, GitHub, and web search

## Main backend routes

Key API groups include:

- `/api/auth` — login, signup, current-user lookup
- `/api/documents` — upload and ingest files
- `/api/chat` — chat and streaming chat endpoints
- `/api/search` — search all indexed user knowledge
- `/api/google` — Google OAuth flow
- `/api/gmail` — Gmail read/send/sync tools
- `/api/calendar` — calendar read/create/delete/sync
- `/api/linkedin` — LinkedIn OAuth and post actions
- `/api/github` — GitHub auth and sync endpoints
- `/api/actions` — pending action review flow
- `/api/automations` — scheduled task creation and execution
- `/api/agents` — live specialist roster
- `/api/sessions` — chat session management

## Working features in this repo

The repo already includes the following implemented capabilities:

- CV and document ingestion with local embeddings
- Authenticated chat system with streaming output
- Multi-agent supervisor + specialist team
- Google OAuth / Calendar / Gmail integration
- LinkedIn OAuth + post drafting
- GitHub connectivity + PR/issue review tooling
- Unified search across all indexed sources
- Scheduled automation engine
- Pending human approval before external writes
- Desktop workspace-based coding agent integration
- Voice input/output for the frontend

## Notes

This monorepo is designed around a shared user memory layer and MCP-based tool integration. The assistant can expand by adding more MCP servers and specialist agents without reworking the core architecture.

## Recommended next steps

1. Copy the backend environment example and fill in your real credentials.
2. Start Postgres and run the backend migration.
3. Log in through the frontend and upload a CV or document.
4. Connect Google, LinkedIn, and GitHub integrations from the integrations page.
5. Try the chat, search, agents, and automation flows.

## License

This project is currently set up as a local monorepo for personal productivity and AI assistant workflows. Update licensing if you plan to distribute or commercialize it.
