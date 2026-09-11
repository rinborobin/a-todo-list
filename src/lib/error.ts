export function safeErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("connection") || message.includes("timeout") || message.includes("database")) {
      return fallback;
    }
    return err.message;
  }
  return fallback;
}
