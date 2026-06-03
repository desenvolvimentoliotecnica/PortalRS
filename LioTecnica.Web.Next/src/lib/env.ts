// Client-safe env — no server-only dependencies.
export const env = {
  API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "",
  /** Origem do legado/PortalVagas para forms (logout, etc.). Se vazio, usa path relativo (mesmo origin). */
  PORTAL_ORIGIN: process.env.NEXT_PUBLIC_PORTAL_ORIGIN ?? "",
  /** Origem do Portal de Vagas público novo (Vite/React). */
  PORTAL_VAGAS_URL: process.env.NEXT_PUBLIC_PORTAL_VAGAS_URL ?? "",
};
