import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createLinkedinDraft } from "../../actions/pending-actions.service.js";

export const linkedinDraftPostTool = tool(
  async ({ commentary }: { commentary: string }, config?: RunnableConfig) => {
    const userId: any = config?.configurable?.userId as string | undefined;
    if (!userId) {
      throw new Error("linkedin_draft_post called without a userId in context - this is a bug, not a user-facing error.");
    }

    const action = await createLinkedinDraft(userId, { commentary });
    return JSON.stringify({
      drafted: true,
      pendingActionId: action.id,
      note:
        "This post has NOT been published. It is queued for the user's review in the app - " +
        "tell the user it's drafted and ready for their approval, never say it was posted.",
    });
  },
  {
    name: "linkedin_draft_post",
    description:
      "Prepares a LinkedIn post (commentary text) and queues it for human approval. This " +
      "does NOT publish the post - the user must review and approve it in the app before " +
      "anything is actually posted. Always use this tool when asked to publish a LinkedIn " +
      "post; never claim a post was published.",
    schema: z.object({
      commentary: z.string().min(1).max(3000).describe("The LinkedIn post text"),
    }),
  }
);