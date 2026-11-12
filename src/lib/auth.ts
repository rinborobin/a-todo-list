import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { SIGNUP_CLOSED, isEmailAllowed, parseAllowedEmails } from "@/lib/allowed-emails";

const isProduction = process.env.NODE_ENV === "production";

// Only addresses in ALLOWED_EMAILS can create an account (by email or Google).
// In production a missing or empty list closes sign-up entirely. Existing
// accounts keep signing in normally.
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
    !isProduction && process.env.DEV_NETWORK_ORIGIN
      ? [process.env.DEV_NETWORK_ORIGIN]
      : [],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    validateUserInfo: ({ user, source }) => {
      if (source.action !== "create-user") return;
      const email = typeof user.email === "string" ? user.email : null;
      if (!isEmailAllowed(email, allowedEmails, { production: isProduction })) {
        return { error: SIGNUP_CLOSED, errorDescription: "Sign-ups are closed for this planner." };
      }
    },
  },
  // Rate limits (on in production) are counted in the database so they hold
  // across serverless instances; in memory each instance would count alone.
  rateLimit: {
    storage: "database",
  },
  advanced: {
    ipAddress: {
      // Set by Vercel and not spoofable by clients; x-forwarded-for elsewhere.
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
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