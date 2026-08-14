import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "./llm-provider.js";
import { loadMcpToolsForProject } from "../mcp/mcp-tool-adapter.js";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  type StoredChatMessage,
} from "../state/chat-history.store.js";

const SYSTEM_PROMPT = [/* unchanged */].join("\n");

type CompiledAgent = ReturnType<typeof createReactAgent>;

interface ProjectAgentState {
  agent: CompiledAgent;
  projectRoot: string;
  conversationHistory: BaseMessage[]; // what the LLM sees
  displayMessages: StoredChatMessage[]; // what the UI shows + what gets persisted
}

const agentsByProject = new Map<string, ProjectAgentState>();

/** Reconstructs enough LangChain history from the saved transcript so the
 * agent has real conversational memory again after a restart. Tool-call
 * detail is deliberately NOT replayed into the LLM context (only final
 * answers) — replaying every past tool call would bloat the context window
 * fast, and the agent can always re-call a tool if it needs fresh data. */
function toBaseMessages(display: StoredChatMessage[]): BaseMessage[] {
  return display.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));
}

export async function buildCodingAgentForProject(projectId: string, projectRoot: string): Promise<void> {
  const mcpTools = await loadMcpToolsForProject(projectId);
  const agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });

  const displayMessages = await loadChatHistory(projectRoot);
  agentsByProject.set(projectId, {
    agent,
    projectRoot,
    conversationHistory: toBaseMessages(displayMessages),
    displayMessages,
  });
}

export function disposeCodingAgentForProject(projectId: string): void {
  // Deliberately does NOT delete the on-disk history — closing a project in
  // the UI shouldn't wipe its saved conversation, only an explicit "clear
  // chat" action should. Reopening the same folder later restores it.
  agentsByProject.delete(projectId);
}

export interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

export interface CodingAgentAnswer {
  answer: string;
  toolCalls: ToolCallTrace[];
}

export interface AgentMessageContext {
  activeFilePath: string | null;
  openFilePaths: string[];
}

function formatContext(context?: AgentMessageContext): string {
  if (!context) return "";
  const lines: string[] = [];
  if (context.activeFilePath) lines.push(`Active file (what the user is currently looking at): ${context.activeFilePath}`);
  if (context.openFilePaths.length) lines.push(`Other open files: ${context.openFilePaths.join(", ")}`);
  return lines.length ? `[Editor context]\n${lines.join("\n")}\n\n` : "";
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

export async function runCodingAgentForProject(
  projectId: string,
  message: string,
  context?: AgentMessageContext
): Promise<CodingAgentAnswer> {
  const state = agentsByProject.get(projectId);
  if (!state) {
    throw new Error("This project's agent isn't ready yet - try reopening the folder.");
  }

  const previousLength = state.conversationHistory.length;
  state.conversationHistory.push(new HumanMessage(formatContext(context) + message));

  const result = await state.agent.invoke({ messages: state.conversationHistory });
  state.conversationHistory = result.messages;

  const lastMessage = result.messages[result.messages.length - 1];
  const answer =
    typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);

  const newMessages = result.messages.slice(previousLength);
  const toolCalls = extractToolCallTrace(newMessages);

  // Persist the raw user text (not the context-prefixed version) so
  // reopening this project doesn't show the injected [Editor context] block.
  state.displayMessages.push({ role: "user", content: message });
  state.displayMessages.push({ role: "assistant", content: answer, toolCalls });
  await saveChatHistory(state.projectRoot, state.displayMessages);

  return { answer, toolCalls };
}

export function getDisplayHistory(projectId: string): StoredChatMessage[] {
  return agentsByProject.get(projectId)?.displayMessages ?? [];
}

export async function resetConversationForProject(projectId: string): Promise<void> {
  const state = agentsByProject.get(projectId);
  if (!state) return;
  state.conversationHistory = [];
  state.displayMessages = [];
  await clearChatHistory(state.projectRoot);
}