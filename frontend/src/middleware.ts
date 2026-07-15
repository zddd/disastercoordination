/**
 * Next.js Middleware for role-based routing and auth guard.
 * See design §2.2 for the routing architecture.
 *
 * Flow:
 *   / → middleware checks role → redirects to appropriate section
 *   /login → anyone can access
 *   /help/* → victim role (public can also access)
 *   /admin/* → commander, reviewer, admin, operator roles
 *   /team/* → rescue_team role
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route patterns for role-based access
const ADMIN_ROLES = ["admin", "commander", "zone_commander", "reviewer", "operator"];
const TEAM_ROLES = ["rescue_team"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/files")
  ) {
    return NextResponse.next();
  }

  // Parse JWT token from cookie to determine role
  const token = request.cookies.get("token")?.value;
  let role = "";

  if (token) {
    try {
      // Parse JWT payload (without verification — server-side verification happens in API calls)
      const payload = JSON.parse(atob(token.split(".")[1]));
      role = payload.role || "";
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }

  // Route to appropriate section based on role
  if (pathname.startsWith("/admin")) {
    if (!role || !ADMIN_ROLES.includes(role)) {
      // Not authorized for admin — redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/team")) {
    if (!role || !TEAM_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // /help/* is accessible by anyone (including unauthenticated victims)
  if (pathname.startsWith("/help")) {
    return NextResponse.next();
  }

  // Root path — redirect to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
