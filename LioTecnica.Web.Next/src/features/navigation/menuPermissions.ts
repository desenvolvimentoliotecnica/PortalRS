import type { BffMe } from "@/lib/schemas/bff";
import { buildNavItemsForPermissions, hasPermission } from "@/features/navigation/permissionManifest";

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
 * Returns the set of hrefs the user is allowed to access.
 * `null` = unrestricted (no URL-level blocking).
 * Non-null Set = allowlist derived from the user's permission set.
 *
 * Strategy:
 *  - Owner in owner context → unrestricted (own screens handled by AppShell)
 *  - Wildcard permission "*" (Owner in tenant) → unrestricted within tenant
 *  - Full-access roles (Admin, RH) have "access.manage" → unrestricted
 *  - Restricted roles (Gestor, Compliance) → allowlist from their permissions
 */
export function getVisibleMenuHrefs(me: BffMe): Set<string> | null {
  if (!me) return null;

  const permissions = me.permissions ?? [];

  // Owner in their own context: only owner screens, no tenant filtering needed here
  if (me.isOwnerContext) return null;

  // Wildcard → unrestricted (Owner inside a tenant)
  if (permissions.includes("*")) return null;

  // Full-access tenant roles have "access.manage" → no URL restrictions
  if (hasPermission(permissions, "access.manage")) return null;

  // Restricted roles: compute allowlist from their actual permissions
  const navItems = buildNavItemsForPermissions(permissions);
  if (navItems.length === 0) return new Set<string>(); // no access at all

  return new Set(navItems.map((item) => item.href));
}

/** Match exact OR prefix match by segment (e.g., `/gestao/aprovacoes/123` hits `/gestao/aprovacoes`). */
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
