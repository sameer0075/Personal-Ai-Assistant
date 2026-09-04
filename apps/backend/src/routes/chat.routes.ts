import { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { runAssistantAgent, streamAssistantAgent } from "../modules/agent/assistant-agent.graph.js";
import { extractTextFromFile } from "../modules/parsing/file-parser.js";
import { truncateAttachmentText } from "../modules/chat-sessions/attachment-format.js";
import {
  getOrCreateSession,
  getHistoryForAgent,
  recordTurn,
  editUserMessage,
  indexTurnForRecall,
} from "../modules/chat-sessions/chat-session.service.js";
import type { ChatAttachment } from "../types/index.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";

export const chatRoutes = Router();
chatRoutes.use(requireAuth);

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const chatRequestSchema = z.object({
  question: z.string().min(1, "question is required"),
  sessionId: z.string().uuid().optional(),
});

async function buildAttachment(file: Express.Multer.File): Promise<ChatAttachment> {
  const rawText = await extractTextFromFile(file.buffer, file.originalname);
  const { text, truncated } = truncateAttachmentText(rawText);
  return { filename: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, text, truncated };
}

function sendEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function streamTurn(
  res: Response,
  userId: string,
  sessionId: string,
  question: string,
  attachments?: ChatAttachment[]
): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  res.on("close", () => clearInterval(heartbeat));

  sendEvent(res, "session", { sessionId });

  try {
    const history = await getHistoryForAgent(sessionId);

    for await (const event of streamAssistantAgent(userId, question, history, attachments)) {
      if (event.type === "token") {
        sendEvent(res, "token", { content: event.content });
      } else if (event.type === "tool_start") {
        sendEvent(res, "tool_start", { tool: event.tool, input: event.input });
      } else if (event.type === "tool_end") {
        sendEvent(res, "tool_end", { tool: event.tool, output: event.output });
      } else if (event.type === "error") {
        sendEvent(res, "error", { message: event.message });
      } else if (event.type === "done") {
        const { userMessageId, assistantMessageId } = await recordTurn(sessionId, question, event.data, attachments);
        indexTurnForRecall(userId, sessionId, question, event.data.answer);
        sendEvent(res, "complete", { sessionId, userMessageId, assistantMessageId, ...event.data });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendEvent(res, "error", { message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

chatRoutes.post("/", attachmentUpload.single("file"), async (req, res) => {
  try {
    const { question, sessionId: requestedSessionId } = chatRequestSchema.parse(req.body);
    const session = await getOrCreateSession(req.userId!, requestedSessionId);

    const attachments = req.file ? [await buildAttachment(req.file)] : undefined;

    const history = await getHistoryForAgent(session.id);
    const result = await runAssistantAgent(req.userId!, question, history, attachments);

    const { userMessageId, assistantMessageId } = await recordTurn(session.id, question, result, attachments);
    indexTurnForRecall(req.userId!, session.id, question, result.answer);

    res.json({ sessionId: session.id, userMessageId, assistantMessageId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: message });
  }
});

chatRoutes.post("/stream", attachmentUpload.single("file"), async (req, res) => {
  let parsed: { question: string; sessionId?: string };
  try {
    parsed = chatRequestSchema.parse(req.body);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Unknown error" });
    return;
  }

  let attachments: ChatAttachment[] | undefined;
  if (req.file) {
    try {
      attachments = [await buildAttachment(req.file)];
    } catch (err) {
      res.status(422).json({ error: err instanceof Error ? err.message : "Unknown error" });
      return;
    }
  }

  let session;
  try {
    session = await getOrCreateSession(req.userId!, parsed.sessionId);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Unknown error" });
    return;
  }

  await streamTurn(res, req.userId!, session.id, parsed.question, attachments);
});

const editRequestSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  question: z.string().min(1, "question is required"),
});

chatRoutes.post("/edit", async (req, res) => {
  try {
    const { sessionId, messageId, question } = editRequestSchema.parse(req.body);
    await editUserMessage(sessionId, req.userId!, messageId);

    const history = await getHistoryForAgent(sessionId);
    const result = await runAssistantAgent(req.userId!, question, history);

    const { userMessageId, assistantMessageId } = await recordTurn(sessionId, question, result);
    indexTurnForRecall(req.userId!, sessionId, question, result.answer);

    res.json({ sessionId, userMessageId, assistantMessageId, ...result });
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

chatRoutes.post("/edit/stream", async (req, res) => {
  let parsed: { sessionId: string; messageId: string; question: string };
  try {
    parsed = editRequestSchema.parse(req.body);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Unknown error" });
    return;
  }

  try {
    await editUserMessage(parsed.sessionId, req.userId!, parsed.messageId);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : "Unknown error" });
    return;
  }

  await streamTurn(res, req.userId!, parsed.sessionId, parsed.question);
});