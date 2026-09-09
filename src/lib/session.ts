import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Retrieves the current session on the server side using the incoming request headers.
 */
export async function getSession() {
  const headerList = await headers();
  return await auth.api.getSession({
    headers: headerList,
  });
}

/**
 * Retrieves the authenticated user object or null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Enforces authentication on the server side.
 * Redirects unauthenticated requests to the login page.
 */
export async function requireAuth(returnUrl?: string) {
  const session = await getSession();
  if (!session?.user) {
    const query = returnUrl ? `?callbackUrl=${encodeURIComponent(returnUrl)}` : "";
    redirect(`/login${query}`);
  }
  return session;
}

/**
 * Enforces that a resource belongs to the currently authenticated user.
 * Throws a forbidden error if ownership check fails.
 */
export function assertUserOwnership(resourceUserId: string, currentUserId: string): void {
  if (!resourceUserId || !currentUserId || resourceUserId !== currentUserId) {
    throw new Error("Forbidden: You do not have permission to access this resource.");
  }
}