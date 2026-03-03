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
    // In production, /api, /health and /bff are routed by reverse proxy/edge.
    if (process.env.NODE_ENV !== "development") return [];

    const apiOrigin = process.env.DEV_API_ORIGIN?.trim() || "http://localhost:5056";
    const bffOrigin = process.env.DEV_BFF_ORIGIN?.trim() || process.env.LEGACY_ORIGIN?.trim() || "http://localhost:5051";

    return [
      // API
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*`, basePath: false },
      // Health
      { source: "/health", destination: `${apiOrigin}/health`, basePath: false },
      // SignalR (when used)
      { source: "/hubs/:path*", destination: `${apiOrigin}/hubs/:path*`, basePath: false },
      // Legacy BFF (login/entra/switch-tenant while migration is in progress)
      { source: "/bff/:path*", destination: `${bffOrigin}/bff/:path*`, basePath: false },
    ];
  },
};

export default nextConfig;
