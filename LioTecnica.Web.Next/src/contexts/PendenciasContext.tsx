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

/* ──────────────────────────── provider ──────────────────────────── */

export function PendenciasProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(async () => {
    if (!me || me.isOwnerContext) return;

    setLoading(true);
    try {
      const res = await apiFetch("/api/aprovacoes/pendentes/count", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setCount(data.count ?? 0);
      }
    } catch {
      // Fail silently — badge stays at previous value
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
