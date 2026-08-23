import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "../llm/llm.provider.js";
import { searchKnowledgeBaseTool } from "./tools/rag-search.tool.js";
import { gmailDraftMessageTool } from "./tools/gmail-draft.tool.js";
import { linkedinDraftPostTool } from "./tools/linkedin-draft.tool.js";
import { loadMcpToolsForAgent } from "../mcp/mcp-tool-adapter.js";
import { getPendingAction } from "../actions/pending-actions.service.js";
import type { AssistantAnswer, PendingAction, ToolCallTrace } from "../../types/index.js";

const SYSTEM_PROMPT = [
  // ...unchanged, same system prompt as before...
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
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): AsyncGenerator<AgentStreamEvent> {
  try {
    const agent = await getAgent();

    const historyMessages = history.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    const allMessages: BaseMessage[] = [...historyMessages, new HumanMessage(question)];
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
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AssistantAnswer> {
  for await (const event of streamAssistantAgent(question, history)) {
    if (event.type === "done") return event.data;
    if (event.type === "error") throw new Error(event.message);
  }
  throw new Error("Agent stream ended without a result");
}