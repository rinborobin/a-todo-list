import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Optional, development only: lets another device on the LAN (e.g. a phone at
// http://192.168.x.x:3000) load dev assets. Set DEV_NETWORK_ORIGIN in .env.local.
const devNetworkHost = process.env.DEV_NETWORK_ORIGIN
  ? new URL(process.env.DEV_NETWORK_ORIGIN).hostname
  : undefined;

// Sent on every response. A full script CSP needs per-request nonces, so this
// policy covers the parts that need no nonce: no framing (clickjacking), no
// plugins, and no rewriting of the base URL or form targets.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Browsers only honour this over HTTPS, so it is inert on http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Course outline photos and PDFs go through a Server Action; Vercel caps bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  allowedDevOrigins: devNetworkHost ? [devNetworkHost] : [],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/today", permanent: true },
      { source: "/planner", destination: "/week", permanent: true },
      { source: "/availability", destination: "/me", permanent: true },
    ];
  },
};

export default nextConfig;
