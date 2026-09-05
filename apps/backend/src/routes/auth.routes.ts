import { Router } from "express";
import { z } from "zod";
import { signup, login, getUserById } from "../modules/auth/auth.service.js";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { rateLimit } from "../modules/security/rate-limit.js";

export const authRoutes = Router();

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  // Cap length - bcrypt only uses the first 72 bytes, and an unbounded string is a cheap DoS.
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
  name: z.string().trim().min(1).max(120).optional(),
});

/** POST /api/auth/signup - Body: { email, password, name? }. Returns { token, user }. */
authRoutes.post("/signup", rateLimit({ max: 10 }), async (req, res) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body);
    const result = await signup(email, password, name);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ error: err.errors[0]?.message ?? "Invalid input" });
      return;
    }
    res.status(409).json({ error: err instanceof Error ? err.message : "Signup failed" });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/** POST /api/auth/login - Body: { email, password }. Returns { token, user }. */
authRoutes.post("/login", rateLimit({ max: 20 }), async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ error: err.errors[0]?.message ?? "Invalid input" });
      return;
    }
    res.status(401).json({ error: err instanceof Error ? err.message : "Login failed" });
  }
});

/** GET /api/auth/me - requires a valid token. Used on app load to restore the session and re-fetch the current user. */
authRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});