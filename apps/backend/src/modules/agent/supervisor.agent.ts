import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { createChatModel } from "../llm/llm.provider.js";
import { searchKnowledgeBaseTool } from "./tools/rag-search.tool.js";
import { gmailDraftMessageTool } from "./tools/gmail-draft.tool.js";
import { linkedinDraftPostTool } from "./tools/linkedin-draft.tool.js";
import { generateImageTool } from "./tools/generate-image.tool.js";
import { loadMcpToolsByName } from "../mcp/mcp-tool-adapter.js";

type CompiledAgent = ReturnType<typeof createReactAgent>;

interface SpecialistDef {
  name: string;
  description: string;
  prompt: string;
  tools: StructuredToolInterface[];
  agent: CompiledAgent;
}

const EMAIL_PROMPT = [
  "You are the user's email (Gmail) agent.",
  "- gmail_list_messages / gmail_get_message: read the user's real inbox.",
  "- gmail_draft_message: prepares an email and queues it for the user's approval in the app - it does NOT",
  "  send anything. Set attachCv: true when the user asks to send/share/attach their CV or resume.",
  "",
  "HUMAN APPROVAL IS MANDATORY for every outgoing email: gmail_draft_message is the only tool that can 'send',",
  "and it only creates a draft the user reviews and approves in the app. Never claim or imply an email was sent",
  "unless the approval flow explicitly confirmed it. In your reply, tell the user the draft is ready for review.",
].join("\n");

const CALENDAR_PROMPT = [
  "You are the user's calendar agent.",
  "- calendar_list_events: list upcoming events.",
  "- calendar_create_event / calendar_delete_event: create/delete events - these take effect immediately.",
  "",
  "State briefly what you created, deleted, or found. Events are NOT part of the approval queue.",
].join("\n");

const LINKEDIN_PROMPT = [
  "You are the user's LinkedIn agent.",
  "- linkedin_list_recent_posts: read the user's own tracked post history.",
  "- linkedin_draft_post: prepares a post and queues it for the user's approval - it does NOT publish anything.",
  "",
  "HUMAN APPROVAL IS MANDATORY: linkedin_draft_post only creates a draft the user approves in the app. Never",
  "claim or imply a post was published unless the approval flow explicitly confirmed it.",
  "You have NO tool for connecting, following, liking, commenting, or automating any reach/growth activity -",
  "that violates LinkedIn's terms. 'Help me grow my reach' means planning and drafting better content, not automation.",
].join("\n");

const WEB_PROMPT = [
  "You are the general/web agent.",
  "- web_search / web_fetch: live web search and page fetch for current events, facts, research, and anything",
  "  outside the user's own data.",
  "- generate_image: generates an AI image and returns a short imageRef (not the image itself).",
  "",
  "You also handle general analysis and summarization of attached documents that appear inline in the request",
  "text, plus casual questions. Reply concisely. Image posts on LinkedIn aren't supported - draft text-only posts.",
].join("\n");

const KNOWLEDGE_PROMPT = [
  "You are the user's knowledge agent.",
  "- search_knowledge_base: the user's CV plus any emails, calendar events, and LinkedIn posts already indexed.",
  "",
  "Use search_knowledge_base directly for anything about the user's own background, past messages, schedule, or",
  "prior posts - don't guess and don't web search what the knowledge base already knows. Reply with a short,",
  "factual answer citing what you found.",
].join("\n");

// Which MCP tools each specialist owns (draft tools are backend tools, added below).
const SPECIALIST_TOOL_PLAN: Record<string, { description: string; prompt: string; mcpToolNames: string[]; backendTools: string[] }> = {
  email_agent: {
    description:
      "Email agent - the user's Gmail: reading the inbox (list/search/read messages) and drafting outgoing email via the approval flow. Route mail/message/draft requests here.",
    prompt: EMAIL_PROMPT,
    mcpToolNames: ["gmail_list_messages", "gmail_get_message"],
    backendTools: ["gmail_draft_message"],
  },
  calendar_agent: {
    description:
      "Calendar agent - the user's schedule: listing upcoming events and creating/deleting calendar events immediately. Route schedule/meeting/event requests here.",
    prompt: CALENDAR_PROMPT,
    mcpToolNames: ["calendar_list_events", "calendar_create_event", "calendar_delete_event"],
    backendTools: [],
  },
  linkedin_agent: {
    description:
      "LinkedIn agent - the user's LinkedIn: reading their tracked post history and drafting a post via the approval flow. Route LinkedIn post/content requests here.",
    prompt: LINKEDIN_PROMPT,
    mcpToolNames: ["linkedin_list_recent_posts"],
    backendTools: ["linkedin_draft_post"],
  },
  web_agent: {
    description:
      "Web/general agent - live web search and page fetch, AI image generation, and general analysis (including attached documents shown in the request). Route current events, facts, research, image requests, and anything not covered by the other agents here.",
    prompt: WEB_PROMPT,
    mcpToolNames: ["web_search", "web_fetch"],
    backendTools: ["generate_image"],
  },
  knowledge_agent: {
    description:
      "Knowledge agent - searches the user's personal knowledge base (CV/background, plus emails, calendar events, and LinkedIn posts already indexed). Route questions about the user's own background, history, or indexed content here.",
    prompt: KNOWLEDGE_PROMPT,
    mcpToolNames: [],
    backendTools: ["search_knowledge_base"],
  },
};

