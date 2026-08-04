import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as linkedinClient from "../linkedin/linkedin-client.js";
import { postsRepository } from "../linkedin/posts.repository.js";
import { jsonResult, errorResult } from "./tool-result.js";

export function registerLinkedinTools(server: McpServer): void {
  server.registerTool(
    "linkedin_create_post",
    {
      title: "Publish a LinkedIn post",
      description:
        "Publishes a post to the user's own LinkedIn profile, visible to their full network and beyond (PUBLIC " +
        "visibility). This actually publishes immediately - there is no draft/preview state. Only call this when " +
        "the user has approved the exact wording, or explicitly asked you to post it as-is. To include an image, " +
        "call generate_image first and pass the imageRef it returns. This tool only publishes content - it cannot " +
        "connect with people, follow, like, comment, or message on the user's behalf, and never attempt those as " +
        "a workaround for 'growing reach'.",
      inputSchema: {
        commentary: z.string().min(1).max(3000).describe("The post text, exactly as it should appear on LinkedIn"),
        imageRef: z
          .string()
          .optional()
          .describe("Optional - the imageRef returned by generate_image, to attach an image to this post"),
      },
    },
    async ({ commentary, imageRef }) => {
      try {
        const { postUrn } = await linkedinClient.createPost(commentary, imageRef);
        await postsRepository.record(postUrn, commentary);
        return jsonResult({ published: true, postUrn, hasImage: Boolean(imageRef) });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "linkedin_delete_post",
    {
      title: "Delete a LinkedIn post",
      description: "Permanently deletes a post from the user's LinkedIn profile by its post URN. This cannot be undone.",
      inputSchema: {
        postUrn: z.string().describe("The post URN, e.g. 'urn:li:share:123...' - from linkedin_list_recent_posts"),
      },
    },
    async ({ postUrn }) => {
      try {
        await linkedinClient.deletePost(postUrn);
        await postsRepository.markDeleted(postUrn);
        return jsonResult({ deleted: true, postUrn });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "linkedin_list_recent_posts",
    {
      title: "List recent LinkedIn posts made through this assistant",
      description:
        "Lists posts this assistant has published to the user's LinkedIn profile, most recent first. Note: this " +
        "reflects only posts made through linkedin_create_post, not the member's full LinkedIn history - LinkedIn " +
        "restricts API access to a member's complete post history to specially-approved apps.",
      inputSchema: {
        maxResults: z.number().int().min(1).max(50).optional().describe("Max posts to return (default 20)"),
      },
    },
    async ({ maxResults }) => {
      try {
        const posts = await postsRepository.listRecent(maxResults ?? 20);
        return jsonResult(posts);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}