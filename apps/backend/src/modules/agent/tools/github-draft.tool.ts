import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createGithubIssueDraft, createGithubCommentDraft } from "../../actions/pending-actions.service.js";

function requireUserId(config?: RunnableConfig): string {
  const userId = (config?.configurable as { userId?: string } | undefined)?.userId;
  if (!userId) {
    throw new Error("Called without a userId in context - this is a bug, not a user-facing error.");
  }
  return userId;
}

export const githubDraftIssueTool = tool(
  async ({ repo, title, body }: { repo: string; title: string; body: string }, config?: RunnableConfig) => {
    const action = await createGithubIssueDraft(requireUserId(config), { repo, title, body });
    return JSON.stringify({
      drafted: true,
      pendingActionId: action.id,
      note: "This issue has NOT been created on GitHub. It is queued for the user's review in the app - tell the user it's drafted and ready for their approval, never say it was filed.",
    });
  },
  {
    name: "github_draft_issue",
    description:
      "Prepares a new GitHub issue (repo like owner/repo, title, body) and queues it for human approval. " +
      "This does NOT create anything on GitHub - the user must review and approve it in the app first. Always " +
      "use this tool when asked to open/file/create an issue; never claim an issue was created.",
    schema: z.object({
      repo: z.string().min(3).describe("Repository in owner/repo format"),
      title: z.string().min(1).describe("Issue title"),
      body: z.string().min(1).describe("Issue body / description"),
    }),
  }
);

export const githubDraftCommentTool = tool(
  async ({ repo, issueNumber, body }: { repo: string; issueNumber: number; body: string }, config?: RunnableConfig) => {
    const action = await createGithubCommentDraft(requireUserId(config), { repo, issueNumber, body });
    return JSON.stringify({
      drafted: true,
      pendingActionId: action.id,
      note: "This comment has NOT been posted on GitHub. It is queued for the user's review in the app - tell the user it's drafted and ready for their approval, never say it was posted.",
    });
  },
  {
    name: "github_draft_comment",
    description:
      "Prepares a comment on an existing GitHub issue or pull request (repo like owner/repo, issueNumber, body) " +
      "and queues it for human approval. This does NOT post anything on GitHub - the user must review and approve " +
      "it in the app first. Always use this tool when asked to comment/reply on a GitHub issue or PR.",
    schema: z.object({
      repo: z.string().min(3).describe("Repository in owner/repo format"),
      issueNumber: z.number().min(1).describe("Issue or pull request number to comment on"),
      body: z.string().min(1).describe("Comment text"),
    }),
  }
);