const BACKEND_TOOLS: Record<string, StructuredToolInterface> = {
  search_knowledge_base: searchKnowledgeBaseTool,
  gmail_draft_message: gmailDraftMessageTool,
  linkedin_draft_post: linkedinDraftPostTool,
  generate_image: generateImageTool,
};

let rosterPromise: Promise<SpecialistDef[]> | null = null;

async function buildRoster(): Promise<SpecialistDef[]> {
  const mcpByName = await loadMcpToolsByName();
  const defs = Object.entries(SPECIALIST_TOOL_PLAN).map(([name, plan]): SpecialistDef => {
    const tools: StructuredToolInterface[] = [
      ...plan.mcpToolNames.map((n) => mcpByName[n]).filter((t): t is NonNullable<typeof t> => Boolean(t)),
      ...plan.backendTools.map((n) => BACKEND_TOOLS[n]).filter((t): t is NonNullable<typeof t> => Boolean(t)),
    ];
    return {
      name,
      description: plan.description,
      prompt: plan.prompt,
      tools,
      agent: createReactAgent({ llm: createChatModel(), tools, prompt: plan.prompt }),
    };
  });
  return defs;
}

function getRoster(): Promise<SpecialistDef[]> {
  if (!rosterPromise) {
    rosterPromise = buildRoster().catch((err) => {
      rosterPromise = null;
      throw err;
    });
  }
  return rosterPromise;
}

const SUPERVISOR_PROMPT = [
  "You are the coordinator of a team of specialized agents. You have no direct tools except the specialists",
  "below. Decide which specialist(s) to call and pass the user's full request as the tool's 'input' - include",
  "relevant context and any attached-file text shown in the message.",
  "",
  "Routing: EMAIL for anything about email/inbox/drafts; CALENDAR for schedule/meetings/events; LINKEDIN for",
  "LinkedIn posts/content; KNOWLEDGE for the user's own background, past messages, schedule, or indexed content;",
  "WEB for current events, facts, outside-world research, images, attached-file analysis, and everything else.",
  "You may call more than one specialist for compound requests (e.g. research then draft an email).",
  "",
  "After the specialist returns, give the final answer yourself. Draft tools inside the specialists only queue",
  "for the user's approval in the app - NEVER say or imply an email was sent, a LinkedIn post was published, or",
  "anything destructive happened unless a tool result explicitly confirmed it.",
  "",
  "If a specialist fails or can't help, say so honestly with the exact error - don't invent a nicer explanation.",
].join("\n");

/**
 * Wraps a specialist agent as a tool the supervisor can call. The specialist runs
 * with its own narrow toolset, and every message it produces is appended to
 * `collector` so the shared run can surface its tool traces and draft/approval
 * actions (the supervisor hands those messages to extractPendingActions).
 */
function wrapSpecialistAsTool(specialist: SpecialistDef, collector: BaseMessage[]) {
  return tool(
    async ({ input }: { input: string }, config) => {
      const userId = config?.configurable?.userId as string | undefined;
      let answer = "";
      const stream = await specialist.agent.stream(
        { messages: [new HumanMessage(input)] },
        { configurable: { userId, recursionLimit: 40 }, streamMode: "updates" }
      );
      for await (const update of stream) {
        const nodeUpdates = update as Record<string, { messages?: BaseMessage[] } | undefined>;
        for (const nodeUpdate of Object.values(nodeUpdates)) {
          if (!nodeUpdate?.messages) continue;
          for (const msg of nodeUpdate.messages) {
            collector.push(msg);
            if (msg instanceof AIMessage && typeof msg.content === "string" && msg.content) {
              answer = msg.content;
            }
          }
        }
      }
      return answer || `(${specialist.name} finished without an answer)`;
    },
    {
      name: specialist.name,
      description: specialist.description,
      schema: z.object({
        input: z.string().min(1).describe("The user's full request for this specialist to handle"),
      }),
    }
  );
}

/**
 * Builds the compiled multi-agent graph: a supervisor that routes each request
 * to the best-fit specialist. The graph is per-request (the specialist tools
 * capture `collector`, which is that request's message array).
 */
export async function buildSupervisorGraph(collector: BaseMessage[]): Promise<CompiledAgent> {
  const roster = await getRoster();
  return createReactAgent({
    llm: createChatModel(),
    tools: roster.map((def) => wrapSpecialistAsTool(def, collector)),
    prompt: SUPERVISOR_PROMPT,
  });
}