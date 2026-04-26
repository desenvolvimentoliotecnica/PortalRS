"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
    RefreshCw,
    Search,
    UserMinus,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Loader2,
    Calendar,
    Hash,
    Users,
    Repeat2,
} from "lucide-react";

/**
 * Lista pipeline de desligamentos sincronizados do TOTVS RM (VREQDESLIGAMENTO).
 * Inclui flag GerouSubstituicao e link pro funcionário desligado.
 *
 * Diferente do DesligamentosScreen (que consome /api/solicitacoes-desligamento — Datasul),
 * este componente consome /api/desligamentos (TOTVS RM).
 */

interface DesligamentoListItem {
    id: string;
    idReqRm: string;
    chapaRm: string;
    funcionarioId?: string | null;
    funcionarioNome?: string | null;
    motivoRescisaoDescricao?: string | null;
    tipoRescisaoDescricao?: string | null;
    gerouSubstituicao: boolean;
    dataAbertura: string;
    dataConclusao?: string | null;
    codStatus: number;
    statusDescricao: string;
}

const STATUS_COLORS: Record<number, { bg: string; text: string; icon: React.ReactNode }> = {
    1: { bg: "bg-amber-100", text: "text-amber-800", icon: <Clock className="size-3" /> },
    2: { bg: "bg-blue-100", text: "text-blue-800", icon: <AlertTriangle className="size-3" /> },
    3: { bg: "bg-cyan-100", text: "text-cyan-800", icon: <CheckCircle2 className="size-3" /> },
    4: { bg: "bg-emerald-100", text: "text-emerald-800", icon: <CheckCircle2 className="size-3" /> },
    5: { bg: "bg-violet-100", text: "text-violet-800", icon: <Loader2 className="size-3" /> },
    6: { bg: "bg-rose-100", text: "text-rose-800", icon: <XCircle className="size-3" /> },
    7: { bg: "bg-rose-100", text: "text-rose-800", icon: <XCircle className="size-3" /> },
};

function StatusBadge({ codStatus, statusDescricao }: { codStatus: number; statusDescricao: string }) {
    const cfg = STATUS_COLORS[codStatus] ?? { bg: "bg-slate-100", text: "text-slate-700", icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${cfg.bg} ${cfg.text}`}>
            {cfg.icon}
            {statusDescricao}
        </span>
    );
}

function fmtDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
        return iso;
    }
}

export default function DesligamentosTotvsList() {
    const [items, setItems] = useState<DesligamentoListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<number | "">("");
    const [filterGerou, setFilterGerou] = useState<"" | "true" | "false">("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("take", "500");
            if (filterStatus !== "") params.set("codStatus", String(filterStatus));
            if (filterGerou !== "") params.set("gerouSubstituicao", filterGerou);
            const res = await apiFetch(`/api/desligamentos?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: DesligamentoListItem[] = await res.json();
            setItems(data);
        } catch (err) {
            console.error("Erro desligamentos:", err);
            toast.error("Erro ao carregar desligamentos TOTVS.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterGerou]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const term = search.toLowerCase().trim();
        return items.filter(
            (d) =>
                d.idReqRm.toLowerCase().includes(term) ||
                d.chapaRm.toLowerCase().includes(term) ||
                (d.funcionarioNome ?? "").toLowerCase().includes(term) ||
                (d.motivoRescisaoDescricao ?? "").toLowerCase().includes(term)
        );
    }, [items, search]);

    const stats = useMemo(() => {
        return {
            total: items.length,
            concluidos: items.filter((d) => d.codStatus === 4).length,
            comSubstituicao: items.filter((d) => d.gerouSubstituicao).length,
        };
    }, [items]);

    return (
        <div className="space-y-4">
            {/* Stats KPI */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">Concluídos</div>
                    <div className="text-2xl font-bold text-emerald-800 mt-1">{stats.concluidos}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs text-blue-700 flex items-center gap-1">
                        <Repeat2 className="size-3" /> Geram substituição
                    </div>
                    <div className="text-2xl font-bold text-blue-800 mt-1">{stats.comSubstituicao}</div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por chapa, nome, IDREQ, motivo..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-sm px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-blue-400"
                >
                    <option value="">Todos os status</option>
                    <option value="1">Aberta</option>
                    <option value="2">Em análise</option>
                    <option value="3">Aprovada</option>
                    <option value="4">Concluída</option>
                    <option value="6">Cancelada</option>
                    <option value="7">Rejeitada</option>
                </select>
                <select
                    value={filterGerou}
                    onChange={(e) => setFilterGerou(e.target.value as "" | "true" | "false")}
                    className="text-sm px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-blue-400"
                >
                    <option value="">Substituição: todos</option>
                    <option value="true">Gerou substituição</option>
                    <option value="false">Sem substituição</option>
                </select>
                <button
                    onClick={load}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Atualizar
                </button>
            </div>

            {/* Tabela */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="max-h-[calc(100dvh-380px)] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">
                                    <div className="flex items-center gap-1">
                                        <Hash className="size-3.5" /> IDREQ
                                    </div>
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Funcionário</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Chapa</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Motivo</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Tipo demissão</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="size-3.5" /> Abertura
                                    </div>
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Conclusão</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-700">Status</th>
                                <th className="text-center px-3 py-2 font-medium text-slate-700">Subst.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-8 text-slate-400">
                                        <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                                        Carregando...
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-8 text-slate-400">
                                        <UserMinus className="size-8 mx-auto mb-2 text-slate-300" />
                                        Nenhum desligamento encontrado.
                                    </td>
                                </tr>
                            )}
                            {filtered.map((d) => (
                                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600">#{d.idReqRm}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                        {d.funcionarioNome ?? <span className="text-slate-400 italic">CHAPA não vinculada</span>}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{d.chapaRm}</td>
                                    <td className="px-3 py-2 text-slate-700">{d.motivoRescisaoDescricao ?? "—"}</td>
                                    <td className="px-3 py-2 text-slate-600 text-xs">{d.tipoRescisaoDescricao ?? "—"}</td>
                                    <td className="px-3 py-2 text-slate-600 text-xs">{fmtDate(d.dataAbertura)}</td>
                                    <td className="px-3 py-2 text-slate-600 text-xs">{fmtDate(d.dataConclusao)}</td>
                                    <td className="px-3 py-2">
                                        <StatusBadge codStatus={d.codStatus} statusDescricao={d.statusDescricao} />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {d.gerouSubstituicao ? (
                                            <span title="Gerou vaga de substituição">
                                                <Repeat2 className="size-4 text-blue-600 mx-auto" />
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
                        Exibindo {filtered.length} de {items.length} desligamentos.
                    </div>
                )}
            </div>
        </div>
    );
}
