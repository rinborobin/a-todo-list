/**
 * Accepts only same-site paths ("/tasks", "/tasks/abc?x=1"). Anything else,
 * including protocol-relative URLs like "//evil.example", falls back.
 */
export function safeCallbackUrl(value: string | undefined | null, fallback = "/today"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
