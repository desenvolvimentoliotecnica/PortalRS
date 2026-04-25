"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Cake, Clock, ArrowRight, TrendingUp, UserMinus, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type OrgEstruturaResponse, getSubordinados, type SubordinadoEntry } from "@/lib/organograma";
import DesligamentoFormModal from "@/features/gestao/desligamentos/DesligamentoFormModal";
import PromocaoFormModal from "@/features/gestao/promocoes/PromocaoFormModal";
import FuncionarioDetailDialog from "@/features/cadastros/funcionarios/FuncionarioDetailDialog";

function Progress({ value, className }: { value: number; className?: string }) {
    return (
        <div className={`h-1.5 w-full rounded-full bg-muted overflow-hidden ${className ?? ""}`}>
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
    );
}

interface Subordinado {
    id: string;
    nome: string;
    email: string | null;
    cargo: string | null;
    area: string | null;
    avatarUrl: string | null;
    dataAdmissao: string | null;
    emExperiencia: boolean;
    diasRestantesExperiencia: number | null;
    progressoExperiencia: number | null;
    proximoAniversario: string | null;
    diasParaAniversario: number | null;
}

interface Headcount {
    autorizado: number;
    ocupado: number;
    disponivel: number;
    provisorio: number;
}

interface Aniversario {
    id: string;
    name: string;
    diasFaltando: number;
    dataAniversario: string;
}

function Avatar({ nome, url }: { nome: string; url: string | null }) {
    if (url) return <img src={url} alt={nome} className="size-8 rounded-full object-cover" />;
    return (
        <div className="size-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold shrink-0">
            {nome.charAt(0).toUpperCase()}
        </div>
    );
}

/* ── Tree row types ── */
type TreeRow =
    | { type: "header"; label: string; depth: number }
    | (SubordinadoEntry & { type: "item" });

function buildTreeRows(entries: SubordinadoEntry[]): TreeRow[] {
    const rows: TreeRow[] = [];
    let lastSublabel = "";
    for (const entry of entries) {
        if (entry.sublabel !== lastSublabel) {
            rows.push({ type: "header", label: entry.sublabel, depth: entry.depth });
            lastSublabel = entry.sublabel;
        }
        rows.push(entry);
    }
    return rows;
}

