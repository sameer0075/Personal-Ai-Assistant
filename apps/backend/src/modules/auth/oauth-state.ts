import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export function signOAuthState(userId: string, purpose: string): string {
  return jwt.sign({ sub: userId, purpose }, env.JWT_SECRET, { expiresIn: "10m" } as jwt.SignOptions);
}

export function verifyOAuthState(state: string | undefined, purpose: string): string {
  if (!state) throw new Error("Missing OAuth state parameter");

  const payload = jwt.verify(state, env.JWT_SECRET) as jwt.JwtPayload;
  if (typeof payload.sub !== "string") throw new Error("Malformed OAuth state");
  if (payload.purpose !== purpose) throw new Error("OAuth state was issued for a different flow");

  return payload.sub;
}