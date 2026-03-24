"use client";

import React, { useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    ArrowRightLeft,
    Loader2,
} from "lucide-react";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { TableSkeleton } from "@/components/ui/ScreenSkeleton";
import { useRouter } from "next/navigation";

/* ── types ── */

interface PainelIntegracaoRow {
    id: string;
    nome: string;
    cpf: string | null;
    dataAdmissao: string | null;
    status: number;
    integracaoResultado: number | null; // 1=Sucesso, 2=Falha
    integracaoMensagem: string | null;
    approvedAtUtc: string | null;
    integradaEmUtc: string | null;
}

const RESULTADO_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    1: { label: "Sucesso", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    2: { label: "Falha", color: "bg-red-500/15 text-red-700", icon: XCircle },
};

type Filtro = "all" | "pendente" | "1" | "2";

/* ── component ── */

export default function AdmissaoIntegracaoScreen() {
    const router = useRouter();
    const [filtro, setFiltro] = useState<Filtro>("all");

    const params = filtro === "all" || filtro === "pendente" ? "" : `?resultado=${filtro}`;
    const { data = [], isLoading } = useApiQuery<PainelIntegracaoRow[]>(
        ["pre-admissao", "integracao", "painel", filtro],
        `/api/pre-admissao/integracao/painel${params}`
    );

    const rows = filtro === "pendente"
        ? data.filter((r) => r.integracaoResultado === null)
        : data;

    return (
        <section className="space-y-6">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Integração TOTVS</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Acompanhe o envio das pré-admissões aprovadas para o Progress Datasul
                    </p>
                </div>
            </div>

            {/* filters + table */}
            <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="flex flex-wrap gap-1 mb-4">
                    {(
                        [
                            { key: "all", label: "Todos" },
                            { key: "pendente", label: "Pendente" },
                            { key: "1", label: "Sucesso" },
                            { key: "2", label: "Falha" },
                        ] as { key: Filtro; label: string }[]
                    ).map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFiltro(f.key)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                filtro === f.key
                                    ? "bg-blue-600 text-white"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead className="text-center">Admissão</TableHead>
                            <TableHead className="text-center">Resultado</TableHead>
                            <TableHead>Mensagem</TableHead>
                            <TableHead className="text-right">Aprovada em</TableHead>
                            <TableHead className="text-right">Integrada em</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} className="py-4">
                                    <TableSkeleton rows={5} />
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <ArrowRightLeft className="size-10 opacity-20" />
                                        <p className="text-sm font-medium">Nenhum registro encontrado</p>
                                        <p className="text-xs opacity-70">
                                            Ajuste os filtros ou aguarde aprovações serem integradas.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((r) => {
                            const res = r.integracaoResultado != null ? RESULTADO_MAP[r.integracaoResultado] : null;
                            const ResIcon = res?.icon;
                            return (
                                <TableRow
                                    key={r.id}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => router.push(`/admissao/revisao?id=${r.id}`)}
                                >
                                    <TableCell className="font-semibold text-sm">{r.nome}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.cpf || "—"}</TableCell>
                                    <TableCell className="text-center text-xs">{r.dataAdmissao || "—"}</TableCell>
                                    <TableCell className="text-center">
                                        {res && ResIcon ? (
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${res.color}`}
                                            >
                                                <ResIcon className="size-3" /> {res.label}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700">
                                                <Clock className="size-3" /> Pendente
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                                        {r.integracaoMensagem || "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.approvedAtUtc
                                            ? new Date(r.approvedAtUtc).toLocaleDateString("pt-BR")
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.integradaEmUtc
                                            ? new Date(r.integradaEmUtc).toLocaleDateString("pt-BR")
                                            : "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="mt-3 text-xs text-muted-foreground">{rows.length} registros</div>
            </div>
        </section>
    );
}
