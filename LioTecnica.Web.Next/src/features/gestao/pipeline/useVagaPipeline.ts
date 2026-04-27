"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { VagaPipelineFiltros, VagaPipelineResponse } from "./types";

interface UseVagaPipelineResult {
    data: VagaPipelineResponse | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

function buildQueryString(filtros: VagaPipelineFiltros): string {
    const params = new URLSearchParams();
    if (filtros.origem !== undefined) params.set("origem", String(filtros.origem));
    if (filtros.centroCustoId) params.set("centroCustoId", filtros.centroCustoId);
    if (filtros.q && filtros.q.trim()) params.set("q", filtros.q.trim());
    if (filtros.incluirZumbis !== undefined) params.set("incluirZumbis", String(filtros.incluirZumbis));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
}

export function useVagaPipeline(filtros: VagaPipelineFiltros): UseVagaPipelineResult {
    const [data, setData] = useState<VagaPipelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const qs = buildQueryString(filtros);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/vagas/pipeline${qs}`, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
            }
            const json = (await res.json()) as VagaPipelineResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "erro");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [qs]);

    useEffect(() => {
        refresh().catch(() => { /* tratado em refresh */ });
    }, [refresh]);

    return { data, loading, error, refresh };
}
