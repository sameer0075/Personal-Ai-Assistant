import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "../llm/llm.provider.js";
import { searchKnowledgeBaseTool } from "./tools/rag-search.tool.js";
import { gmailDraftMessageTool } from "./tools/gmail-draft.tool.js";
import { linkedinDraftPostTool } from "./tools/linkedin-draft.tool.js";
import { loadMcpToolsForAgent } from "../mcp/mcp-tool-adapter.js";
import { getPendingAction } from "../actions/pending-actions.service.js";
import { formatContentForAgent } from "../chat-sessions/attachment-format.js";
import type { AssistantAnswer, PendingAction, ToolCallTrace, ChatAttachment } from "../../types/index.js";

const SYSTEM_PROMPT = [
  "You are the user's personal AI assistant with real access to their tools:",
  "- search_knowledge_base: their CV plus any emails/calendar events/LinkedIn posts already indexed.",
  "- gmail_list_messages / gmail_get_message: read-only access to their real Gmail inbox.",
  "- gmail_draft_message: prepares an email and queues it for the user's approval - it does NOT send anything. Set attachCv: true when the user asks to send/share/attach their CV or resume.",
  "- calendar_list_events / calendar_create_event / calendar_delete_event: their real calendar.",
  "- linkedin_list_recent_posts: their own tracked LinkedIn post history.",
  "- linkedin_draft_post: prepares a LinkedIn post and queues it for the user's approval - it does NOT publish anything.",
  "- generate_image: generates an AI image and returns a short imageRef (not the image itself).",
  "- web_search / web_fetch: live web search, for anything not covered by the tools above.",
  "",
  "The user can also attach a file directly to their message (a contract, a spreadsheet, a one-off document).",
  "When that happens its full text appears inline in the message below, wrapped in '--- Attached file: ... ---'.",
  "That text is NOT in the knowledge base and search_knowledge_base will not find it - just read it directly",
  "from the message. It's scoped to this conversation only, distinct from anything the user has separately",
  "uploaded to their permanent knowledge base.",
  "",
  "Plan before acting, in this priority order: (1) for anything about the user's background, past emails,",
  "schedule, or prior posts, search the knowledge base first. (2) For anything requiring the CURRENT inbox,",
  "calendar, or LinkedIn state, call the relevant tool directly rather than guessing. (3) If the",
  "answer isn't in the knowledge base and isn't something Gmail/Calendar/LinkedIn would know - general",
  "knowledge, current events, facts about the outside world, anything time-sensitive - use",
  "web_search. Don't web_search things the knowledge base or connected tools can already answer.",
  "",
  "HUMAN APPROVAL IS MANDATORY for every outgoing email and every LinkedIn post - you have no tool that",
  "sends an email or publishes a post directly, and that is intentional, not a bug. When asked to write",
  "and send an email, or write and publish a LinkedIn post: call gmail_draft_message or linkedin_draft_post",
  "with real, complete content (never invent email addresses, event details, or post content that wasn't",
  "provided or retrieved). That tool only creates a draft the user will see, edit if they want, and",
  "explicitly approve or reject in the app - it does not send or publish anything itself. In your final",
  "answer, tell the user the draft is ready for their review (e.g. \"I've drafted that email to jane@example.com",
  "- review and approve it whenever you're ready\"). Never say or imply that an email was sent or a post was",
  "published unless a tool result explicitly confirms it was.",
  "",
  "Calendar events (create/delete) are not part of this approval queue and may still be called directly,",
  "as before - state briefly what you're about to do in your final answer so the user can see it happened.",
  "",
  "LinkedIn boundary: you may research topics, plan a content strategy, draft posts (via linkedin_draft_post)",
  "when asked. You have NO tool for, and must never attempt to simulate or describe performing, automated",
  "connecting, following, liking, commenting, messaging, or any other reach/growth activity on the user's",
  "behalf - that violates LinkedIn's terms and risks the account being restricted. 'Help me grow my reach'",
  "means planning and drafting better content, not automation.",
  "",
  "Note: linkedin_draft_post is text-only in this build - if the user asks for an image on the post, say",
  "images aren't supported by the drafting flow yet and draft the text-only post instead.",
  "",
  "When a tool call fails, tell the user the exact error message the tool returned, verbatim. Do not guess,",
  "soften, or invent a different explanation - an honest 'here's the exact error' is always better than a",
  "nicer-sounding but made-up one.",
].join("\n");

