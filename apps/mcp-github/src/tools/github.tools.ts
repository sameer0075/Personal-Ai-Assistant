import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as githubClient from "../github/github-client.js";
import { jsonResult, errorResult } from "./tool-result.js";
import { requireUserId } from "./require-user-id.js";

/**
 * Every GitHub tool declares a `userId` field. It is never something the
 * calling LLM sees or fills in - apps/backend's mcp-schema-to-zod.ts strips
 * it from the schema shown to the model, and mcp-tool-adapter.ts always
 * injects the real value here (from whichever user's turn is actually
 * running) right before the call reaches this server. It's declared here
 * purely so this server's own zod validation doesn't silently strip that
 * key out of the incoming arguments before our handler ever sees it.
 */
const userIdField = z.string().uuid().optional().describe("Injected server-side - identifies which user's GitHub account to use");

export function registerGithubTools(server: McpServer): void {
  server.registerTool(
    "github_resolve_connected_user",
    {
      title: "Resolve the connected GitHub account",
      description:
        "Returns the login of the GitHub account currently connected to this user (validates the stored token " +
        "against GitHub as it does so). Used at connect time; harmless to call anytime.",
      inputSchema: {
        userId: userIdField,
      },
    },
    async ({ userId }) => {
      try {
        const uid = requireUserId(userId);
        const user = await githubClient.getStoredAccount(uid);
        return jsonResult(user);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_list_repos",
    {
      title: "List the user's GitHub repositories",
      description:
        "Lists the repositories the connected GitHub account can access (most recently updated first, up to 30). " +
        "Useful as a first step before listing issues - give the user repo names as 'owner/repo'.",
      inputSchema: {
        userId: userIdField,
      },
    },
    async ({ userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.listRepos(uid));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_list_issues",
    {
      title: "List issues in a repository",
      description:
        "Lists issues in a specific repository (as 'owner/repo'). Returns open issues by default - pass state " +
        "'closed' or 'all' to broaden. Pull requests are excluded (they are not issues).",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        state: z.enum(["open", "closed", "all"]).optional().describe("Default: open"),
        perPage: z.number().int().min(1).max(100).optional().describe("Default: 30"),
        userId: userIdField,
      },
    },
    async ({ repo, state, perPage, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.listRepoIssues(uid, repo as string, state ?? "open", perPage ?? 30));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_search_issues",
    {
      title: "Search issues across GitHub",
      description:
        "Searches issues across repositories the user can access. Use GitHub search query syntax, e.g. " +
        "'repo:octocat/Hello-World is:open bug' or 'assignee:octocat urgent'.",
      inputSchema: {
        q: z.string().min(1).describe("GitHub search query"),
        perPage: z.number().int().min(1).max(100).optional().describe("Default: 20"),
        userId: userIdField,
      },
    },
    async ({ q, perPage, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.searchIssues(uid, q as string, perPage ?? 20));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_list_pulls",
    {
      title: "List pull requests in a repository",
      description:
        "Lists open pull requests in a specific repository (as 'owner/repo'). Pass state 'closed' or 'all' to broaden.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        state: z.enum(["open", "closed", "all"]).optional().describe("Default: open"),
        perPage: z.number().int().min(1).max(100).optional().describe("Default: 30"),
        userId: userIdField,
      },
    },
    async ({ repo, state, perPage, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.listRepoPulls(uid, repo as string, state ?? "open", perPage ?? 30));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_get_issue",
    {
      title: "Get one issue or pull request",
      description:
        "Fetches a single issue by number from a repository (as 'owner/repo'). Works for pull requests too, " +
        "since PRs are issues on GitHub's API.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        number: z.number().int().positive().describe("Issue (or PR) number"),
        userId: userIdField,
      },
    },
    async ({ repo, number, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.getIssue(uid, repo as string, number as number));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_get_pull",
    {
      title: "Get a pull request in detail",
      description:
        "Fetches full detail of a pull request by number from a repository (as 'owner/repo') - head/base branches, " +
        "additions/deletions, changed-file count, mergeability. Call this first when asked to review or analyze a PR, " +
        "then call github_list_pull_files to read the actual diff patches.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        number: z.number().int().positive().describe("Pull request number"),
        userId: userIdField,
      },
    },
    async ({ repo, number, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.getPull(uid, repo as string, number as number));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_list_pull_files",
    {
      title: "List files changed in a pull request (with diffs)",
      description:
        "Lists every file changed in a pull request - filename, add/delete counts, and the actual diff patch for " +
        "each file. This is the tool to call for code review / analyzing what a PR changes. Pass the same PR " +
        "number as github_get_pull. Large unreadable-only files may omit patch.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        number: z.number().int().positive().describe("Pull request number"),
        perPage: z.number().int().min(1).max(100).optional().describe("Default: 30"),
        userId: userIdField,
      },
    },
    async ({ repo, number, perPage, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.listPullFiles(uid, repo as string, number as number, perPage ?? 30));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_create_issue",
    {
      title: "Create a GitHub issue (approved action)",
      description:
        "Creates an issue in a repository. This EXECUTES immediately - it is callable only after the user approves " +
        "a drafted issue in the app. Never call this from an agent flow directly.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        title: z.string().min(1).max(512).describe("Issue title"),
        body: z.string().max(150_000).optional().describe("Issue body (markdown)"),
        userId: userIdField,
      },
    },
    async ({ repo, title, body, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.createIssue(uid, repo as string, title as string, body as string | null));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "github_create_issue_comment",
    {
      title: "Comment on an issue or pull request (approved action)",
      description:
        "Adds a comment to an issue or pull request. This EXECUTES immediately - it is callable only after the user " +
        "approves a drafted comment in the app. Never call this from an agent flow directly.",
      inputSchema: {
        repo: z.string().describe("Repository as 'owner/repo', e.g. 'octocat/Hello-World'"),
        issueNumber: z.number().int().positive().describe("Issue or pull request number"),
        body: z.string().min(1).max(150_000).describe("Comment body (markdown)"),
        userId: userIdField,
      },
    },
    async ({ repo, issueNumber, body, userId }) => {
      try {
        const uid = requireUserId(userId);
        return jsonResult(await githubClient.createIssueComment(uid, repo as string, issueNumber as number, body as string));
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}