"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { SolicitacaoVagaStatusBadgeEl } from "@/features/gestao/shared/solicitacaoVagaStatusUi";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHead,
    TableRow,
} from "@/components/ui/table";

const API = "/api/solicitacoes-vaga";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || res.statusText);
    }
    return (await res.json()) as T;
}

interface SolicitacaoGridRow {
    id: string;
    titulo: string;
    status: number | string;
    solicitanteNome: string | null;
    centroCustoNome?: string | null;
    rmUltimaStatusDescricaoRm?: string | null;
    rmCodStatus?: number | string | null;
    createdAtUtc: string;
}

function buildStatusesQuery(statusCodes: readonly string[]): string {
    const p = new URLSearchParams();
    for (const c of statusCodes) p.append("statuses", c);
    return p.toString();
}

type Props = {
    title: string;
    subtitle: string;
    statusPresets: { label: string; codes: readonly string[] }[];
};

export default function RhContratacoesListScreen({ title, subtitle, statusPresets }: Props) {
    const [presetIdx, setPresetIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);

    const activeCodes = useMemo(() => statusPresets[presetIdx]?.codes ?? [], [presetIdx, statusPresets]);

    const load = useCallback(async () => {
        const qs = buildStatusesQuery(activeCodes);
        setLoading(true);
        try {
            const data = await fetchJson<SolicitacaoGridRow[]>(`${API}?${qs}&pageSize=100`);
            setRows(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar lista");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [activeCodes]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                </Button>
            </div>

            <div className="flex flex-wrap gap-2">
                {statusPresets.map((p, i) => (
                    <Button key={p.label} size="sm" variant={presetIdx === i ? "default" : "outline"} onClick={() => setPresetIdx(i)}>
                        {p.label}
                    </Button>
                ))}
            </div>

            <div className="rounded-lg border bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Solicitação</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="hidden md:table-cell">Solicitante</TableHead>
                            <TableHead className="hidden lg:table-cell">RM</TableHead>
                            <TableHead className="hidden sm:table-cell">Criado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && !loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                    Nenhum registro com os filtros atuais.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>
                                        <Link className="font-medium text-primary hover:underline" href={`/rh/contratacoes/${encodeURIComponent(r.id)}`}>
                                            {r.titulo}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <SolicitacaoVagaStatusBadgeEl raw={r.status} />
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-sm">{r.solicitanteNome ?? "—"}</TableCell>
                                    <TableCell className="hidden lg:table-cell max-w-[220px] truncate text-xs text-muted-foreground" title={r.rmUltimaStatusDescricaoRm ?? ""}>
                                        {r.rmUltimaStatusDescricaoRm ?? (r.rmCodStatus != null ? `COD ${r.rmCodStatus}` : "—")}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell whitespace-nowrap text-xs text-muted-foreground">
                                        {formatDatePt(r.createdAtUtc)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function formatDatePt(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
        return "—";
    }
}
