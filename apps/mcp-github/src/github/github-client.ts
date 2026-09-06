import { env } from "../config/env.js";
import { githubCredentialsRepository } from "./credentials.repository.js";

/** A GitHub "owner/repo" pair, validated against GitHub's naming rules. */
export interface RepoRef {
  owner: string;
  repo: string;
}

export function parseRepoRef(repo: string): RepoRef {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`"${repo}" must be formatted as owner/repo (e.g. "octocat/Hello-World")`);
  }
  return { owner: parts[0], repo: parts[1] };
}

const API_ROOT = "https://api.github.com";

/** Scoped by userId for multi-user support - each user acts as their own GitHub identity. */
async function request<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await githubCredentialsRepository.getValidToken(userId);
  if (!token) {
    throw new Error("No GitHub account is connected for this user. Ask them to connect one in Integrations first.");
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": env.GITHUB_API_VERSION,
      Authorization: `Bearer ${token}`,
      ...(!init?.body ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("GitHub rejected the token - it may be expired or revoked. Reconnect it in Integrations.");
    }
    throw new Error(`GitHub API failed (${response.status}): ${text.slice(0, 300) || response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
}

/** Validates a PAT and resolves the account it belongs to (used at connect time by the backend). */
export async function getAuthenticatedUser(token: string): Promise<{ login: string; email: string | null }> {
  const response = await fetch(`${API_ROOT}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": env.GITHUB_API_VERSION,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub rejected the token (${response.status}) - check it has repo scope and hasn't expired.`);
  }
  const user = (await response.json()) as GitHubUser;
  return { login: user.login, email: user.email };
}

/** Resolves the account for the token we already have stored for this user. */
export async function getStoredAccount(userId: string): Promise<{ login: string; email: string | null }> {
  const token = await githubCredentialsRepository.getValidToken(userId);
  if (!token) {
    throw new Error("No GitHub account is connected for this user.");
  }
  return getAuthenticatedUser(token);
}

export interface GithubRepoSummary {
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string | null;
  updatedAt: string | null;
}

export interface GithubIssueSummary {
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string | null;
  labels: string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface GithubPullSummary {
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string | null;
  createdAt: string;
  htmlUrl: string;
}

/** Full PR detail incl. stats - the shape needed to actually review a pull request. */
export interface GithubPullDetail {
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string | null;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  merged: boolean | null;
  mergeable: boolean | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

/** One changed file in a PR, with its diff patch hunk(s). */
export interface GithubPullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

interface RestRepo {
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string | null;
  updated_at: string | null;
}

interface RestIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  labels: { name: string }[];
  html_url: string;
  created_at: string;
  updated_at: string;
  url: string;
  pull_request?: unknown;
}

interface RestPull {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  created_at: string;
  html_url: string;
}

interface RestPullDetail extends RestPull {
  base: { ref: string };
  head: { ref: string };
  additions: number;
  deletions: number;
  changed_files: number;
  merged: boolean | null;
  mergeable: boolean | null;
  updated_at: string;
}

interface RestPullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export async function listRepos(userId: string, perPage = 30): Promise<GithubRepoSummary[]> {
  const repos = await request<RestRepo[]>(userId, `/user/repos?per_page=${perPage}&sort=updated`);
  return repos.map((r) => ({
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    defaultBranch: r.default_branch,
    updatedAt: r.updated_at,
  }));
}

export async function listRepoIssues(
  userId: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  perPage = 30
): Promise<GithubIssueSummary[]> {
  const ref = parseRepoRef(repo);
  const issues = await request<RestIssue[]>(userId, `/repos/${ref.owner}/${ref.repo}/issues?state=${state}&per_page=${perPage}`);
  return issues.filter((i) => !i.pull_request).map(toIssueSummary);
}

function toIssueSummary(issue: RestIssue): GithubIssueSummary {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    author: issue.user?.login ?? null,
    labels: issue.labels.map((l) => l.name),
    htmlUrl: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.url,
  };
}

export async function searchIssues(userId: string, query: string, perPage = 20): Promise<GithubIssueSummary[]> {
  const result = await request<{ items: RestIssue[] }>(userId, `/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}`);
  return result.items.filter((i) => !i.pull_request).map(toIssueSummary);
}

export async function listRepoPulls(
  userId: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  perPage = 30
): Promise<GithubPullSummary[]> {
  const ref = parseRepoRef(repo);
  const pulls = await request<RestPull[]>(userId, `/repos/${ref.owner}/${ref.repo}/pulls?state=${state}&per_page=${perPage}`);
  return pulls.map((p) => ({
    number: p.number,
    title: p.title,
    body: p.body,
    state: p.state,
    author: p.user?.login ?? null,
    createdAt: p.created_at,
    htmlUrl: p.html_url,
  }));
}

export async function getIssue(userId: string, repo: string, number: number): Promise<GithubIssueSummary> {
  const ref = parseRepoRef(repo);
  const issue = await request<RestIssue>(userId, `/repos/${ref.owner}/${ref.repo}/issues/${number}`);
  return toIssueSummary(issue);
}

/** Full PR detail - for reviewing/analyzing a pull request (head/base, stats, mergeability). */
export async function getPull(userId: string, repo: string, number: number): Promise<GithubPullDetail> {
  const ref = parseRepoRef(repo);
  const pull = await request<RestPullDetail>(userId, `/repos/${ref.owner}/${ref.repo}/pulls/${number}`);
  return {
    number: pull.number,
    title: pull.title,
    body: pull.body,
    state: pull.state,
    author: pull.user?.login ?? null,
    baseBranch: pull.base.ref,
    headBranch: pull.head.ref,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
    merged: pull.merged,
    mergeable: pull.mergeable,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    htmlUrl: pull.html_url,
  };
}

/** Files changed in a PR, each with its diff patch hunk(s) - what the agent needs to review code. */
export async function listPullFiles(
  userId: string,
  repo: string,
  number: number,
  perPage = 30
): Promise<GithubPullFile[]> {
  const ref = parseRepoRef(repo);
  const files = await request<RestPullFile[]>(
    userId,
    `/repos/${ref.owner}/${ref.repo}/pulls/${number}/files?per_page=${perPage}`
  );
  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch ?? null,
  }));
}

export async function createIssue(
  userId: string,
  repo: string,
  title: string,
  body: string | null
): Promise<GithubIssueSummary> {
  const ref = parseRepoRef(repo);
  const issue = await request<RestIssue>(userId, `/repos/${ref.owner}/${ref.repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, ...(body ? { body } : {}) }),
  });
  return toIssueSummary(issue);
}

export async function createIssueComment(
  userId: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number; htmlUrl: string }> {
  const ref = parseRepoRef(repo);
  const comment = await request<{ id: number; html_url: string }>(
    userId,
    `/repos/${ref.owner}/${ref.repo}/issues/${issueNumber}/comments`,
    { method: "POST", body: JSON.stringify({ body }) }
  );
  return { id: comment.id, htmlUrl: comment.html_url };
}