// Makes req.userId a known, typed property everywhere an Express Request is
// used, instead of every route handler having to cast or re-declare it.
// Populated by modules/auth/auth.middleware.ts#requireAuth.
declare namespace Express {
  export interface Request {
    userId?: string;
  }
}