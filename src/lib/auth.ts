import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { SIGNUP_CLOSED, isEmailAllowed, parseAllowedEmails } from "@/lib/allowed-emails";

// When ALLOWED_EMAILS is set, only those addresses can create an account
// (by email or Google). Existing accounts keep signing in normally.
const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // Development only: accept sign-ins from another device on the LAN.
  trustedOrigins:
    process.env.NODE_ENV !== "production" && process.env.DEV_NETWORK_ORIGIN
      ? [process.env.DEV_NETWORK_ORIGIN]
      : [],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    validateUserInfo: ({ user, source }) => {
      if (source.action !== "create-user") return;
      if (!isEmailAllowed(typeof user.email === "string" ? user.email : null, allowedEmails)) {
        return { error: SIGNUP_CLOSED, errorDescription: "Sign-ups are closed for this planner." };
      }
    },
  },
  // OAuth failures (including a closed sign-up) land back on the login page.
  onAPIError: {
    errorURL: "/login",
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
});