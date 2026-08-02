import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "../llm/llm.provider.js";
import { searchKnowledgeBaseTool } from "./tools/rag-search.tool.js";
import { loadMcpToolsForAgent } from "../mcp/mcp-tool-adapter.js";
import type { AssistantAnswer, ToolCallTrace } from "../../types/index.js";

const SYSTEM_PROMPT = [
  "You are the user's personal AI assistant with real access to their tools:",
  "- search_knowledge_base: their CV plus any emails/calendar events already indexed.",
  "- gmail_list_messages / gmail_get_message / gmail_send_message: their real Gmail inbox.",
  "- calendar_list_events / calendar_create_event / calendar_delete_event: their real Google Calendar.",
  "",
  "Plan before acting: for anything about the user's background, past emails, or schedule, search the",
  "knowledge base first. For anything requiring the CURRENT inbox or calendar state, call the Gmail/",
  "Calendar tools directly rather than guessing. When asked to write and send an email or create an",
  "event, do it - call the tool yourself rather than just describing what you would send. Never invent",
  "email addresses, event details, or message content that wasn't provided or retrieved.",
  "Before sending an email or creating/deleting a calendar event, briefly state what you're about to do",
  "in your final answer so the user can see it happened.",
].join("\n");

type CompiledAgent = ReturnType<typeof createReactAgent>;
let agentPromise: Promise<CompiledAgent> | null = null;

async function getAgent(): Promise<CompiledAgent> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const mcpTools = await loadMcpToolsForAgent();
      return createReactAgent({
        llm: createChatModel(),
        tools: [searchKnowledgeBaseTool, ...mcpTools],
        prompt: SYSTEM_PROMPT,
      });
    })().catch((err) => {
      agentPromise = null; // don't cache a failed startup (e.g. MCP server not ready yet)
      throw err;
    });
  }
  return agentPromise;
}

/** Extracts a readable trace of which tools the agent called and with what, for UI transparency. */
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

export async function runAssistantAgent(question: string): Promise<AssistantAnswer> {
  const agent = await getAgent();
  const result = await agent.invoke({ messages: [new HumanMessage(question)] });

  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);

  return { answer, toolCalls: extractToolCallTrace(result.messages) };
}