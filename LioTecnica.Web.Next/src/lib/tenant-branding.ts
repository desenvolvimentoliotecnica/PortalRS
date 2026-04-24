/**
 * Tenant branding white-label — helpers compartilhados entre tela de login (público)
 * e tela admin (privada). Define defaults de plataforma que substituem qualquer campo
 * null vindo da API (semântica: `null` = "usar default").
 */

import { apiFetch } from "@/lib/api";

export type TenantBrandingPublic = {
  nomePortal: string | null;
  subtitulo: string | null;
  rodapeTexto: string | null;
  corPrimariaHex: string | null;
  corSecundariaHex: string | null;
  logoUrl: string | null;
  versaoExibida: string | null;
};

export type TenantBrandingAdmin = TenantBrandingPublic & {
  updatedAtUtc: string | null;
};

export type TenantBrandingUpsert = {
  nomePortal?: string | null;
  subtitulo?: string | null;
  rodapeTexto?: string | null;
  corPrimariaHex?: string | null;
  corSecundariaHex?: string | null;
  logoUrl?: string | null;
  versaoExibida?: string | null;
};

/**
 * Defaults da plataforma. Cada campo aqui é o que aparece quando o tenant não tem override.
 * Manter em sync com <c>LoginScreen.tsx</c> original.
 */
export const BRANDING_DEFAULTS = {
  nomePortal: "Portal de RH",
  subtitulo: "Gestão de pessoas e recrutamento",
  rodapeTexto: "© {ano} · Portal de RH",
  corPrimariaHex: "#0C3A64",
  corSecundariaHex: "#105291",
  versaoExibida: "v3.0",
  logoUrl: null as string | null,
} as const;

/**
 * Resolve um campo aplicando o default quando o tenant não tiver override.
 * Sempre retorna string não-nula para facilitar o consumo na UI.
 */
export function applyBrandingDefaults(branding: TenantBrandingPublic | null): {
  nomePortal: string;
  subtitulo: string;
  rodapeTexto: string;
  corPrimariaHex: string;
  corSecundariaHex: string;
  versaoExibida: string;
  logoUrl: string | null;
} {
  return {
    nomePortal: branding?.nomePortal?.trim() || BRANDING_DEFAULTS.nomePortal,
    subtitulo: branding?.subtitulo?.trim() || BRANDING_DEFAULTS.subtitulo,
    rodapeTexto: branding?.rodapeTexto?.trim() || BRANDING_DEFAULTS.rodapeTexto,
    corPrimariaHex: branding?.corPrimariaHex?.trim() || BRANDING_DEFAULTS.corPrimariaHex,
    corSecundariaHex: branding?.corSecundariaHex?.trim() || BRANDING_DEFAULTS.corSecundariaHex,
    versaoExibida: branding?.versaoExibida?.trim() || BRANDING_DEFAULTS.versaoExibida,
    logoUrl: branding?.logoUrl?.trim() || BRANDING_DEFAULTS.logoUrl,
  };
}

/**
 * Regex de slug idêntico ao do backend (TenantMiddleware) — evita fetch
 * com slug inválido que renderizaria 400 bonito mas inútil.
 */
const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9\-]{1,62}$/i;

export function isValidTenantSlug(slug: string): boolean {
  return TENANT_SLUG_PATTERN.test(slug);
}

/**
 * Busca branding público (pré-login) pelo slug. Sempre resolve — slug inválido,
 * tenant inexistente ou erro de rede resolvem em `null`, deixando o chamador
 * cair para os defaults via <c>applyBrandingDefaults</c>.
 */
export async function fetchPublicBranding(slug: string | null | undefined): Promise<TenantBrandingPublic | null> {
  if (!slug) return null;
  const s = slug.trim().toLowerCase();
  if (!isValidTenantSlug(s)) return null;
  try {
    const res = await apiFetch(`/api/public/branding?tenant=${encodeURIComponent(s)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TenantBrandingPublic | null;
    return json ?? null;
  } catch {
    return null;
  }
}

/**
 * Substitui o placeholder `{ano}` no rodapé pelo ano corrente. Útil tanto para
 * o default quanto para overrides que o admin quiser usar.
 */
export function renderFooterText(raw: string): string {
  const year = new Date().getFullYear();
  return raw.replace(/\{ano\}/gi, String(year));
}

/* ──────────────────── Admin API helpers (autenticado) ──────────────────── */

export async function getTenantBrandingAdmin(): Promise<TenantBrandingAdmin> {
  const res = await apiFetch("/api/tenant-branding", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as TenantBrandingAdmin;
}

export async function upsertTenantBranding(body: TenantBrandingUpsert): Promise<TenantBrandingAdmin> {
  const res = await apiFetch("/api/tenant-branding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as TenantBrandingAdmin;
}

export async function resetTenantBranding(): Promise<void> {
  const res = await apiFetch("/api/tenant-branding", { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}
