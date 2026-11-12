import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

/**
 * An error whose message is written for the user and safe to show as is.
 * Anything else (driver errors, constraint names, stack details) is hidden.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Turns any caught error into a message that is safe to send to the client.
 * Only UserFacingError messages and the first Zod issue pass through; every
 * other error is logged on the server and replaced by the fallback.
 */
export function safeErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  // Let Next.js control flow (redirect to /login, notFound) through instead of
  // turning it into an error message.
  unstable_rethrow(err);
  if (err instanceof UserFacingError) return err.message;
  if (err instanceof ZodError) return err.issues[0]?.message ?? fallback;
  console.error(err);
  return fallback;
}
