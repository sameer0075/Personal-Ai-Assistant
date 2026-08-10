import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "./llm-provider.js";
import { loadMcpToolsForAgent } from "../mcp/mcp-tool-adapter.js";

const SYSTEM_PROMPT = [
  "You are a coding assistant working directly inside the user's open project, similar to Cursor. You have real",
  "tools, scoped to this project only:",
  "- list_directory / read_file / search_files: explore the codebase.",
  "- write_file: create a new file or fully overwrite an existing one.",
  "- edit_file: make a precise, targeted change to part of a file (preferred over write_file for existing files -",
  "  it changes only what needs to change, not the whole file).",
  "- create_directory / delete_file: filesystem housekeeping.",
  "- web_search / web_fetch (if available): look up docs, error messages, or library usage you're unsure about",
  "  rather than guessing.",
  "",
  "You DO actually call write_file/edit_file/create_directory/delete_file when asked - don't just describe the",
  "change and stop. Note that these four tools now show the user a diff and wait for their approval before the",
  "write actually happens - so call the tool as soon as you know what to change, rather than describing it first",
  "and waiting for a separate go-ahead; the approval step IS the go-ahead. If the user rejects a change, the tool",
  "result will say so - don't retry the same change or a workaround, ask what they'd prefer instead.",
  "When you finish a task, briefly summarize what you changed and in which files."
  ,
  "You DO actually modify files when asked - don't just describe the change and stop, make it, the same way you",
  "would if the user asked you to send an email or create a calendar event in the other parts of this project.",
  "When you finish a task, briefly summarize what you changed and in which files.",
  "",
  "Editor state: each message may start with an '[Editor state]' block listing which files are open in the",
  "editor and which one is active. When the user says 'this file', 'this', 'the file I have open', or refers to",
  "'it' without naming a path, they mean the active file listed there - read it (if you haven't already this",
  "turn) rather than guessing a different file or asking which one they mean. If no file is active, and the",
  "request clearly needs one, ask which file or use search_files/list_directory to find a likely candidate.",
].join("\n");

type CompiledAgent = ReturnType<typeof createReactAgent>;
let agent: CompiledAgent | null = null;
let conversationHistory: BaseMessage[] = [];

/** Rebuilds the agent with the currently-connected MCP tools. Call after setProjectRoot() changes the toolset. */
export async function rebuildCodingAgent(): Promise<void> {
  const mcpTools = await loadMcpToolsForAgent();
  agent = createReactAgent({ llm: createChatModel(), tools: mcpTools, prompt: SYSTEM_PROMPT });
  conversationHistory = []; // a new/changed project is a fresh context, not a continuation
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

/** What's open in the editor right now, sent fresh with every message so the agent stays in sync as tabs/focus change. */
export interface EditorContext {
  activeFilePath: string | null;
  openFilePaths: string[];
}

function formatEditorContext(context?: EditorContext): string {
  if (!context || (context.openFilePaths.length === 0 && !context.activeFilePath)) {
    return "";
  }

  const lines = ["[Editor state]"];
  if (context.openFilePaths.length > 0) {
    lines.push(`Open tabs: ${context.openFilePaths.join(", ")}`);
  }
  lines.push(
    context.activeFilePath
      ? `Active file (what "this file" refers to by default): ${context.activeFilePath}`
      : "No file is currently active."
  );
  return lines.join("\n") + "\n\n";
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

export async function runCodingAgent(message: string, editorContext?: EditorContext): Promise<CodingAgentAnswer> {
  if (!agent) {
    throw new Error("No project is open yet - open a folder first.");
  }

  const contextualizedMessage = formatEditorContext(editorContext) + message;

  const previousLength = conversationHistory.length;
  conversationHistory.push(new HumanMessage(contextualizedMessage));

  const result = await agent.invoke({ messages: conversationHistory });
  conversationHistory = result.messages;

  const lastMessage = result.messages[result.messages.length - 1];
  const answer = typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content);

  // Only report tool calls made during this turn, not the whole accumulated history.
  const newMessages = result.messages.slice(previousLength);
  return { answer, toolCalls: extractToolCallTrace(newMessages) };
}

export function resetConversation(): void {
  conversationHistory = [];
}