type CompiledAgent = ReturnType<typeof createReactAgent>;
let agentPromise: Promise<CompiledAgent> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TOKEN_BASE_DELAY_MS = 18;
const TOKEN_JITTER_MS = 12;

async function getAgent(): Promise<CompiledAgent> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const mcpTools = await loadMcpToolsForAgent();
      return createReactAgent({
        llm: createChatModel(),
        tools: [searchKnowledgeBaseTool, gmailDraftMessageTool, linkedinDraftPostTool, ...mcpTools],
        prompt: SYSTEM_PROMPT,
      });
    })().catch((err) => {
      agentPromise = null;
      throw err;
    });
  }
  return agentPromise;
}

function extractToolCallTrace(messages: BaseMessage[]): ToolCallTrace[] {
  const trace: ToolCallTrace[] = [];
  for (const message of messages) {
    if (message instanceof AIMessage && message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        const resultMessage = messages.find(
          (m): m is ToolMessage => m instanceof ToolMessage && m.tool_call_id === call.id
        );
        trace.push({
          tool: call.name,
          input: call.args,
          output: typeof resultMessage?.content === "string" ? resultMessage.content : undefined,
        });
      }
    }
  }
  return trace;
}

const DRAFT_TOOL_NAMES = new Set(["gmail_draft_message", "linkedin_draft_post"]);

async function extractPendingActions(toolCalls: ToolCallTrace[]): Promise<PendingAction[]> {
  const ids = toolCalls
    .filter((call) => DRAFT_TOOL_NAMES.has(call.tool) && typeof call.output === "string")
    .map((call) => {
      try {
        return (JSON.parse(call.output as string) as { pendingActionId?: string }).pendingActionId;
      } catch {
        return undefined;
      }
    })
    .filter((id): id is string => Boolean(id));

  const actions = await Promise.all(ids.map((id) => getPendingAction(id)));
  return actions.filter((a): a is PendingAction => a !== null);
}

/**
 * Structured, incremental events emitted while the agent runs, so the caller
 * (an SSE route) can forward progress to the client as it happens instead of
 * blocking on the entire tool-calling loop:
 * - "token": a piece of the final answer text (see the big comment on
 *   `streamAssistantAgent` for why this is chunked rather than truly
 *   per-token from the model)
 * - "tool_start" / "tool_end": the agent invoked a tool (RAG search, Gmail,
 *   Calendar, LinkedIn, MCP, web search, ...) - this is normally the slowest
 *   part of a turn (network calls, embeddings, subprocess round-trips), so
 *   surfacing it lets the UI show "Searching knowledge base…" etc. instead of
 *   a single opaque spinner.
 * - "done": final structured payload, same shape `runAssistantAgent` used to
 *   return in one shot.
 * - "error": something threw; the generator stops after this.
 */
export type AgentStreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_end"; tool: string; output?: string }
  | { type: "done"; data: AssistantAnswer }
  | { type: "error"; message: string };

function chunkContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

/**
 * Splits a finished answer into small pieces so it can be sent to the client
 * as a sequence of "token" events - used because we can no longer stream
 * real per-token output from the model (see the big comment on
 * `streamAssistantAgent` below for why), but the UI still gets the same
 * fast, incremental "typing" feel.
 */
