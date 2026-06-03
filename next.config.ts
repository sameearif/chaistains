import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR / static resources to be fetched from these
  // hosts (e.g. opening the site on your phone over the local network).
  allowedDevOrigins: ["67.194.231.148"],
};

export default nextConfig;
