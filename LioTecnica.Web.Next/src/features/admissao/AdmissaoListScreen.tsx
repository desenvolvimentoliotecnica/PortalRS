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
    Pencil,
    AlertTriangle,
    ArrowRightLeft,
    Bell,
    ClipboardList,
    Link,
    MoreHorizontal,
    Trash2,
    RefreshCw,
} from "lucide-react";
import { admissaoTrackingPath } from "@/features/admissao/admissaoRoutes";
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
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { TableSkeleton } from "@/components/ui/ScreenSkeleton";
import { useRouter, useSearchParams } from "next/navigation";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ── types ── */

interface TotvsValidationIssue {
    campo: string;
    label: string;
    secao: string;
    tipoRegra: "Obrigatório" | "Condicional" | "Conjunto";
    mensagem: string;
}

interface PreAdmissaoRow {
    id: string;
    nome: string;
    cpf: string | null;
    email: string | null;
    cargoNome: string | null;
    areaNome: string | null;
    unitNome: string | null;
    status: number | string;
    dataAdmissao: string | null;
    salario: number | null;
    preenchidoPor: number;
    createdAtUtc: string;
    totalDocumentos: number;
    documentosPendentes: number;
    documentosValidados: number;
    documentosRejeitados: number;
    integracaoResultado: number | string | null;
    integracaoMensagem: string | null;
    lastActivityUtc?: string | null;
}

