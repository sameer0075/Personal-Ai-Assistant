import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export function signOAuthState(userId: string, workspaceId: string, purpose: string): string {
  return jwt.sign({ sub: userId, workspaceId, purpose }, env.JWT_SECRET, { expiresIn: "10m" } as jwt.SignOptions);
}

export function verifyOAuthState(state: string | undefined, purpose: string): { userId: string; workspaceId: string } {
  if (!state) throw new Error("Missing OAuth state parameter");

  const payload = jwt.verify(state, env.JWT_SECRET) as jwt.JwtPayload;
  if (typeof payload.sub !== "string") throw new Error("Malformed OAuth state");
  if (payload.purpose !== purpose) throw new Error("OAuth state was issued for a different flow");
  if (typeof payload.workspaceId !== "string") throw new Error("Malformed OAuth workspace state");

  return { userId: payload.sub, workspaceId: payload.workspaceId };
}