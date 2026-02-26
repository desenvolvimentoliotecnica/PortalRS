import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * We mount the Next app under `/app` to coexist with the ASP.NET MVC legacy
   * (route-by-route promotion + easy rollback).
   */
  basePath: "/app",

  turbopack: {
    // Avoid Next picking unrelated lockfiles outside this project.
    root: __dirname,
  },

  async rewrites() {
    const legacyOrigin = process.env.LEGACY_ORIGIN;
    if (!legacyOrigin) return [];

    return [
      // Minimal BFF surface consumed by SSR in the Next app.
      { source: "/bff/:path*", destination: `${legacyOrigin}/bff/:path*` },

      // Assets referenced by the legacy login page (same absolute paths).
      { source: "/images/:path*", destination: `${legacyOrigin}/images/:path*` },

      /**
       * Recrutamento (legado) — proxiar APIs consumidas no browser.
       * Com `basePath: "/app"`, requisições para `/app/api/*` chegam no Next como `/api/*`.
       */
      { source: "/api/:path*", destination: `${legacyOrigin}/api/:path*` },
      { source: "/:module/_api/:path*", destination: `${legacyOrigin}/:module/_api/:path*` },
      // Nested _api paths (e.g. /Owner/Tenants/_api/list, /Owner/Tenants/{id}/Config/Logs/_api/...)
      { source: "/:a/:b/_api/:path*", destination: `${legacyOrigin}/:a/:b/_api/:path*` },
      { source: "/:a/:b/:c/_api/:path*", destination: `${legacyOrigin}/:a/:b/:c/_api/:path*` },
      { source: "/:a/:b/:c/:d/_api/:path*", destination: `${legacyOrigin}/:a/:b/:c/:d/_api/:path*` },
      { source: "/:a/:b/:c/:d/:e/_api/:path*", destination: `${legacyOrigin}/:a/:b/:c/:d/:e/_api/:path*` },
      { source: "/:a/:b/:c/:d/:e/:f/_api/:path*", destination: `${legacyOrigin}/:a/:b/:c/:d/:e/:f/_api/:path*` },

      // SignalR hubs (EntradaEmailPasta).
      { source: "/hubs/:path*", destination: `${legacyOrigin}/hubs/:path*` },

      /**
       * Portal Vagas (legado) — endpoints consumidos no browser pela UI migrada.
       * Mantemos a UI do Portal Vagas em `/app/PortalVagas/*` (por causa do basePath),
       * mas as APIs no legado continuam em `/PortalVagas/*`.
       */
      { source: "/PortalVagas/Agenda", destination: `${legacyOrigin}/PortalVagas/Agenda` },
      { source: "/PortalVagas/Agenda/:path*", destination: `${legacyOrigin}/PortalVagas/Agenda/:path*` },
    ];
  },
};

export default nextConfig;
