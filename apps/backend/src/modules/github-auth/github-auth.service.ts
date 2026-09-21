import { githubCredentialsRepository, type GithubConnectionStatus } from "./github-credentials.repository.js";
import { callMcpTool } from "../mcp/mcp-client.service.js";
import { documentRepository } from "../rag/document.repository.js";
import { ingestText } from "../rag/ingest-text.service.js";

/**
 * Connect/disconnect/status + search sync for GitHub. The backend never talks
 * to the GitHub API directly - token validation happens inside mcp-github,
 * which picks the token up from the DB (encrypted), so a raw PAT is only ever
 * in: the request body on this connect call, and mcp-github's process memory
 * during the check.
 */
export async function connectGithub(userId: string, workspaceId: string, token: string): Promise<GithubConnectionStatus> {
  const trimmed = token.trim();
  if (trimmed.length < 20 || trimmed.length > 300) {
    throw new Error("That doesn't look like a GitHub personal access token.");
  }

  await githubCredentialsRepository.storePlaintextToken(userId, workspaceId, trimmed);

  try {
    const json = await callMcpTool("github_resolve_connected_user", { userId, workspaceId });
    const { login, email } = JSON.parse(json) as { login?: string; email?: string | null };
    if (!login) throw new Error("GitHub did not resolve an account for that token.");
    await githubCredentialsRepository.updateAccount(userId, workspaceId, login, email ?? null);
    return { connected: true, login, email: email ?? null };
  } catch (err) {
    // The token was rejected - don't keep a broken credential around.
    await githubCredentialsRepository.disconnect(userId, workspaceId);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't connect GitHub: ${message}`);
  }
}

export function getGithubStatus(userId: string, workspaceId: string): Promise<GithubConnectionStatus> {
  return githubCredentialsRepository.getStatus(userId, workspaceId);
}

export async function disconnectGithub(userId: string, workspaceId: string): Promise<void> {
  await githubCredentialsRepository.disconnect(userId, workspaceId);
}

export async function syncGithub(
  userId: string,
  workspaceId: string
): Promise<{ found: number; ingested: number; skipped: number; repos: number }> {
  const reposJson = await callMcpTool("github_list_repos", { userId, workspaceId });
  const repos = JSON.parse(reposJson) as Array<{ fullName: string }>;

  let found = 0;
  let ingested = 0;
  let skipped = 0;

  for (const repo of repos.slice(0, 10)) {
    let issues: Array<{
      number: number;
      title: string;
      body: string | null;
      state: string;
      labels: string[];
      createdAt: string;
    }>;
    try {
      const issuesJson = await callMcpTool("github_list_issues", { repo: repo.fullName, state: "open", perPage: 20, userId, workspaceId });
      issues = JSON.parse(issuesJson);
    } catch {
      continue; // private/archived repos or a token without repo scope - skip, don't fail the whole sync
    }

    for (const issue of issues) {
      found++;
      const externalId = `${repo.fullName}#${issue.number}`;
      const existing = await documentRepository.findByExternalId(userId, workspaceId, "github", externalId);
      if (existing) {
        skipped++;
        continue;
      }
      await ingestText({
        userId,
        workspaceId,
        title: `${repo.fullName}#${issue.number} — ${issue.title}`,
        text: [
          `Repository: ${repo.fullName}`,
          `Issue #${issue.number}: ${issue.title}`,
          `State: ${issue.state}`,
          issue.labels.length ? `Labels: ${issue.labels.join(", ")}` : "",
          "",
          issue.body ?? "(no description)",
        ].join("\n"),
        sourceType: "github",
        metadata: { externalId, repo: repo.fullName, number: issue.number },
      });
      ingested++;
    }
  }

  return { found, ingested, skipped, repos: repos.length };
}