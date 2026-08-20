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

async function getAgent(): Promise<CompiledAgent> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const mcpTools = await loadMcpToolsForAgent();
      return createReactAgent({
        llm: createChatModel(),
        // gmailDraftMessageTool / linkedinDraftPostTool replace the raw
        // gmail_send_message / linkedin_create_post MCP tools, which
        // mcp-tool-adapter.ts now filters out of mcpTools entirely - the
        // agent physically cannot call the real send/publish tools.
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

export async function runAssistantAgent(question: string): Promise<AssistantAnswer> {
  const agent = await getAgent();
  const result = await agent.invoke({ messages: [new HumanMessage(question)] });

  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);
  const toolCalls = extractToolCallTrace(result.messages);
  const pendingActions = await extractPendingActions(toolCalls);

  return { answer, toolCalls, pendingActions };
}