"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  DashboardAgregadoResponse,
  PerfilAgregado,
} from "./dashboardAgregadoTypes";

export interface UseDashboardAgregadoResult {
  data: DashboardAgregadoResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Carrega /api/dashboard/agregado?perfil=... com isolamento por tenant e retorna o payload
 * bruto do backend. O caller decide qual seção exibir (ver DashboardVisaoPorPerfilScreen).
 *
 * Sessão 31: perfil sem dados → seção null (não 403); perfil inválido → 400.
 */
export function useDashboardAgregado(perfil: PerfilAgregado): UseDashboardAgregadoResult {
  const [data, setData] = useState<DashboardAgregadoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/dashboard/agregado?perfil=${encodeURIComponent(perfil)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        if (res.status === 400) {
          setError("Perfil inválido para o dashboard agregado.");
        } else if (res.status === 401 || res.status === 403) {
          setError("Sem permissão para visualizar o dashboard.");
        } else {
          setError(`Falha ao carregar dashboard (HTTP ${res.status}).`);
        }
        setData(null);
        return;
      }
      const payload = (await res.json()) as DashboardAgregadoResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [perfil]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
