import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,

  /**
   * We mount the Next app under `/app` to coexist with the ASP.NET MVC legacy
   * (route-by-route promotion + easy rollback).
   */
  basePath: "/app",

  images: {
    unoptimized: true, // Required for static export
  },

  async rewrites() {
    // Dev-only proxy to avoid CORS when API runs on a different port.
    // In production (S3/CloudFront) /api and /health are routed by the edge.
    if (process.env.NODE_ENV !== "development") return [];

    const apiOrigin = process.env.DEV_API_ORIGIN?.trim() || "http://localhost:5056";

    return [
      // API
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*`, basePath: false },
      // Health
      { source: "/health", destination: `${apiOrigin}/health`, basePath: false },
      // SignalR (when used)
      { source: "/hubs/:path*", destination: `${apiOrigin}/hubs/:path*`, basePath: false },
    ];
  },
};

export default nextConfig;
