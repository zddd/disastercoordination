/**
 * API client configuration for backend communication.
 * Auto-injects JWT token from cookies into Authorization header.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface RequestConfig extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Typed fetch wrapper for backend API calls.
 * Automatically sets Content-Type and Authorization headers.
 *
 * @example
 *   const helps = await api.get("/helps?disaster_id=xxx");
 *   const created = await api.post("/helps", { category: "trapped", ... });
 */
export const api = {
  async get<T = unknown>(path: string, config?: RequestConfig): Promise<T> {
    return request<T>("GET", path, undefined, config);
  },

  async post<T = unknown>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>("POST", path, body, config);
  },

  async put<T = unknown>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>("PUT", path, body, config);
  },

  async delete<T = unknown>(path: string, config?: RequestConfig): Promise<T> {
    return request<T>("DELETE", path, undefined, config);
  },
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Auto-inject JWT from cookies
  const token = getCookie("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
    ...config,
    body: undefined,
  };

  if (body !== undefined) {
    init.body = (body instanceof FormData ? body : JSON.stringify(body)) as BodyInit;
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "request failed" }));
    throw new ApiError(response.status, error.error || "request failed", error);
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}
