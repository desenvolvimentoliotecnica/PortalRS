"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { buildEffectiveVisibleHrefs } from "@/features/navigation/menuPermissions";
import {
  normalizeNavegacaoSidebarResponse,
  type NavegacaoSidebarResponse,
  type NavGrupoResponse,
  type NavItemResponse,
} from "@/lib/schemas/navegacao";
import type { BffNavItem } from "@/lib/schemas/bff";

/**
 * Contexto que expõe os grupos/itens de navegação entregues pelo backend
 * (endpoint `GET /api/navegacao/sidebar`). Substitui o manifesto code-first
 * duplicado no frontend.
 *
 * Fornece também `visibleHrefs`: a allowlist de rotas derivada da resposta,
 * consumida por `RouteAllowlistGuard` para bloquear acesso direto por URL.
 */
interface NavegacaoSidebarContextValue {
  loading: boolean;
  grupos: NavGrupoResponse[];
  /** Lista plana (de grupos + itens) usada por busca global / topbar. */
  flatItems: BffNavItem[];
  contextoEspecial: string | null;
  /** Allowlist de hrefs acessíveis; `null` = sem filtro (owner-root, wildcard). */
  visibleHrefs: Set<string> | null;
  /** Owner em contexto "owner" puro — AppShell injeta OWNER_NAV_ITEMS. */
  isOwnerRoot: boolean;
}

const NavegacaoSidebarContext = createContext<NavegacaoSidebarContextValue>({
  loading: true,
  grupos: [],
  flatItems: [],
  contextoEspecial: null,
  visibleHrefs: null,
  isOwnerRoot: false,
});

export function NavegacaoSidebarProvider({ children }: { children: ReactNode }) {
  const { me, loading: authLoading } = useAuth();
  const [data, setData] = useState<NavegacaoSidebarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!me) {
        setData(null);
        setLoading(false);
        return;
      }

      // Owner em contexto "owner" puro: o endpoint retorna contextoEspecial="owner-root"
      // e o AppShell injeta OWNER_NAV_ITEMS. Chamada segue igual.
      setLoading(true);
      try {
        const res = await apiFetch("/api/navegacao/sidebar", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const json = await res.json();
        const parsed = normalizeNavegacaoSidebarResponse(json);
        if (!cancelled) {
          setData(parsed);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData({ grupos: [], contextoEspecial: null });
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [me, authLoading]);

  const value = useMemo<NavegacaoSidebarContextValue>(() => {
    const grupos = data?.grupos ?? [];
    const contextoEspecial = data?.contextoEspecial ?? null;
    const isOwnerRoot = contextoEspecial === "owner-root";

    const flatItems: BffNavItem[] = grupos.flatMap((g) =>
      g.itens.map((it) => navItemResponseToBff(it)),
    );

    // Allowlist: hrefs do sidebar + hrefs das permissões JWT (sub-rotas como
    // /admissao/tracking/* herdam do prefixo /admissao via isHrefAllowed).
    // Owner wildcard / owner-root → sem filtro.
    let visibleHrefs: Set<string> | null = null;
    const isOwnerWildcard =
      !!me && (me.permissions ?? []).includes("*");
    if (!isOwnerRoot && !isOwnerWildcard) {
      const hrefs = new Set<string>();
      for (const g of grupos) {
        for (const it of g.itens) {
          if (it.href) hrefs.add(it.href);
          if (it.id === "nav-portalvagas") hrefs.add("/portalvagas");
        }
      }
      visibleHrefs = buildEffectiveVisibleHrefs(hrefs, me?.permissions ?? []);
    }

    return {
      loading,
      grupos,
      flatItems,
      contextoEspecial,
      visibleHrefs,
      isOwnerRoot,
    };
  }, [data, loading, me]);

  return (
    <NavegacaoSidebarContext.Provider value={value}>
      {children}
    </NavegacaoSidebarContext.Provider>
  );
}

export function useNavegacaoSidebar() {
  return useContext(NavegacaoSidebarContext);
}

/** Converte um `NavItemResponse` para o formato `BffNavItem` já existente
 *  (mantém compatibilidade com GlobalSearchDialog, Topbar, etc). */
export function navItemResponseToBff(it: NavItemResponse): BffNavItem {
  return {
    id: it.id,
    label: it.label,
    href: it.href,
    icon: it.icon ?? undefined,
    openInNewTab: it.openInNewTab ?? false,
    children: [],
  };
}
