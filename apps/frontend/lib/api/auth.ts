import { apiJson, apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export function signupRequest(email: string, password: string, name?: string): Promise<AuthResult> {
  return apiJson<AuthResult>("/auth/signup", "POST", { email, password, name });
}

export function loginRequest(email: string, password: string): Promise<AuthResult> {
  return apiJson<AuthResult>("/auth/login", "POST", { email, password });
}

export function getMe(): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>("/auth/me");
}