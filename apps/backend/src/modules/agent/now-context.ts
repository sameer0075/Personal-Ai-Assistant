/**
 * Fresh clock-string for the agent prompts, computed at every run so the
 * model always knows the current date/time. This is what lets it answer
 * "what's on my calendar today" or "remind me tomorrow" without guessing.
 *
 * Kept deliberately small/self-contained (no imports) so any agent module can
 * use it without pulling in a dependency graph.
 */
export function nowContext(): string {
  const now = new Date();
  return [
    `CURRENT DATE AND TIME (use this as the authoritative reference for "today", "tomorrow", "this week/month", "upcoming", or any relative-date request):`,
    now.toString(),
    `ISO 8601: ${now.toISOString()}`,
  ].join(" ");
}