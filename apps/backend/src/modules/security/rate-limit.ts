import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetsAt: number;
}

// Simple in-memory sliding-window limiter per IP. Good for a single-instance
// app; if this ever runs behind multiple processes, swap for a shared store
// (Redis) keyed like `rl:<ip>:<route>`.
const WINDOW_MS = 15 * 60 * 1000;

const buckets = new Map<string, Bucket>();

// Sweep stale buckets so the map never grows unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetsAt <= now) buckets.delete(key);
  }
}, WINDOW_MS).unref();

export function rateLimit({ windowMs = WINDOW_MS, max }: { windowMs?: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetsAt <= now) {
      buckets.set(key, { count: 1, resetsAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: "Too many attempts - please wait a bit and try again." });
      return;
    }

    next();
  };
}