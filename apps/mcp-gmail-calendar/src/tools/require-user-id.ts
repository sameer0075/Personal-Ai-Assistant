/**
 * Every Gmail/Calendar tool declares `userId` as OPTIONAL in its zod schema
 * (see userIdField in gmail.tools.ts / calendar.tools.ts) specifically so a
 * missing value never gets rejected by zod itself with a terse, confusing
 * validation error. Instead every handler calls this first and gets a
 * clear, actionable message pointing at the actual likely cause.
 *
 * `userId` is meant to be injected server-side by apps/backend's
 * mcp-tool-adapter.ts on every call - it should never actually be missing
 * in a correctly-running system. If it is, the most common real-world cause
 * is a stale process: this MCP server is a separate child process the
 * backend spawns once and keeps a persistent connection to (see
 * apps/backend/src/modules/mcp/mcp-client.service.ts) - if the backend was
 * restarted/rebuilt after this server was already running (or vice versa),
 * the two can end up on mismatched versions of this contract.
 */
export function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new Error(
      "Internal error: no authenticated user reached this tool call. This usually means the backend and " +
        "mcp-gmail-calendar processes are out of sync (e.g. one was restarted/rebuilt without the other) - " +
        "restart both and try again."
    );
  }
  return userId;
}