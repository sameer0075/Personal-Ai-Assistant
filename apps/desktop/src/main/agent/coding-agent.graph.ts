import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "./llm-provider.js";
import { loadMcpToolsForWorkspace } from "../mcp/mcp-tool-adapter.js";
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  type StoredChatMessage,
} from "../state/chat-history.store.js";

const SYSTEM_PROMPT = [
  "You are a coding agent working inside a multi-root workspace. The workspace contains one or more",
  "repositories, each addressed by its root name.",
  "",
  "EVERY file path you pass to the filesystem tools MUST be prefixed with the workspace root name,",
  "e.g. 'frontend/src/App.tsx' or 'backend/src/api.ts'. Use list_directory with '.' to see the available",
  "roots first if you're unsure. search_files spans all roots and reports prefixed paths, so use it to find",
  "code across the whole workspace.",
  "",
  "You can freely read and edit files in ANY root of the workspace - they are all part of the same project",
  "and the user expects you to look across them (e.g. change a frontend component and the backend API it",
  "talks to in one turn). Only touch files inside the workspace roots.",
  "",
  // (behavioral rules unchanged from prior design)
  "When you need to edit a file, read it first to see its exact current content, then use edit_file for",
  "targeted changes (or write_file to create/overwrite). Explain what you changed and why.",
].join("\n");

type CompiledAgent = ReturnType<typeof createReactAgent>;

interface WorkspaceAgentState {
  agent: CompiledAgent;
  workspaceKey: string; // stable identity for persisted chat history
  workspaceName: string;
  roots: string[]; // display names of roots, for the context block
  conversationHistory: BaseMessage[]; // what the LLM sees
  displayMessages: StoredChatMessage[]; // what the UI shows + what gets persisted
}

const agentsByWorkspace = new Map<string, WorkspaceAgentState>();

/** Reconstructs enough LangChain history from the saved transcript so the
 * agent has real conversational memory again after a restart. Tool-call
 * detail is deliberately NOT replayed into the LLM context (only final
 * answers) — replaying every past tool call would bloat the context window
 * fast, and the agent can always re-call a tool if it needs fresh data. */
function toBaseMessages(display: StoredChatMessage[]): BaseMessage[] {
  return display.map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));
}

export interface WorkspaceAgentSpec {
  workspaceId: string;
  workspaceKey: string;
  workspaceName: string;
  roots: string[];
}

export async function buildCodingAgentForWorkspace(spec: WorkspaceAgentSpec): Promise<void> {
  const mcpTools = await loadMcpToolsForWorkspace(spec.workspaceId);
  const agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });

  const displayMessages = await loadChatHistory(spec.workspaceKey);
  agentsByWorkspace.set(spec.workspaceId, {
    agent,
    workspaceKey: spec.workspaceKey,
    workspaceName: spec.workspaceName,
    roots: spec.roots,
    conversationHistory: toBaseMessages(displayMessages),
    displayMessages,
  });
}

export function disposeCodingAgentForWorkspace(workspaceId: string): void {
  agentsByWorkspace.delete(workspaceId);
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

function formatContext(state: WorkspaceAgentState, context?: AgentMessageContext): string {
  const lines: string[] = [];
  lines.push(`Workspace roots: ${state.roots.join(", ")}`);
  if (context?.activeFilePath) {
    lines.push(`Active file (what the user is currently looking at): ${context.activeFilePath}`);
  }
  if (context?.openFilePaths.length) {
    lines.push(`Other open files: ${context.openFilePaths.join(", ")}`);
  }
  return `[Editor context]\n${lines.join("\n")}\n\n`;
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

export async function runCodingAgentForWorkspace(
  workspaceId: string,
  message: string,
  context?: AgentMessageContext
): Promise<CodingAgentAnswer> {
  const state = agentsByWorkspace.get(workspaceId);
  if (!state) {
    throw new Error("This workspace's agent isn't ready yet - try reopening the workspace.");
  }

  const previousLength = state.conversationHistory.length;
  state.conversationHistory.push(new HumanMessage(formatContext(state, context) + message));

  const result = await state.agent.invoke({ messages: state.conversationHistory });
  state.conversationHistory = result.messages;

  const lastMessage = result.messages[result.messages.length - 1];
  const answer =
    typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);

  const newMessages = result.messages.slice(previousLength);
  const toolCalls = extractToolCallTrace(newMessages);

  // Persist the raw user text (not the context-prefixed version) so reopening
  // this workspace doesn't show the injected [Editor context] block.
  state.displayMessages.push({ role: "user", content: message });
  state.displayMessages.push({ role: "assistant", content: answer, toolCalls });
  await saveChatHistory(state.workspaceKey, state.displayMessages);

  return { answer, toolCalls };
}

export function getDisplayHistory(workspaceId: string): StoredChatMessage[] {
  return agentsByWorkspace.get(workspaceId)?.displayMessages ?? [];
}

export async function resetConversationForWorkspace(workspaceId: string): Promise<void> {
  const state = agentsByWorkspace.get(workspaceId);
  if (!state) return;
  state.conversationHistory = [];
  state.displayMessages = [];
  await clearChatHistory(state.workspaceKey);
}