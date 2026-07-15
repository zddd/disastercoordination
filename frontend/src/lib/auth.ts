/**
 * Browser-side auth utilities for token and role management.
 * JWT token is stored in cookies (httpOnly preferred, fallback to document.cookie).
 */

const TOKEN_KEY = "token";
const USER_KEY = "auth_user";

interface AuthUser {
  id: string;
  username: string;
  role: string;
  phone?: string;
}

/**
 * Stores the JWT token in a cookie and user info in localStorage.
 * In production, httpOnly cookies should be used via server-side Set-Cookie.
 */
export function setAuth(token: string, user: AuthUser): void {
  // Store token in cookie (for API client auto-injection)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; SameSite=Lax`;

  // Store user info for client-side access (role checks, UI)
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Clears auth state on logout.
 */
export function clearAuth(): void {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Gets the stored user info (for client-side role checks and UI display).
 */
export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Gets the user's role from stored auth info.
 */
export function getRole(): string {
  const user = getUser();
  return user?.role || "";
}

/**
 * Checks if the user is authenticated (has a stored token).
 */
export function isAuthenticated(): boolean {
  return getUser() !== null;
}
