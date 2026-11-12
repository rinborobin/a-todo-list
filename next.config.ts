import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Optional, development only: lets another device on the LAN (e.g. a phone at
// http://192.168.1.33:3000) load dev assets. Set DEV_NETWORK_ORIGIN in .env.local.
const devNetworkHost = process.env.DEV_NETWORK_ORIGIN
  ? new URL(process.env.DEV_NETWORK_ORIGIN).hostname
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: devNetworkHost ? [devNetworkHost] : [],
  async redirects() {
    return [
      { source: "/dashboard", destination: "/today", permanent: true },
      { source: "/planner", destination: "/week", permanent: true },
      { source: "/availability", destination: "/me", permanent: true },
    ];
  },
};

export default nextConfig;