const STATUS_MAP: Record<number | string, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileSpreadsheet },
    1: { label: "Enviado", color: "bg-sky-500/15 text-sky-700", icon: Clock },
    2: { label: "Preenchido", color: "bg-amber-500/15 text-amber-700", icon: CheckCircle2 },
    3: { label: "Concluída", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    4: { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    5: { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
    6: { label: "Acessado", color: "bg-violet-500/15 text-violet-700", icon: Eye },
    7: { label: "Preenchido Parcial", color: "bg-orange-500/15 text-orange-700", icon: Clock },
    // String fallbacks (API retorna enums como strings)
    Rascunho: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileSpreadsheet },
    Enviado: { label: "Enviado", color: "bg-sky-500/15 text-sky-700", icon: Clock },
    Preenchido: { label: "Preenchido", color: "bg-amber-500/15 text-amber-700", icon: CheckCircle2 },
    Aprovada: { label: "Concluída", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    Rejeitada: { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    Integrada: { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
    Acessado: { label: "Acessado", color: "bg-violet-500/15 text-violet-700", icon: Eye },
    PreenchidoParcial: { label: "Preenchido Parcial", color: "bg-orange-500/15 text-orange-700", icon: Clock },
};

const PENDENTE_TOTVS = { label: "Pendente TOTVS", color: "bg-amber-500/15 text-amber-700", icon: ArrowRightLeft };
const FALHA_TOTVS = { label: "Falha TOTVS", color: "bg-red-500/15 text-red-700", icon: XCircle };
/** Candidato submeteu dados pelo portal — RH precisa completar e enviar ao TOTVS */
const AGUARDANDO_RH = { label: "Aguardando conclusão RH", color: "bg-orange-500/15 text-orange-700 font-medium", icon: Bell };

function isStatusAprovada(status: number | string): boolean {
    return status === 3 || status === "Aprovada";
}

function isStatusPreenchido(status: number | string): boolean {
    return status === 2 || status === "Preenchido";
}

function isFalhaIntegracao(v: number | string | null | undefined): boolean {
    if (v === null || v === undefined) return false;
    return v === 2 || v === 3 || v === "Falha" || v === "FalhaDefinitiva";
}

function statusCode(status: number | string): number {
    if (typeof status === "number") return status;
    const map: Record<string, number> = {
        Rascunho: 0, Enviado: 1, Preenchido: 2, Aprovada: 3, Rejeitada: 4,
        Integrada: 5, Acessado: 6, PreenchidoParcial: 7, EmIntegracao: 8,
    };
    return map[status] ?? -1;
}

function matchesStatusFilter(row: PreAdmissaoRow, filter: string): boolean {
    if (filter === "all") return true;
    if (filter === "aguardando-rh") return isStatusPreenchido(row.status) && row.preenchidoPor === 0;
    return statusCode(row.status) === Number(filter);
}

function isRascunhoOuEnviado(status: number | string): boolean {
    const c = statusCode(status);
    return c === 0 || c === 1;
}

function formatCreatedAt(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function resolveStatusDisplay(row: PreAdmissaoRow): { label: string; color: string; icon: React.ElementType } {
    if (isStatusAprovada(row.status)) {
        if (isFalhaIntegracao(row.integracaoResultado)) return FALHA_TOTVS;
        if (row.integracaoResultado === null || row.integracaoResultado === undefined) return PENDENTE_TOTVS;
    }
    // Candidato submeteu pelo portal (PreenchidoPor.Candidato = 0) — precisa de ação do RH
    if (isStatusPreenchido(row.status) && row.preenchidoPor === 0) return AGUARDANDO_RH;
    return STATUS_MAP[row.status] ?? STATUS_MAP[0];
}

/* ── component ── */

export default function AdmissaoListScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data = [], isLoading, refetch: loadList } = useApiQuery<PreAdmissaoRow[]>(
        ["pre-admissao", "list", 500],
        "/api/pre-admissao?pageSize=500"
    );
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ativos");
    const [readmissaoCpf, setReadmissaoCpf] = useState("");
    const [readmissaoOpen, setReadmissaoOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showSubmittedBanner, setShowSubmittedBanner] = useState(() => searchParams.get("submitted") === "1");
    const [deleteTarget, setDeleteTarget] = useState<PreAdmissaoRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Concluir + modal de validação TOTVS ──
    const [concluindoId, setConcluindoId] = useState<string | null>(null);
    const [validacaoErros, setValidacaoErros] = useState<TotvsValidationIssue[] | null>(null);
    const [validacaoAdmissaoId, setValidacaoAdmissaoId] = useState<string | null>(null);

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

    async function handleConcluir(id: string) {
        if (concluindoId) return;
        setConcluindoId(id);
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });

            if (res.ok) {
                toast.success("Admissão concluída com sucesso!");
                void loadList();
                return;
            }

            if (res.status === 422) {
                const body = await res.json() as { type?: string; message?: string; errors?: TotvsValidationIssue[] };
                if (body.type === "totvs_validation" && body.errors?.length) {
                    setValidacaoAdmissaoId(id);
                    setValidacaoErros(body.errors);
                    return;
                }
            }

            const b = await res.json().catch(() => ({} as Record<string, string>));
            toast.error((b as { message?: string }).message || "Erro ao concluir admissão.");
        } catch {
            toast.error("Erro de conexão ao tentar concluir.");
        } finally {
            setConcluindoId(null);
        }
    }

    async function handleDeleteConfirm() {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/api/pre-admissao/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
            if (!res.ok) {
                const body = await res.json().catch(() => null) as { message?: string } | null;
                throw new Error(body?.message ?? `HTTP ${res.status}`);
            }
            toast.success(`Pré-admissão de ${deleteTarget.nome} excluída.`);
            setDeleteTarget(null);
            void loadList();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
        } finally {
            setDeleting(false);
        }
    }

    const filtered = data.filter((r) => {
        if (statusFilter === "ativos" && statusCode(r.status) === 4) return false;
        if (!matchesStatusFilter(r, statusFilter === "ativos" ? "all" : statusFilter)) return false;
        if (q.trim()) {
            const blob = [r.nome, r.cpf, r.email, r.cargoNome, r.areaNome].filter(Boolean).join(" ").toLowerCase();
            if (!blob.includes(q.trim().toLowerCase())) return false;
        }
        return true;
    }).sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    const kpis = {
        total: data.length,
        rascunhos: data.filter(r => r.status === 0 || r.status === 1 || r.status === "Rascunho" || r.status === "Enviado").length,
        aguardandoRH: data.filter(r => isStatusPreenchido(r.status) && r.preenchidoPor === 0).length,
        emRevisao: data.filter(r => isStatusPreenchido(r.status) && r.preenchidoPor !== 0).length,
        aprovadas: data.filter(r => r.status === 3 || r.status === 5 || r.status === "Aprovada" || r.status === "Integrada").length,
        rejeitadas: data.filter(r => r.status === 4 || r.status === "Rejeitada").length,
    };

    return (
        <section className="space-y-5">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pré-Admissão</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Gerencie pré-admissões — use a busca por nome/e-mail ou exclua registros de teste obsoletos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadList()}>
                        <RefreshCw className="size-4" /> Atualizar
                    </Button>
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
                    title="Admissão finalizada"
                    description="O registro foi atualizado. Busque pelo nome do candidato na lista — a coluna de datas mostra também a última atualização (↻)."
                    onDismiss={() => setShowSubmittedBanner(false)}
                />
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard icon={Users} label="Total" value={kpis.total} color="bg-slate-500/15 text-slate-600" />
                <KpiCard icon={FileSpreadsheet} label="Rascunhos" value={kpis.rascunhos} color="bg-zinc-400/15 text-zinc-600" />
                <KpiCard icon={Bell} label="Aguardando RH" value={kpis.aguardandoRH} color="bg-orange-500/15 text-orange-600" highlight={kpis.aguardandoRH > 0} />
                <KpiCard icon={Eye} label="Em Revisão" value={kpis.emRevisao} color="bg-amber-500/15 text-amber-600" />
                <KpiCard icon={CheckCircle2} label="Aprovadas" value={kpis.aprovadas} color="bg-emerald-500/15 text-emerald-600" />
                <KpiCard icon={XCircle} label="Rejeitadas" value={kpis.rejeitadas} color="bg-red-500/15 text-red-600" />
            </div>

            {/* filters + table */}
            <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div className="flex flex-wrap gap-1">
                        {[
                            { key: "ativos", label: "Ativos" },
                            { key: "all", label: "Todos" },
                            { key: "0", label: "Rascunho" },
                            { key: "1", label: "Link enviado" },
                            { key: "aguardando-rh", label: "Aguardando RH" },
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
                        <Input className="w-[280px] pl-9" placeholder="Buscar nome, CPF, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Docs</TableHead>
                            <TableHead className="text-right">Criado em</TableHead>
                            <TableHead className="text-center w-[72px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow><TableCell colSpan={8} className="py-4"><TableSkeleton rows={5} /></TableCell></TableRow>
                        )}
                        {!isLoading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Users className="size-10 opacity-20" />
                                        <p className="text-sm font-medium">Nenhuma admissão em andamento</p>
                                        <p className="text-xs opacity-70">Aprove candidatos no Pipeline para iniciar o processo de admissão.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map((r) => {
                            const s = resolveStatusDisplay(r);
                            const Icon = s.icon;
                            const isDraft = isRascunhoOuEnviado(r.status);
                            const canDelete = statusCode(r.status) !== 5;
                            return (
                                <TableRow
                                    key={r.id}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => {
                                        if (isDraft) router.push(admissaoTrackingPath(r.id));
                                        else router.push(`/admissao/revisao?id=${r.id}`);
                                    }}
                                    title={s.label === "Falha TOTVS" && r.integracaoMensagem ? r.integracaoMensagem : undefined}
                                >
                                    <TableCell className="font-semibold text-sm">{r.nome}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{r.email || "—"}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.cpf || "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{r.cargoNome || "—"}</TableCell>
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
                                                r.documentosValidados >= r.totalDocumentos ? "text-green-600" :
                                                "text-muted-foreground"
                                            }`}>
                                                {r.documentosValidados}/{r.totalDocumentos}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                        <div>{formatCreatedAt(r.createdAtUtc)}</div>
                                        {r.lastActivityUtc && r.lastActivityUtc !== r.createdAtUtc && (
                                            <div className="text-[10px] opacity-70">↻ {formatCreatedAt(r.lastActivityUtc)}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {isDraft && (
                                                    <DropdownMenuItem onClick={() => router.push(admissaoTrackingPath(r.id))}>
                                                        <Link className="size-4 mr-2" /> Enviar link ao candidato
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => router.push(`/admissao/revisao?id=${r.id}`)}>
                                                    <ClipboardList className="size-4 mr-2" /> Revisar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/admissao/nova?id=${r.id}`)}>
                                                    <Pencil className="size-4 mr-2" /> Wizard RH
                                                </DropdownMenuItem>
                                                {canDelete && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleteTarget(r)}
                                                        >
                                                            <Trash2 className="size-4 mr-2" /> Excluir
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="mt-3 text-xs text-muted-foreground">
                    {filtered.length} de {data.length} registro(s)
                    {statusFilter === "ativos" ? " · rejeitadas ocultas" : ""}
                </div>
            </div>

            {/* Excluir confirmação */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Excluir pré-admissão?</DialogTitle>
                        <DialogDescription>
                            Remove permanentemente <b>{deleteTarget?.nome}</b> e documentos anexados. Use para limpar registros de teste.
                            Admissões já integradas ao TOTVS não podem ser excluídas.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void handleDeleteConfirm()} disabled={deleting}>
                            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal de Validação TOTVS ── */}
            <Dialog
                open={validacaoErros !== null}
                onOpenChange={(open) => { if (!open) { setValidacaoErros(null); setValidacaoAdmissaoId(null); } }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="size-5 shrink-0" />
                            Campos obrigatórios não preenchidos
                        </DialogTitle>
                        <DialogDescription>
                            A admissão não pode ser concluída. Preencha os campos abaixo antes de tentar novamente.
                        </DialogDescription>
                    </DialogHeader>

                    {validacaoErros && (
                        <div className="max-h-[420px] overflow-y-auto pr-2">
                            <ValidacaoErrosList erros={validacaoErros} />
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => { setValidacaoErros(null); setValidacaoAdmissaoId(null); }}
                        >
                            Fechar
                        </Button>
                        {validacaoAdmissaoId && (
                            <Button
                                onClick={() => {
                                    router.push(`/admissao/nova?id=${validacaoAdmissaoId}`);
                                    setValidacaoErros(null);
                                    setValidacaoAdmissaoId(null);
                                }}
                            >
                                <Pencil className="size-4 mr-1.5" />
                                Ir para o formulário
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

// ── Cores e labels para tipo de regra ─────────────────────────────────────────
const TIPO_REGRA_STYLE: Record<string, string> = {
    "Obrigatório":  "bg-red-100 text-red-700 border-red-200",
    "Condicional":  "bg-amber-100 text-amber-700 border-amber-200",
    "Conjunto":     "bg-blue-100 text-blue-700 border-blue-200",
};

function ValidacaoErrosList({ erros }: { erros: TotvsValidationIssue[] }) {
    // Agrupa por seção
    const porSecao = erros.reduce<Record<string, TotvsValidationIssue[]>>((acc, item) => {
        (acc[item.secao] ??= []).push(item);
        return acc;
    }, {});

    return (
        <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{erros.length} campo(s)</span> com problema encontrado(s):
            </p>
            {Object.entries(porSecao).map(([secao, items]) => (
                <div key={secao}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1 border-b">
                        {secao}
                    </p>
                    <ul className="space-y-1.5">
                        {items.map((item) => (
                            <li key={item.campo} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIPO_REGRA_STYLE[item.tipoRegra] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                                    {item.tipoRegra}
                                </span>
                                <span className="text-foreground font-medium">{item.label}</span>
                                <span className="text-muted-foreground text-xs mt-0.5 hidden sm:inline">— {item.mensagem}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, color, highlight }: { icon: React.ElementType; label: string; value: number; color: string; highlight?: boolean }) {
    return (
        <div className={`rounded-xl border bg-card shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow ${highlight ? "border-orange-400 ring-1 ring-orange-400/40" : "border-border/40"}`}>
            <div className={`rounded-lg p-2.5 shrink-0 ${color}`}><Icon className="size-4" /></div>
            <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none mb-1">{label}</div>
                <div className={`text-2xl font-bold leading-none tabular-nums ${highlight ? "text-orange-600" : ""}`}>{value}</div>
            </div>
        </div>
    );
}
