import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode em dev causa double-render de todos os componentes (consumo extra de RAM/CPU).
  // Reabilite antes de build de produção para pegar efeitos colaterais.
  reactStrictMode: process.env.NODE_ENV === "production",
  output: "export",

  /**
   * We mount the Next app under `/app` to coexist with the ASP.NET MVC legacy
   * (route-by-route promotion + easy rollback).
   */
  basePath: "/app",

  /**
   * Pin Turbopack's workspace root to THIS directory so it doesn't pick up
   * a stray package-lock.json higher in the filesystem (e.g. C:\Users\davio).
   * Without this, the first request to any route may return 404 while
   * Turbopack resolves modules from the wrong root.
   */
  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    // Static export não suporta o otimizador padrão do Next/Image.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },

  compress: true,

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-popover",
      "@radix-ui/react-tabs",
      "@tanstack/react-query",
    ],
  },

  /**
   * URLs antigas de cargos TOTVS → tela unificada /cargos (export estático: usar também rewrite no host se necessário).
   */
  async redirects() {
    return [
      { source: "/totvs-cargos", destination: "/cargos", permanent: true },
    ];
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
