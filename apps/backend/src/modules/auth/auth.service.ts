import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { userRepository, type UserRow } from "./user.repository.js";
import type { AuthUser } from "../../types/index.js";

const SALT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: AuthUser;
}

function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, name: row.name };
}

function signToken(userId: string): string {
  // `sub` (subject) is the JWT-standard claim for "who this token is about" -
  // verifyToken below reads it back out to get the user id.
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Creates a new account. Emails are case-insensitively unique (normalized to
 * lowercase before touching the DB); "an account already exists" is
 * deliberately a generic message rather than confirming which specific email
 * is taken, to avoid casually leaking which emails are registered.
 */
export async function signup(email: string, password: string, name?: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing) {
    throw new Error("An account with this email already exists. Try logging in instead.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userRepository.createUser({
    email: normalizedEmail,
    passwordHash,
    name: name?.trim() || null,
  });

  return { token: signToken(user.id), user: toAuthUser(user) };
}

/**
 * Verifies credentials and issues a fresh token. Deliberately returns the
 * exact same error message whether the email doesn't exist or the password
 * is wrong - distinguishing the two would let an attacker enumerate which
 * emails have accounts.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const invalidCredentialsError = new Error("Invalid email or password");

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) throw invalidCredentialsError;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw invalidCredentialsError;

  return { token: signToken(user.id), user: toAuthUser(user) };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await userRepository.findById(userId);
  return user ? toAuthUser(user) : null;
}

/** Throws if the token is missing, malformed, expired, or signed with a different secret. Returns the user id on success. */
export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  if (typeof payload.sub !== "string") {
    throw new Error("Malformed token payload");
  }
  return payload.sub;
}