import { randomUUID } from "node:crypto";
import { getMainWindow } from "../state/window-state.js";

export interface PendingConfirmation {
  requestId: string;
  projectId: string;
  tool: string;
  input: unknown;
}

interface Resolver {
  projectId: string;
  resolve: (approved: boolean) => void;
}

const pending = new Map<string, Resolver>();

/**
 * Sends a confirmation request to the renderer and blocks (via an
 * unresolved Promise) until the user approves or rejects it. This runs
 * INSIDE the tool's execute function, so the ReAct loop itself pauses
 * mid-turn — the agent cannot proceed to its next step until a human has
 * signed off on the file change.
 */
export function requestToolConfirmation(projectId: string, tool: string, input: unknown): Promise<boolean> {
  const win = getMainWindow();
  if (!win) return Promise.resolve(false); // no window to ask - fail closed, not open

  const requestId = randomUUID();
  return new Promise<boolean>((resolve) => {
    pending.set(requestId, { projectId, resolve });
    win.webContents.send("agent:tool-confirmation-request", { requestId, projectId, tool, input } satisfies PendingConfirmation);
  });
}

export function resolveToolConfirmation(requestId: string, approved: boolean): void {
  const resolver = pending.get(requestId);
  if (!resolver) return; // already resolved, or renderer restarted mid-flight
  pending.delete(requestId);
  resolver.resolve(approved);
}

/** Closing a project shouldn't leave a tool call hanging forever waiting on
 * a confirmation the user will never see again — treat it as declined. */
export function cancelPendingConfirmationsForProject(projectId: string): void {
  for (const [requestId, resolver] of pending) {
    if (resolver.projectId === projectId) {
      pending.delete(requestId);
      resolver.resolve(false);
    }
  }
}