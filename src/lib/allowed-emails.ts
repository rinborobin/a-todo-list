/**
 * Parses ALLOWED_EMAILS ("a@x.com, b@y.com") into a lowercase set.
 */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Whether this address may create an account. An empty list means open
 * sign-up in development but closed sign-up in production, so a missing or
 * mistyped ALLOWED_EMAILS on the server never opens the app to everyone.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowed: Set<string>,
  { production = false }: { production?: boolean } = {}
): boolean {
  if (allowed.size === 0) return !production;
  if (!email) return false;
  return allowed.has(email.trim().toLowerCase());
}

export const SIGNUP_CLOSED = "signup_closed";
