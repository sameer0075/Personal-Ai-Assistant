import { pool } from "../../config/database.js";
import type { ChatSession, ChatMessageRecord, ToolCallTrace, ChatAttachment } from "../../types/index.js";

export const chatSessionRepository = {
  async createSession(title: string = "New Chat"): Promise<ChatSession> {
    const { rows } = await pool.query<ChatSession>(
      `INSERT INTO chat_sessions (title) VALUES ($1)
       RETURNING id, title, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [title]
    );
    return rows[0];
  },

  async getSession(id: string): Promise<ChatSession | null> {
    const { rows } = await pool.query<ChatSession>(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chat_sessions WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listSessions(): Promise<ChatSession[]> {
    const { rows } = await pool.query<ChatSession>(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chat_sessions ORDER BY updated_at DESC`
    );
    return rows;
  },

  async deleteSession(id: string): Promise<void> {
    // ON DELETE CASCADE on chat_messages.session_id handles the messages.
    // This deliberately never touches documents/document_chunks - conversation
    // memory indexed for cross-session recall is a separate table with no FK
    // here, so deleting a chat from the sidebar never erases what the agent
    // can still recall about it later.
    await pool.query(`DELETE FROM chat_sessions WHERE id = $1`, [id]);
  },

  async setTitleIfDefault(id: string, title: string): Promise<void> {
    await pool.query(`UPDATE chat_sessions SET title = $2 WHERE id = $1 AND title = 'New Chat'`, [id, title]);
  },

  async touchSession(id: string): Promise<void> {
    await pool.query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [id]);
  },

  async appendMessage(params: {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    toolCalls?: ToolCallTrace[];
    pendingActionIds?: string[];
    attachments?: ChatAttachment[];
  }): Promise<ChatMessageRecord> {
    const { rows } = await pool.query<ChatMessageRecord>(
      `INSERT INTO chat_messages (session_id, role, content, tool_calls, pending_action_ids, attachments)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, session_id AS "sessionId", role, content,
                 tool_calls AS "toolCalls", pending_action_ids AS "pendingActionIds",
                 attachments, created_at AS "createdAt"`,
      [
        params.sessionId,
        params.role,
        params.content,
        params.toolCalls ? JSON.stringify(params.toolCalls) : null,
        params.pendingActionIds ?? null,
        params.attachments ? JSON.stringify(params.attachments) : null,
      ]
    );
    await this.touchSession(params.sessionId);
    return rows[0];
  },

  /** NEW - looked up before an edit, to validate ownership/role and to know where to cut. */
  async getMessage(id: string): Promise<ChatMessageRecord | null> {
    const { rows } = await pool.query<ChatMessageRecord>(
      `SELECT id, session_id AS "sessionId", role, content,
              tool_calls AS "toolCalls", pending_action_ids AS "pendingActionIds",
              attachments, created_at AS "createdAt"
       FROM chat_messages WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  /**
   * NEW - deletes a message and everything after it in the same session
   * (by timestamp). Used when editing: the edited message and its old
   * reply (plus anything sent after it) are removed, then a fresh turn is
   * recorded in their place.
   */
  async deleteMessagesFrom(sessionId: string, fromCreatedAt: string): Promise<void> {
    await pool.query(`DELETE FROM chat_messages WHERE session_id = $1 AND created_at >= $2`, [
      sessionId,
      fromCreatedAt,
    ]);
  },

  async getRecentMessages(sessionId: string, limit: number): Promise<ChatMessageRecord[]> {
    const { rows } = await pool.query<ChatMessageRecord>(
      `SELECT id, session_id AS "sessionId", role, content,
              tool_calls AS "toolCalls", pending_action_ids AS "pendingActionIds",
              attachments, created_at AS "createdAt"
       FROM (
         SELECT * FROM chat_messages WHERE session_id = $1
         ORDER BY created_at DESC LIMIT $2
       ) recent
       ORDER BY created_at ASC`,
      [sessionId, limit]
    );
    return rows;
  },

  async getAllMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    const { rows } = await pool.query<ChatMessageRecord>(
      `SELECT id, session_id AS "sessionId", role, content,
              tool_calls AS "toolCalls", pending_action_ids AS "pendingActionIds",
              attachments, created_at AS "createdAt"
       FROM chat_messages WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );
    return rows;
  },
};