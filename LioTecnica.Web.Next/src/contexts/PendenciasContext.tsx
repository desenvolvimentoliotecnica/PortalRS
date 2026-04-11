"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/* ──────────────────────────── types ──────────────────────────── */

interface PendRow {
  id: string;
  aprovador1Id?: string | null;
  aprovador2Id?: string | null;
}

interface PendenciasContextValue {
  /** Total de pendências relevantes para o usuário logado */
  count: number;
  loading: boolean;
  /** Dispara re-fetch manual (ex: após aprovar/reprovar) */
  refresh: () => void;
}

/* ──────────────────────────── context ──────────────────────────── */

const PendenciasContext = createContext<PendenciasContextValue>({
  count: 0,
  loading: false,
  refresh: () => {},
});

export function usePendencias() {
  return useContext(PendenciasContext);
}

/* ──────────────────────────── helpers ──────────────────────────── */

async function fetchRows(url: string): Promise<PendRow[]> {
  try {
    const res = await apiFetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as PendRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Conta quantas rows são relevantes para o usuário:
 * - Nominadas (aprovador1Id ou aprovador2Id === meu funcionarioId)
 * - Fila de perfil aberta (aprovador1Id nulo — ainda não assumida)
 */
function countRelevant(rows: PendRow[], myFuncId: string | null): number {
  return rows.filter((r) => {
    const a1 = r.aprovador1Id;
    // Fila de perfil — não assumida ainda
    if (a1 === null || a1 === undefined || a1 === "") return true;
    // Nominada diretamente a mim
    if (myFuncId && (a1 === myFuncId || r.aprovador2Id === myFuncId)) return true;
    return false;
  }).length;
}

const TAB_APIS = [
  "/api/solicitacoes-vaga?status=1",
  "/api/colaborador/solicitacoes-ferias?status=1",
  "/api/colaborador/solicitacoes-beneficio?status=1",
  "/api/colaborador/solicitacoes-dependente?status=1",
  "/api/colaborador/solicitacoes-endereco?status=1",
];

/* ──────────────────────────── provider ──────────────────────────── */

export function PendenciasProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Cached funcionarioId to avoid repeated /api/me calls
  const myFuncIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(async () => {
    // Skip for owner context or unauthenticated state
    if (!me || me.isOwnerContext) return;

    setLoading(true);
    try {
      // Resolve funcionarioId lazily (one-time)
      if (!myFuncIdRef.current) {
        try {
          const meRes = await apiFetch("/api/me", { cache: "no-store" });
          if (meRes.ok) {
            const meData = (await meRes.json()) as Record<string, unknown>;
            if (meData?.funcionarioId) {
              myFuncIdRef.current = String(meData.funcionarioId);
            }
          }
        } catch {
          /* ignore — count will still work for fila items */
        }
      }

      // Fetch all tabs in parallel
      const results = await Promise.all(TAB_APIS.map(fetchRows));
      const total = results.reduce(
        (acc, rows) => acc + countRelevant(rows, myFuncIdRef.current),
        0,
      );
      setCount(total);
    } catch {
      // Fail silently — badge just stays at previous value
    } finally {
      setLoading(false);
    }
  }, [me]);

  const refresh = useCallback(() => {
    void doFetch();
  }, [doFetch]);

  useEffect(() => {
    if (!me || me.isOwnerContext) return;

    void doFetch();

    // Automatic refresh every 2 minutes
    timerRef.current = setInterval(() => void doFetch(), 120_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [me, doFetch]);

  return (
    <PendenciasContext.Provider value={{ count, loading, refresh }}>
      {children}
    </PendenciasContext.Provider>
  );
}
