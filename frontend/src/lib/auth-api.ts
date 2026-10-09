"use client";

// Calls to the V3 login API (/auth/*). Passwords go to the backend, which checks
// them with Amazon Cognito; the browser only ever holds the short-lived access token.

import { ApiError, apiBase } from "@/lib/api";

export type BackendRole = "public" | "student" | "coordinator" | "staff" | "admin";

export interface SessionUser {
  id: number;
  email: string;
  role: BackendRole;
}

export interface LoginResult {
  access_token: string;
  expires_in: number;
  role: BackendRole;
}

const TIMEOUT_MS = 10_000;

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json", ...init.headers },
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { detail = (await res.json()).detail ?? detail; } catch {}
      throw new ApiError(detail, res.status);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to connect to the API");
  } finally {
    clearTimeout(timer);
  }
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const login = (email: string, password: string) =>
  call<LoginResult>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const fetchMe = (token: string) => call<SessionUser>("/auth/me", { headers: bearer(token) });

export const logout = (token: string) => call<void>("/auth/logout", { method: "POST", headers: bearer(token) });
