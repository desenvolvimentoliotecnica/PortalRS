export function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PROFILE_PRIORITY: ReadonlyArray<{ match: string; label?: string }> = [
  { match: "owner", label: "Owner" },
  { match: "administrador", label: "Administrador" },
  { match: "admin", label: "Administrador" },
  { match: "especialista de rh" },
  { match: "analista de rh" },
  { match: "gestor" },
  { match: "compliance" },
  { match: "recrutador" },
  { match: "operacional" },
  { match: "colaborador" },
  { match: "rh" },
];

/**
 * Returns the primary profile label to show in the topbar chip.
 * When the user has multiple roles, the most relevant business profile wins.
 */
export function resolvePrimaryProfileLabel(roles: string[] | undefined | null): string | null {
  if (!roles?.length) return null;

  const byNormalized = new Map<string, string>();
  for (const role of roles) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    byNormalized.set(normalizeRole(trimmed), trimmed);
  }

  if (byNormalized.size === 0) return null;

  for (const entry of PROFILE_PRIORITY) {
    const original = byNormalized.get(entry.match);
    if (original) return entry.label ?? original;
  }

  return roles.find((role) => role.trim())?.trim() ?? null;
}