export default function MeuTimeScreen() {
    const [time, setTime] = useState<Subordinado[]>([]);
    const [headcount, setHeadcount] = useState<Headcount | null>(null);
    const [aniversarios, setAniversarios] = useState<Aniversario[]>([]);
    const [subordinados, setSubordinados] = useState<SubordinadoEntry[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── modais de solicitação ── */
    const [desligamentoOpen, setDesligamentoOpen] = useState(false);
    const [movimentacaoOpen, setMovimentacaoOpen] = useState(false);
    const [targetFuncId, setTargetFuncId] = useState<string | null>(null);
    const [profileFuncId, setProfileFuncId] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            apiFetch("/api/gestao/meu-time").then((r) => r.json() as Promise<Subordinado[]>),
            apiFetch("/api/gestao/headcount-area").then((r) => r.json() as Promise<Headcount>),
            apiFetch("/api/gestao/aniversarios?dias=30").then((r) => r.json() as Promise<Aniversario[]>),
            apiFetch("/api/organograma/estrutura", { cache: "no-store" }).then((r) => r.json() as Promise<OrgEstruturaResponse>),
            apiFetch("/api/me", { cache: "no-store" }).then((r) => r.json() as Promise<{ funcionarioId?: string }>),
        ])
            .then(([t, h, a, org, me]) => {
                setTime(Array.isArray(t) ? t : []);
                setHeadcount(h ?? null);
                setAniversarios(Array.isArray(a) ? a : []);
                const meuId = me?.funcionarioId ?? null;
                if (meuId) {
                    setSubordinados(getSubordinados(org, meuId));
                }
            })
            .catch(() => toast.error("Erro ao carregar dados do time."))
            .finally(() => setLoading(false));
    }, []);

    const emExperiencia = time.filter((f) => f.emExperiencia);
    // Map for quick lookup of detail data by id
    const timeMap = new Map(time.map((f) => [f.id, f]));

    const treeRows = buildTreeRows(subordinados);

    function openDesligamento(funcId: string) {
        setTargetFuncId(funcId);
        setDesligamentoOpen(true);
    }

    function openMovimentacao(funcId: string) {
        setTargetFuncId(funcId);
        setMovimentacaoOpen(true);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Carregando dados do time...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight">Meu Time</h2>
                <p className="text-muted-foreground text-sm">Visão hierárquica dos seus subordinados</p>
            </div>

            {/* ── Cards de Headcount ── */}
            {headcount && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Autorizado", value: headcount.autorizado, color: "text-foreground" },
                        { label: "Ocupado", value: headcount.ocupado, color: "text-violet-700" },
                        { label: "Disponível", value: headcount.disponivel, color: headcount.disponivel > 0 ? "text-emerald-700" : "text-muted-foreground" },
                        { label: "Provisório", value: headcount.provisorio, color: "text-amber-600" },
                    ].map((item) => (
                        <Card key={item.label} className="text-center">
                            <CardContent className="pt-4 pb-3">
                                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-4">
                {/* ── Em Experiência ── */}
                {emExperiencia.length > 0 && (
                    <Card className="lg:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Clock className="size-4 text-amber-500" />
                                Em Período de Experiência ({emExperiencia.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {emExperiencia.map((f) => (
                                <div key={f.id} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Avatar nome={f.nome} url={f.avatarUrl} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{f.nome}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {f.diasRestantesExperiencia} dias restantes
                                            </p>
                                        </div>
                                    </div>
                                    {f.progressoExperiencia != null && (
                                        <Progress value={f.progressoExperiencia} className="h-1.5" />
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* ── Aniversários ── */}
                {aniversarios.length > 0 && (
                    <Card className="lg:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Cake className="size-4 text-pink-500" />
                                Aniversários (próximos 30 dias)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {aniversarios.slice(0, 6).map((a) => (
                                <div key={a.id} className="flex items-center justify-between">
                                    <p className="text-sm truncate">{a.name}</p>
                                    <Badge variant={a.diasFaltando === 0 ? "default" : "secondary"} className="text-xs shrink-0">
                                        {a.diasFaltando === 0
                                            ? "Hoje! 🎉"
                                            : a.diasFaltando === 1
                                            ? "Amanhã"
                                            : `${a.diasFaltando}d`}
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Árvore Hierárquica ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="size-4 text-violet-600" />
                        Time Completo ({subordinados.length > 0 ? subordinados.length : time.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {subordinados.length === 0 && time.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-6">
                            Nenhum subordinado encontrado.
                        </p>
                    ) : subordinados.length > 0 ? (
                        <div className="divide-y">
                            {treeRows.map((row, idx) => {
                                if (row.type === "header") {
                                    return (
                                        <div
                                            key={`header-${idx}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border/40"
                                            style={{ paddingLeft: `${16 + row.depth * 20}px` }}
                                        >
                                            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                {row.label}
                                            </span>
                                        </div>
                                    );
                                }

                                const detail = timeMap.get(row.id);
                                return (
                                    <div
                                        key={row.id}
                                        className="flex items-center gap-3 py-2.5 pr-3 hover:bg-muted/30 transition-colors"
                                        style={{ paddingLeft: `${20 + row.depth * 20}px` }}
                                    >
                                        <Avatar nome={row.name} url={detail?.avatarUrl ?? null} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-sm font-medium truncate">{row.name}</p>
                                                {row.isGestor && (
                                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                                                        GESTOR
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {row.cargo ?? "—"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {detail?.emExperiencia && (
                                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 hidden sm:inline-flex">
                                                    Experiência
                                                </Badge>
                                            )}
                                            {detail?.diasParaAniversario != null && detail.diasParaAniversario <= 7 && (
                                                <Badge variant="outline" className="text-xs text-pink-600 border-pink-300 hidden sm:inline-flex">
                                                    🎂 {detail.diasParaAniversario === 0 ? "Hoje" : `${detail.diasParaAniversario}d`}
                                                </Badge>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Solicitar movimentação"
                                                className="text-muted-foreground hover:text-violet-600"
                                                onClick={() => openMovimentacao(row.id)}
                                            >
                                                <TrendingUp className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Solicitar desligamento"
                                                className="text-muted-foreground hover:text-red-600"
                                                onClick={() => openDesligamento(row.id)}
                                            >
                                                <UserMinus className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Ver perfil"
                                                className="text-muted-foreground hover:text-violet-600"
                                                onClick={() => setProfileFuncId(row.id)}
                                            >
                                                <ArrowRight className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* fallback: flat list if org structure not available */
                        <div className="divide-y">
                            {time.map((f) => (
                                <div key={f.id} className="flex items-center gap-3 py-3 px-4">
                                    <Avatar nome={f.nome} url={f.avatarUrl} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{f.nome}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {[f.cargo, f.area].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            title="Solicitar movimentação"
                                            className="text-muted-foreground hover:text-violet-600"
                                            onClick={() => openMovimentacao(f.id)}
                                        >
                                            <TrendingUp className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            title="Solicitar desligamento"
                                            className="text-muted-foreground hover:text-red-600"
                                            onClick={() => openDesligamento(f.id)}
                                        >
                                            <UserMinus className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            title="Ver perfil"
                                            className="text-muted-foreground hover:text-violet-600"
                                            onClick={() => setProfileFuncId(f.id)}
                                        >
                                            <ArrowRight className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Modais ── */}
            <FuncionarioDetailDialog
                funcionarioId={profileFuncId}
                onClose={() => setProfileFuncId(null)}
            />
            <DesligamentoFormModal
                open={desligamentoOpen}
                editId={null}
                initialFuncionarioId={targetFuncId}
                onClose={() => setDesligamentoOpen(false)}
                onSaved={() => setDesligamentoOpen(false)}
            />
            <PromocaoFormModal
                open={movimentacaoOpen}
                editId={null}
                initialFuncionarioId={targetFuncId}
                onClose={() => setMovimentacaoOpen(false)}
                onSaved={() => setMovimentacaoOpen(false)}
            />
        </div>
    );
}
