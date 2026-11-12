/**
 * Parses ALLOWED_EMAILS ("a@x.com, b@y.com") into a lowercase set.
 * An empty or missing value means sign-ups are open (local development).
 */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isEmailAllowed(email: string | null | undefined, allowed: Set<string>): boolean {
  if (allowed.size === 0) return true;
  if (!email) return false;
  return allowed.has(email.trim().toLowerCase());
}

export const SIGNUP_CLOSED = "signup_closed";
