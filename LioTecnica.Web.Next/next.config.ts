import path from "path";
import type { NextConfig } from "next";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
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
    // In production, /api e /health são roteados pelo reverse proxy/edge.
    // Nota: /bff/* foi removido na Fase 13 (Portal MVC descomissionado) — tudo
    // que antes vivia no BFF agora é endpoint REST na RHPortal.Api (/api/...).
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
