import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.service.js";
import { pool } from "../../config/database.js";

/**
 * Gate for any route that should only work for a logged-in user. Reads
 * `Authorization: Bearer <token>`, verifies it, and sets `req.userId` for
 * downstream handlers. Mounted per-router (`router.use(requireAuth)` at the
 * top of each protected route file) rather than globally, because a few
 * routes are hit by a plain browser redirect with no way to attach a header
 * (Google/LinkedIn's OAuth callback) - those stay open for now and get
 * properly tied to a specific user in the Gmail/LinkedIn module, via the
 * OAuth `state` param instead of a bearer token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    req.userId = verifyToken(token);
    const requestedWorkspaceId = req.headers["x-workspace-id"];
    let workspace = await pool.query<{ id: string }>(
      `SELECT id FROM workspaces WHERE user_id = $1 AND (id = $2 OR ($2 IS NULL AND kind = 'personal')) LIMIT 1`,
      [req.userId, typeof requestedWorkspaceId === "string" ? requestedWorkspaceId : null]
    );
    if (!workspace.rows[0] && !requestedWorkspaceId) {
      await pool.query(`INSERT INTO workspaces (user_id, kind, name) VALUES ($1, 'personal', 'Personal') ON CONFLICT DO NOTHING`, [req.userId]);
      workspace = await pool.query<{ id: string }>(
        `SELECT id FROM workspaces WHERE user_id = $1 AND kind = 'personal' LIMIT 1`,
        [req.userId]
      );
    }
    if (!workspace.rows[0]) {
      res.status(403).json({ error: "Workspace not found for this account" });
      return;
    }
    req.workspaceId = workspace.rows[0].id;
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired - please log in again" });
  }
}