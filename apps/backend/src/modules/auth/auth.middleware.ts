import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.service.js";

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
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired - please log in again" });
  }
}