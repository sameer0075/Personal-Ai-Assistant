import { getToken, clearToken } from "../auth/token";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

/**
 * GET (or any method with no JSON body) with consistent error unwrapping.
 * Automatically attaches `Authorization: Bearer <token>` when a token is
 * stored, without overriding headers the caller already set (e.g. chat.ts's
 * multipart requests, which must NOT get a Content-Type set here).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && token) {
    // The token we sent was rejected (expired, or the server restarted with a
    // new JWT_SECRET) - this is different from a route like /auth/login
    // returning 401 for a wrong password, which never sends a token in the
    // first place and so never hits this branch. Log out and bounce to login.
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** POST/PATCH/DELETE with a JSON body. */
export function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}