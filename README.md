# Personal AI Assistant — Module 1: CV-aware RAG

This is the first module of the assistant: upload your CV, ask questions about
yourself, and get answers grounded in your own document via Retrieval-Augmented
Generation. Everything else you described (Gmail, Calendar, LinkedIn, GitHub/
Bitbucket PR review, a coding agent) plugs into this same foundation later —
each becomes a new LangGraph node and a new `sourceType` in the same vector
store, not a rewrite.

## Why these choices

| Concern | Choice | Why |
|---|---|---|
| Orchestration | **LangGraph** (not a plain LangChain chain) | You want the assistant to *plan and execute* multi-step work later (draft → review → send, or retrieve PRs → comment). LangGraph models that as a graph of nodes with shared state, which a single chain can't express well. A chain here would need rewriting later; a graph just grows new nodes. |
| LLM | **Gemini 3.1 Flash-Lite** | Free tier with rate limits, current generation, cheapest paid fallback ($0.25/$1.50 per 1M tokens) if you outgrow it. Swappable in one file (`llm.provider.ts`). |
| Embeddings | **Xenova/transformers.js** (`all-MiniLM-L6-v2`, 384-dim) | Runs 100% locally, zero API cost, no network call per chunk. This is what makes ingesting a CV free no matter how many times you re-upload it. |
| Vector store | **Postgres + pgvector, HNSW index** | You said Docker Postgres now, Supabase later — Supabase *is* Postgres+pgvector, so this code doesn't change when you migrate, only `DATABASE_URL`. |
| Backend | Express + TypeScript, layered (`routes` → `modules/*` → `db`) | Each `modules/<domain>` folder (rag, embeddings, llm, agent) is self-contained enough to become its own microservice later without restructuring. |
| Frontend | Next.js (App Router) + TypeScript | Minimal now; same pattern (typed `lib/api.ts` client + route handlers) extends to a chat UI for every future module. |

## Project layout

```
ai-assistant/
├── docker-compose.yml          # Postgres + pgvector
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── config/         # env validation, DB pool
│   │       ├── db/             # SQL migrations + runner
│   │       ├── modules/
│   │       │   ├── embeddings/ # Xenova local embedding service
│   │       │   ├── parsing/    # pdf/docx/txt -> plain text
│   │       │   ├── rag/        # chunking, ingest, retrieve, repository
│   │       │   ├── llm/        # Gemini chat model factory
│   │       │   └── agent/      # LangGraph RAG graph
│   │       └── routes/         # /api/documents, /api/chat
│   └── frontend/
│       ├── app/                # page.tsx (upload + chat UI)
│       └── lib/api.ts           # typed fetch client
```

## Setup

**1. Start Postgres (with pgvector):**
```bash
docker compose up -d
```

**2. Backend:**
```bash
cd apps/backend
cp .env.example .env
# add your free Gemini key from https://aistudio.google.com/apikey to .env
npm install
npm run migrate     # creates tables + HNSW index
npm run dev          # http://localhost:4000
```

**3. Frontend (new terminal):**
```bash
cd apps/frontend
cp .env.local.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Open http://localhost:3000, upload your CV, then ask it questions about yourself.

## How a question flows through the system

1. `POST /api/documents/upload` → text extracted → chunked (800 chars, 120 overlap)
   → each chunk embedded locally via Xenova → stored in `document_chunks` with
   its `vector(384)` embedding.
2. `POST /api/chat { question }` → LangGraph runs:
   `retrieve` node embeds the question, does a cosine-similarity HNSW search in
   Postgres → `generate` node passes the top-k chunks as context to Gemini →
   returns an answer with the source chunks it used.

## What's next (not built yet, by design)

- **Gmail + Calendar**: new `modules/gmail`, `modules/calendar`, wired as new
  LangGraph nodes (`readInbox`, `draftReply`, `scheduleEvent`), reusing the same
  RAG store for context about you.
- **GitHub/Bitbucket PR review**: official GitHub MCP server as a tool the
  agent can call; results and comments also get embedded for future recall.
- **LinkedIn posting**: we'll design this once we get there — flagged earlier
  that unofficial LinkedIn automation carries ToS/account-risk considerations,
  so it needs its own discussion before writing code.
- **Coding agent**: a dedicated LangGraph subgraph (read → propose diff →
  apply), fed by the same RAG memory.

Each addition should slot into the existing `modules/` pattern and the same
Postgres store — that's the reason for the structure chosen here.
