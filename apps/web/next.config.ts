import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // News Radar currently fetches its public API from the browser.
  // Static export allows Cloudflare Pages to host the web app without a Node server.
  output: "export",
};

export default nextConfig;
