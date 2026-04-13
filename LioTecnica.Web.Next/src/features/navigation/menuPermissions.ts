import type { BffMe } from "@/lib/schemas/bff";
import { RECRUITMENT_ROUTE_KEYS } from "@/features/navigation/recruitmentNavigation";

/**
 * Allowlist de rotas que Gestor e Compliance conseguem enxergar/acessar.
 * Admin/Owner não são afetados — veem tudo.
 */
const GESTOR_COMPLIANCE_ALLOWLIST = new Set<string>([
  RECRUITMENT_ROUTE_KEYS.dashboard,
  RECRUITMENT_ROUTE_KEYS.aprovacoes,
  RECRUITMENT_ROUTE_KEYS.solicitacoes,
  RECRUITMENT_ROUTE_KEYS.painelSolicitacoes,
]);

function rolesOf(me: BffMe): Set<string> {
  return new Set((me.roles ?? []).map((r) => r.toLowerCase()));
}

export function isAdminOrOwner(me: BffMe): boolean {
  const roles = rolesOf(me);
  return (
    me.isAdmin ||
    me.isOwnerContext ||
    roles.has("admin") ||
    roles.has("administrador") ||
    roles.has("owner")
  );
}

export function isGestor(me: BffMe): boolean {
  return rolesOf(me).has("gestor");
}

export function isCompliance(me: BffMe): boolean {
  return rolesOf(me).has("compliance");
}

/**
 * Retorna o conjunto de hrefs permitidos para o usuário.
 * `null` = sem filtro (Admin/Owner, ou papéis não restritos).
 * Set não-vazio = allowlist (Gestor/Compliance).
 */
export function getVisibleMenuHrefs(me: BffMe): Set<string> | null {
  if (isAdminOrOwner(me)) return null;
  if (isGestor(me) || isCompliance(me)) return new Set(GESTOR_COMPLIANCE_ALLOWLIST);
  return null;
}

/** Match exato OU prefix match por segmento (ex: `/gestao/aprovacoes/123` bate com `/gestao/aprovacoes`). */
export function isHrefAllowed(href: string, allowed: Set<string> | null): boolean {
  if (!allowed) return true;
  const h = (href ?? "").toLowerCase().replace(/\/+$/, "") || "/";
  for (const a of allowed) {
    const al = a.toLowerCase().replace(/\/+$/, "");
    if (h === al) return true;
    if (al !== "/" && h.startsWith(al + "/")) return true;
  }
  return false;
}
