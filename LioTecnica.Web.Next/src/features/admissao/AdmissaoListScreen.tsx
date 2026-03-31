"use client";

import React, { useState } from "react";
import {
    Plus,
    Search,
    FileSpreadsheet,
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    ShieldCheck,
    Eye,
    Users,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { TableSkeleton } from "@/components/ui/ScreenSkeleton";
import { useRouter, useSearchParams } from "next/navigation";
import NextStepBanner from "@/components/feedback/NextStepBanner";

/* ── types ── */

interface PreAdmissaoRow {
    id: string;
    nome: string;
    cpf: string | null;
    email: string | null;
    cargoNome: string | null;
    areaNome: string | null;
    unitNome: string | null;
    status: number;
    dataAdmissao: string | null;
    salario: number | null;
    preenchidoPor: number;
    createdAtUtc: string;
    totalDocumentos: number;
    documentosPendentes: number;
    documentosValidados: number;
    documentosRejeitados: number;
}

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileSpreadsheet },
    1: { label: "Preenchimento", color: "bg-sky-500/15 text-sky-700", icon: Clock },
    2: { label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: Eye },
    3: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    4: { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    5: { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
};

/* ── component ── */

export default function AdmissaoListScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data = [], isLoading } = useApiQuery<PreAdmissaoRow[]>(
        ["pre-admissao"],
        "/api/pre-admissao"
    );
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [readmissaoCpf, setReadmissaoCpf] = useState("");
    const [readmissaoOpen, setReadmissaoOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showSubmittedBanner, setShowSubmittedBanner] = useState(() => searchParams.get("submitted") === "1");

    async function handleCreate() {
        if (creating) return;
        try {
            setCreating(true);
            const res = await apiFetch("/api/pre-admissao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: "Novo Colaborador" }),
            });
            if (res.ok) {
                const created = await res.json();
                router.push(`/admissao/nova?id=${created.id}`);
            } else {
                toast.error("Erro ao criar pré-admissão");
                setCreating(false);
            }
        } catch {
            toast.error("Erro ao criar pré-admissão");
            setCreating(false);
        }
    }

    async function handleReadmissao() {
        if (!readmissaoCpf.trim()) return;
        try {
            const res = await apiFetch(`/api/pre-admissao/buscar-cpf/${readmissaoCpf.replace(/\D/g, "")}`);
            if (res.ok) {
                const data = await res.json();
                if (data.encontrado) {
                    toast.success("Cadastro encontrado! Pré-preenchendo dados…");
                    // Create pre-admissao with pre-filled data
                    const createRes = await apiFetch("/api/pre-admissao", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nome: data.nome, cpf: data.cpf }),
                    });
                    if (createRes.ok) {
                        const created = await createRes.json();
                        router.push(`/admissao/nova?id=${created.id}&readmissao=true`);
                    }
                } else {
                    toast.info("CPF não encontrado. Criando admissão nova…");
                    handleCreate();
                }
            }
        } catch { toast.error("Erro na busca por CPF"); }
        finally { setReadmissaoOpen(false); }
    }

    const filtered = data.filter((r) => {
        if (statusFilter !== "all" && r.status !== Number(statusFilter)) return false;
        if (q.trim()) {
            const blob = [r.nome, r.cpf, r.email, r.cargoNome, r.areaNome].filter(Boolean).join(" ").toLowerCase();
            if (!blob.includes(q.trim().toLowerCase())) return false;
        }
        return true;
    });

    const kpis = {
        total: data.length,
        rascunhos: data.filter(r => r.status <= 1).length,
        emRevisao: data.filter(r => r.status === 2).length,
        aprovadas: data.filter(r => r.status === 3 || r.status === 5).length,
        rejeitadas: data.filter(r => r.status === 4).length,
    };

    return (
        <section className="space-y-5">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pré-Admissão</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Gerencie as pré-admissões de novos colaboradores</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStatusFilter("1")}>
                        <FileText className="size-4" /> Docs Pendentes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setReadmissaoOpen(true)}>
                        <Search className="size-4" /> Readmissão (CPF)
                    </Button>
                    <Button size="sm" onClick={handleCreate} disabled={creating}>
                        {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Nova Admissão
                    </Button>
                </div>
            </div>

            {/* ── next step banner ── */}
            {showSubmittedBanner && (
                <NextStepBanner
                    variant="success"
                    title="Admissão enviada para revisão!"
                    description="O RH irá revisar os dados e documentos. Acompanhe o status na lista abaixo."
                    onDismiss={() => setShowSubmittedBanner(false)}
                />
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard icon={Users} label="Total" value={kpis.total} color="bg-slate-500/15 text-slate-600" />
                <KpiCard icon={FileSpreadsheet} label="Rascunhos" value={kpis.rascunhos} color="bg-zinc-400/15 text-zinc-600" />
                <KpiCard icon={Eye} label="Em Revisão" value={kpis.emRevisao} color="bg-amber-500/15 text-amber-600" />
                <KpiCard icon={CheckCircle2} label="Aprovadas" value={kpis.aprovadas} color="bg-emerald-500/15 text-emerald-600" />
                <KpiCard icon={XCircle} label="Rejeitadas" value={kpis.rejeitadas} color="bg-red-500/15 text-red-600" />
            </div>

            {/* filters + table */}
            <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div className="flex gap-1">
                        {[
                            { key: "all", label: "Todos" },
                            { key: "0", label: "Rascunho" },
                            { key: "2", label: "Em Revisão" },
                            { key: "3", label: "Aprovada" },
                            { key: "4", label: "Rejeitada" },
                            { key: "5", label: "Integrada" },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFilter(f.key)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${statusFilter === f.key ? "bg-[rgb(var(--lt-primary))] text-white border-[rgb(var(--lt-primary))]" : "bg-card text-slate-700 border-border/60 hover:bg-slate-50"
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="w-[260px] pl-9" placeholder="Buscar nome, CPF…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-center">Admissão</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Docs</TableHead>
                            <TableHead className="text-right">Criado em</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow><TableCell colSpan={9} className="py-4"><TableSkeleton rows={5} /></TableCell></TableRow>
                        )}
                        {!isLoading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Users className="size-10 opacity-20" />
                                        <p className="text-sm font-medium">Nenhuma admissão em andamento</p>
                                        <p className="text-xs opacity-70">Aprove candidatos no Pipeline para iniciar o processo de admissão.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map((r) => {
                            const s = STATUS_MAP[r.status] ?? STATUS_MAP[0];
                            const Icon = s.icon;
                            return (
                                <TableRow
                                    key={r.id}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => r.status <= 1 ? router.push(`/admissao/nova?id=${r.id}`) : router.push(`/admissao/revisao?id=${r.id}`)}
                                >
                                    <TableCell className="font-semibold text-sm">{r.nome}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.cpf || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{r.cargoNome || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{r.areaNome || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{r.unitNome || "—"}</TableCell>
                                    <TableCell className="text-center text-xs">{r.dataAdmissao || "—"}</TableCell>
                                    <TableCell className="text-center">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
                                            <Icon className="size-3" /> {s.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {r.totalDocumentos > 0 ? (
                                            <span className={`text-xs font-mono font-semibold ${
                                                r.documentosRejeitados > 0 ? "text-red-600" :
                                                r.documentosPendentes > 0 ? "text-amber-600" :
                                                r.documentosValidados === r.totalDocumentos ? "text-green-600" :
                                                "text-muted-foreground"
                                            }`}>
                                                {r.documentosValidados}/{r.totalDocumentos}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {new Date(r.createdAtUtc).toLocaleDateString("pt-BR")}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="mt-3 text-xs text-muted-foreground">{filtered.length} registros</div>
            </div>

            {/* Readmissão Dialog */}
            <Dialog open={readmissaoOpen} onOpenChange={setReadmissaoOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Readmissão por CPF</DialogTitle>
                        <DialogDescription>Busca cadastro existente para pré-preencher dados.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="000.000.000-00" value={readmissaoCpf} onChange={(e) => setReadmissaoCpf(e.target.value)} />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setReadmissaoOpen(false)}>Cancelar</Button>
                            <Button className="bg-[rgb(var(--lt-primary))] hover:bg-[rgb(var(--lt-brand))]" onClick={handleReadmissao}>
                                <Search className="size-4" /> Buscar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={`rounded-lg p-2.5 shrink-0 ${color}`}><Icon className="size-4" /></div>
            <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none mb-1">{label}</div>
                <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
            </div>
        </div>
    );
}
