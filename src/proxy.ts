import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/today", "/tasks", "/week", "/progress", "/focus", "/me", "/dashboard", "/planner", "/availability"];
const AUTH_PAGES = ["/login", "/register"];

/**
 * Optimistic routing based on the presence of the session cookie. The
 * authoritative check happens server-side in the protected layout and in every
 * server action via requireAuth().
 */
export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  const { pathname } = request.nextUrl;
  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  // Redirect unauthenticated requests to login
  if (isProtectedPath && !sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated requests away from login/register
  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/today/:path*",
    "/tasks/:path*",
    "/week/:path*",
    "/progress/:path*",
    "/focus/:path*",
    "/me/:path*",
    "/dashboard/:path*",
    "/planner/:path*",
    "/availability/:path*",
    "/login",
    "/register",
  ],
};
