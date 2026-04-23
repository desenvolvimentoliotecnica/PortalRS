import { z } from "zod";

/**
 * Schemas de navegação (sidebar) entregues pelo backend via `GET /api/navegacao/sidebar`.
 *
 * Substitui o manifesto code-first duplicado no frontend:
 *   - `permissionManifest.ts` (lista de itens + permissão requerida)
 *   - `LOCKED_NAV_HREFS` + `HIDDEN_ROUTES` (cadeados/ocultação hardcoded)
 *   - `getModuleKey()` + sets de rotas por módulo (agrupamento)
 *
 * O backend agora é a autoridade: resolve permissões, gating de módulo/pacote
 * e ordenação. O frontend apenas renderiza.
 */

/** Motivo pelo qual um item aparece bloqueado (ícone de cadeado + sem link). */
export const MOTIVO_BLOQUEIO_NAV = {
  SemPermissao: "sem-permissao",
  ModuloDesativado: "modulo-desativado",
  PacoteInativo: "pacote-inativo",
  PacoteNaoContratado: "pacote-nao-contratado",
} as const;

export type MotivoBloqueioNav =
  (typeof MOTIVO_BLOQUEIO_NAV)[keyof typeof MOTIVO_BLOQUEIO_NAV];

/** Item individual da sidebar (sempre leaf — a nova árvore é plana por grupo). */
export const NavItemResponseSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  icon: z.string().nullable().optional(),
  ordem: z.number().int(),
  moduloKey: z.string().nullable().optional(),
  packageKey: z.string().nullable().optional(),
  acessivel: z.boolean(),
  motivoBloqueio: z.string().nullable().optional(),
});

export type NavItemResponse = z.infer<typeof NavItemResponseSchema>;

/** Bucket de UI (principais, recrutamento-selecao, gestao-pessoas, ...). */
export const NavGrupoResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  ordem: z.number().int(),
  ocultarHeader: z.boolean(),
  itens: z.array(NavItemResponseSchema),
});

export type NavGrupoResponse = z.infer<typeof NavGrupoResponseSchema>;

/** Envelope retornado pelo endpoint. */
export const NavegacaoSidebarResponseSchema = z.object({
  grupos: z.array(NavGrupoResponseSchema),
  contextoEspecial: z.string().nullable().optional(),
});

export type NavegacaoSidebarResponse = z.infer<
  typeof NavegacaoSidebarResponseSchema
>;

/**
 * Permite parsear a resposta do backend aceitando tanto `grupos/itens` (camelCase)
 * quanto `Grupos/Itens` (PascalCase, caso o ASP.NET serializar sem camelCase policy).
 */
export function normalizeNavegacaoSidebarResponse(
  raw: unknown,
): NavegacaoSidebarResponse {
  if (!raw || typeof raw !== "object") {
    return { grupos: [], contextoEspecial: null };
  }
  const obj = raw as Record<string, unknown>;
  const grupos =
    (obj.grupos as unknown[] | undefined) ??
    (obj.Grupos as unknown[] | undefined) ??
    [];
  const contextoEspecial =
    (obj.contextoEspecial as string | null | undefined) ??
    (obj.ContextoEspecial as string | null | undefined) ??
    null;

  const normalizedGrupos = grupos.map((g) => normalizeGrupo(g));
  return NavegacaoSidebarResponseSchema.parse({
    grupos: normalizedGrupos,
    contextoEspecial,
  });
}

function normalizeGrupo(raw: unknown): NavGrupoResponse {
  const obj = (raw as Record<string, unknown>) ?? {};
  const itensRaw =
    (obj.itens as unknown[] | undefined) ??
    (obj.Itens as unknown[] | undefined) ??
    [];
  return {
    key: String(obj.key ?? obj.Key ?? ""),
    label: String(obj.label ?? obj.Label ?? ""),
    ordem: Number(obj.ordem ?? obj.Ordem ?? 0),
    ocultarHeader: Boolean(obj.ocultarHeader ?? obj.OcultarHeader ?? false),
    itens: itensRaw.map((i) => normalizeItem(i)),
  };
}

function normalizeItem(raw: unknown): NavItemResponse {
  const obj = (raw as Record<string, unknown>) ?? {};
  return {
    id: String(obj.id ?? obj.Id ?? ""),
    label: String(obj.label ?? obj.Label ?? ""),
    href: String(obj.href ?? obj.Href ?? ""),
    icon: (obj.icon ?? obj.Icon ?? null) as string | null,
    ordem: Number(obj.ordem ?? obj.Ordem ?? 0),
    moduloKey: (obj.moduloKey ?? obj.ModuloKey ?? null) as string | null,
    packageKey: (obj.packageKey ?? obj.PackageKey ?? null) as string | null,
    acessivel: Boolean(obj.acessivel ?? obj.Acessivel ?? true),
    motivoBloqueio: (obj.motivoBloqueio ?? obj.MotivoBloqueio ?? null) as
      | string
      | null,
  };
}
