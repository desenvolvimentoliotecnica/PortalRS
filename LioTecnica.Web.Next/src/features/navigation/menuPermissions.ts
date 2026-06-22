import type { BffMe } from "@/lib/schemas/bff";
import { buildNavItemsForPermissions } from "@/features/navigation/permissionManifest";

/**
 * Helpers de classificação de papel. A allowlist de rotas foi movida para
 * o backend (`GET /api/navegacao/sidebar`) — o `NavegacaoSidebarProvider`
 * expõe `visibleHrefs` derivado da resposta. Este arquivo fica apenas com
 * utilitários que ainda são consumidos por componentes individuais
 * (selectors de perfil, helpers de guarda, etc).
 */

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
 * Hrefs base derivados das permissões JWT (manifesto frontend).
 * Garante sub-rotas operacionais (ex.: `/admissao/tracking/{id}`) mesmo quando
 * o item do sidebar vem bloqueado (`acessivel: false`) ou omitido.
 */
export function hrefsFromPermissions(permissions: readonly string[]): string[] {
  if (permissions.includes("*")) return ["*"];
  return buildNavItemsForPermissions([...permissions]).map((item) => item.href);
}

/** Match exact OR prefix match por segmento
 *  (ex.: `/gestao/aprovacoes/123` bate com `/gestao/aprovacoes`). */
export function isHrefAllowed(href: string, allowed: Set<string> | null): boolean {
  if (!allowed) return true;
  if (allowed.has("*")) return true;
  const h = (href ?? "").toLowerCase().replace(/\/+$/, "") || "/";
  for (const a of allowed) {
    const al = a.toLowerCase().replace(/\/+$/, "");
    if (h === al) return true;
    if (al !== "/" && h.startsWith(al + "/")) return true;
  }
  return false;
}