function chunkForDisplay(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

export async function* streamAssistantAgent(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  attachments?: ChatAttachment[]
): AsyncGenerator<AgentStreamEvent> {
  try {
    const agent = await getAgent();

    const historyMessages = history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    const currentTurnContent = formatContentForAgent(question, attachments);
    const allMessages: BaseMessage[] = [...historyMessages, new HumanMessage(currentTurnContent)];
    let finalAnswer: string | null = null;
    // tool_call_id -> tool name, so the ToolMessage that comes back later
    // (which only carries the id, not the name) can be reported correctly.
    const pendingToolNames = new Map<string, string>();

    /**
     * IMPORTANT: this deliberately does NOT use `agent.streamEvents()` or
     * `streamMode: "messages"`.
     *
     * Either of those forces LangGraph to attach a callback with
     * `lc_prefer_streaming = true` to the model call so it can emit
     * per-token chunks. For Gemini specifically this is a known,
     * currently-unfixed upstream bug (langchain-ai/langchainjs#10067): it
     * pushes ChatGoogleGenerativeAI down a chunk-aggregation code path where
     * `AIMessageChunk.concat()` only preserves `tool_call_chunks`, but
     * Gemini's wrapper only ever populates `tool_calls` (not chunks) - so the
     * merged message silently ends up with `tool_calls: []`, even though the
     * model actually wanted to call a tool. In practice that meant the agent
     * would just answer in plain text instead of calling
     * gmail_draft_message/linkedin_draft_post - it looked like the model
     * "changed its mind" about drafting anything, when really the tool call
     * it made was being thrown away during chunk merging.
     *
     * `streamMode: "updates"` sidesteps this entirely: each node (the model
     * call, the tool-execution step) still runs via a plain `.invoke()`
     * under the hood, so tool calls come through intact - we just get the
     * new message(s) after each step instead of individual tokens. We derive
     * our own tool_start/tool_end from those messages below (an AIMessage
     * with tool_calls means a tool is about to run; the matching ToolMessage
     * means it finished), and fake token-by-token streaming afterwards by
     * chunking the final (fully correct) answer - same fast "typing" feel,
     * correct tool-calling behavior underneath.
     */
    const stream = await agent.stream({ messages: allMessages }, { streamMode: "updates" });

    for await (const update of stream) {
      // `update` is like `{ agent: { messages: [...] } }` or
      // `{ tools: { messages: [...] } }` - one entry per node that ran this step.
      const nodeUpdates = update as Record<string, { messages?: BaseMessage[] } | undefined>;
      for (const nodeUpdate of Object.values(nodeUpdates)) {
        if (!nodeUpdate?.messages) continue;
        for (const msg of nodeUpdate.messages) {
          allMessages.push(msg);

          if (msg instanceof AIMessage && msg.tool_calls?.length) {
            for (const call of msg.tool_calls) {
              if (call.id) pendingToolNames.set(call.id, call.name);
              yield { type: "tool_start", tool: call.name, input: call.args };
            }
          } else if (msg instanceof ToolMessage) {
            const tool = (msg.tool_call_id && pendingToolNames.get(msg.tool_call_id)) || msg.name || "tool";
            yield { type: "tool_end", tool, output: chunkContentToText(msg.content) };
          } else if (msg instanceof AIMessage && typeof msg.content === "string" && msg.content) {
            finalAnswer = msg.content;
          }
        }
      }
    }

    if (finalAnswer == null) {
      yield { type: "error", message: "Agent finished without producing an answer" };
      return;
    }

    for (const piece of chunkForDisplay(finalAnswer)) {
      yield { type: "token", content: piece };
      await sleep(TOKEN_BASE_DELAY_MS + Math.random() * TOKEN_JITTER_MS);
    }

    const toolCalls = extractToolCallTrace(allMessages);
    const pendingActions = await extractPendingActions(toolCalls);

    yield { type: "done", data: { answer: finalAnswer, toolCalls, pendingActions } };
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Non-streaming convenience wrapper - drains streamAssistantAgent and returns the final payload. */
export async function runAssistantAgent(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  attachments?: ChatAttachment[]
): Promise<AssistantAnswer> {
  for await (const event of streamAssistantAgent(question, history, attachments)) {
    if (event.type === "done") return event.data;
    if (event.type === "error") throw new Error(event.message);
  }
  throw new Error("Agent stream ended without a result");
}