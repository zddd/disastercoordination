/**
 * Authenticated fetch wrapper — automatically injects JWT token from cookies.
 * Use this instead of raw fetch() for all backend API calls.
 *
 * Usage:
 *   import { authFetch } from "@/lib/fetch";
 *   const data = await authFetch("/api/v1/helps").then(r => r.json());
 *   const result = await authFetch("/api/v1/helps", { method: "POST", body: formData });
 *
 * Token is read from document.cookie (set by login page after auth).
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : "http://localhost:8080/api/v1";

export function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  // Don't override Content-Type for FormData (browser auto-sets with boundary)
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init?.headers as Record<string, string>) || {}),
    },
  });
}

/**
 * Convenience: GET request that returns parsed JSON.
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Convenience: POST request that returns parsed JSON.
 */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Reads JWT token from browser cookie.
 */
function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; token=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}
