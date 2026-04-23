"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, RefreshCw, CheckCircle2, Clock, Lock, ClipboardList,
    ChevronRight, Trash2, BarChart2, LayoutGrid, Mail, Play, Scale, Download, FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

/* ────── types ────── */

interface PerguntaResponse {
    id: string;
    texto: string;
    ordem: number;
}

interface CicloResponse {
    id: string;
    nome: string;
    periodo: string;
    status: number; // 0=Aberto, 1=Fechado, 2=Rascunho, 3=EmCalibragem
    criadoPorNome: string;
    totalPerguntas: number;
    totalRespostas: number;
    criadoEmUtc: string;
    perguntas: PerguntaResponse[];
}

interface CalibragemRow {
    id: string;
    cicloId: string;
    funcionarioId: string;
    funcionarioNome: string;
    cargo: string | null;
    scoreGestor: number;
    desempenhoGestor: number | null;
    potencialGestor: number | null;
    scoreComite: number | null;
    desempenhoComite: number | null;
    potencialComite: number | null;
    justificativaComite: string | null;
    status: number; // 0=Pendente, 1=Calibrado, 2=Decidido
    decisao: number; // 0=Indefinida, 1=Gestor, 2=Comite
    decididoPorUserId: string | null;
    decididoEmUtc: string | null;
    observacaoDecisao: string | null;
    nineBoxAssessmentId: string | null;
    atualizadoEmUtc: string;
}

const CICLO_STATUS: Record<number, { label: string; tone: "default" | "secondary"; icon: typeof Clock }> = {
    0: { label: "Aberto", tone: "default", icon: Clock },
    1: { label: "Fechado", tone: "secondary", icon: Lock },
    2: { label: "Rascunho", tone: "secondary", icon: FileEdit },
    3: { label: "Em Calibragem", tone: "default", icon: Scale },
};

const CALIBRAGEM_STATUS: Record<number, string> = { 0: "Pendente", 1: "Calibrado", 2: "Decidido" };
const CALIBRAGEM_DECISAO: Record<number, string> = { 0: "—", 1: "Gestor", 2: "Comitê" };

interface ResultadoRow {
    avaliandoId: string;
    avaliandoNome: string;
    cargo: string | null;
    score: number;
    totalRespostas: number;
    ultimaRespostaEmUtc: string;
}

/* ────── helpers ────── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
}

function ScoreBar({ score }: { score: number }) {
    const pct = Math.min(100, (score / 5) * 100);
    const color = score >= 4 ? "bg-green-500" : score >= 3 ? "bg-blue-500" : score >= 2 ? "bg-amber-500" : "bg-red-400";
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold w-8 text-right">{score.toFixed(1)}</span>
        </div>
    );
}

/* ────── main component ────── */

export default function CiclosAvaliacaoScreen() {
    const router = useRouter();
    const { me } = useAuth();
    const isAdmin = me?.isAdmin ?? false;

    const [ciclos, setCiclos] = useState<CicloResponse[]>([]);
    const [loading, setLoading] = useState(true);

    /* criar ciclo */
    const [criarOpen, setCriarOpen] = useState(false);
    const [criarNome, setCriarNome] = useState("");
    const [criarPeriodo, setCriarPeriodo] = useState("");
    const [criarPerguntas, setCriarPerguntas] = useState<string[]>(["", "", ""]);
    const [criarRascunho, setCriarRascunho] = useState(false);
    const [criarLoading, setCriarLoading] = useState(false);

    /* resultados */
    const [resultadosOpen, setResultadosOpen] = useState(false);
    const [resultadosCiclo, setResultadosCiclo] = useState<CicloResponse | null>(null);
    const [resultados, setResultados] = useState<ResultadoRow[]>([]);
    const [resultadosLoading, setResultadosLoading] = useState(false);

    /* calibragem */
    const [calibragemOpen, setCalibragemOpen] = useState(false);
    const [calibragemCiclo, setCalibragemCiclo] = useState<CicloResponse | null>(null);
    const [calibragemRows, setCalibragemRows] = useState<CalibragemRow[]>([]);
    const [calibragemLoading, setCalibragemLoading] = useState(false);
    const [ajusteRow, setAjusteRow] = useState<CalibragemRow | null>(null);
    const [ajusteDesempenho, setAjusteDesempenho] = useState<number>(2);
    const [ajustePotencial, setAjustePotencial] = useState<number>(2);
    const [ajusteScore, setAjusteScore] = useState<string>("");
    const [ajusteJustificativa, setAjusteJustificativa] = useState<string>("");
    const [ajusteSaving, setAjusteSaving] = useState(false);
    const [decisaoRow, setDecisaoRow] = useState<CalibragemRow | null>(null);
    const [decisaoVersao, setDecisaoVersao] = useState<1 | 2>(1);
    const [decisaoObs, setDecisaoObs] = useState<string>("");
    const [decisaoGerarNineBox, setDecisaoGerarNineBox] = useState<boolean>(true);
    const [decisaoSaving, setDecisaoSaving] = useState(false);

    /* nine-box suggestion */
    const [nineBoxModal, setNineBoxModal] = useState<{ avaliandoId: string; avaliandoNome: string; cargo: string | null; desempenho: number } | null>(null);
    const [nineBoxPotencial, setNineBoxPotencial] = useState(2);
    const [savingNineBox, setSavingNineBox] = useState(false);

    function scoreToDesempenho(score: number): number {
        if (score >= 4) return 3;
        if (score >= 2.5) return 2;
        return 1;
    }

    const NINE_BOX_NAMES: Record<string, string> = {
        "1-1": "Questionável", "1-2": "Em Desenvolvimento", "1-3": "Enigma",
        "2-1": "Efetivo", "2-2": "Núcleo", "2-3": "Alto Potencial",
        "3-1": "Especialista", "3-2": "Alto Desempenho", "3-3": "Estrela",
    };

    async function salvarNineBox() {
        if (!nineBoxModal) return;
        setSavingNineBox(true);
        try {
            const res = await apiFetch("/api/nine-box", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: nineBoxModal.avaliandoId,
                    desempenho: nineBoxModal.desempenho,
                    potencial: nineBoxPotencial,
                    observacoes: `Posicionamento sugerido a partir da avaliação de desempenho. Score: ${resultados.find(r => r.avaliandoId === nineBoxModal.avaliandoId)?.score?.toFixed(1)}`,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const qKey = `${nineBoxModal.desempenho}-${nineBoxPotencial}`;
            toast.success(`${nineBoxModal.avaliandoNome} posicionado como "${NINE_BOX_NAMES[qKey] ?? qKey}" no Nine-Box!`);
            setNineBoxModal(null);
        } catch {
            toast.error("Erro ao salvar no Nine-Box.");
        } finally {
            setSavingNineBox(false);
        }
    }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<CicloResponse[]>("/api/avaliacao/ciclos");
            setCiclos(data ?? []);
        } catch {
            toast.error("Falha ao carregar ciclos.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function criarCiclo() {
        const perguntas = criarPerguntas.filter(p => p.trim());
        if (!criarNome.trim()) { toast.error("Informe o nome do ciclo."); return; }
        if (!criarPeriodo.trim()) { toast.error("Informe o período."); return; }
        if (perguntas.length === 0) { toast.error("Adicione ao menos uma pergunta."); return; }
        setCriarLoading(true);
        try {
            await fetchJson("/api/avaliacao/ciclos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: criarNome.trim(), periodo: criarPeriodo.trim(), perguntas, iniciarEmRascunho: criarRascunho }),
            });
            toast.success(criarRascunho ? "Ciclo criado em rascunho — ative quando pronto." : "Ciclo criado!");
            setCriarOpen(false);
            setCriarNome(""); setCriarPeriodo(""); setCriarPerguntas(["", "", ""]); setCriarRascunho(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setCriarLoading(false);
        }
    }

    async function fecharCiclo(id: string) {
        if (!confirm("Fechar este ciclo? Após fechar não será possível registrar mais respostas.")) return;
        try {
            await fetchJson(`/api/avaliacao/ciclos/${id}/fechar`, { method: "POST" });
            toast.success("Ciclo fechado.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function openResultados(ciclo: CicloResponse) {
        setResultadosCiclo(ciclo);
        setResultadosOpen(true);
        setResultadosLoading(true);
        try {
            const data = await fetchJson<ResultadoRow[]>(`/api/avaliacao/ciclos/${ciclo.id}/resultados`);
            setResultados(data ?? []);
        } catch {
            toast.error("Falha ao carregar resultados.");
        } finally {
            setResultadosLoading(false);
        }
    }

    async function ativarCiclo(id: string) {
        try {
            await fetchJson(`/api/avaliacao/ciclos/${id}/ativar`, { method: "POST" });
            toast.success("Ciclo ativado — convites serão gerados em segundo plano.");
            await load();
        } catch (e) {
            toast.error(`Falha ao ativar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function gerarConvites(id: string) {
        if (!confirm("Gerar convocações para todos os avaliadores e enviar e-mails? (idempotente)")) return;
        try {
            const r = await fetchJson<{ convitesCriados: number; emailsEnfileirados: number; convitesExistentesIgnorados: number }>(
                `/api/avaliacao/ciclos/${id}/convites/gerar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            toast.success(`${r.convitesCriados} convites criados · ${r.emailsEnfileirados} e-mails enfileirados.`);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function openCalibragem(ciclo: CicloResponse) {
        setCalibragemCiclo(ciclo);
        setCalibragemOpen(true);
        setCalibragemLoading(true);
        try {
            // garante que linhas foram criadas (idempotente)
            await apiFetch(`/api/avaliacao/ciclos/${ciclo.id}/calibragem/iniciar`, { method: "POST" }).catch(() => { });
            const data = await fetchJson<CalibragemRow[]>(`/api/avaliacao/ciclos/${ciclo.id}/calibragem`);
            setCalibragemRows(data ?? []);
        } catch (e) {
            toast.error(`Falha ao carregar calibragem: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setCalibragemLoading(false);
        }
    }

    async function reloadCalibragem(cicloId: string) {
        setCalibragemLoading(true);
        try {
            const data = await fetchJson<CalibragemRow[]>(`/api/avaliacao/ciclos/${cicloId}/calibragem`);
            setCalibragemRows(data ?? []);
        } catch {
            // silencioso
        } finally {
            setCalibragemLoading(false);
        }
    }

    async function salvarAjuste() {
        if (!ajusteRow || !calibragemCiclo) return;
        setAjusteSaving(true);
        try {
            const scoreNum = ajusteScore.trim() ? Number(ajusteScore.replace(",", ".")) : null;
            await fetchJson(`/api/avaliacao/ciclos/${calibragemCiclo.id}/calibragem/ajustar`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: ajusteRow.funcionarioId,
                    scoreComite: scoreNum,
                    desempenhoComite: ajusteDesempenho,
                    potencialComite: ajustePotencial,
                    justificativa: ajusteJustificativa || null,
                }),
            });
            toast.success("Calibragem do comitê registrada.");
            setAjusteRow(null);
            await reloadCalibragem(calibragemCiclo.id);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setAjusteSaving(false);
        }
    }

    async function salvarDecisao() {
        if (!decisaoRow || !calibragemCiclo) return;
        setDecisaoSaving(true);
        try {
            await fetchJson(`/api/avaliacao/ciclos/${calibragemCiclo.id}/calibragem/decidir`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: decisaoRow.funcionarioId,
                    versao: decisaoVersao,
                    observacao: decisaoObs || null,
                    gerarNineBox: decisaoGerarNineBox,
                }),
            });
            toast.success(decisaoGerarNineBox ? "Decisão registrada + Nine-Box gerado." : "Decisão registrada.");
            setDecisaoRow(null);
            await reloadCalibragem(calibragemCiclo.id);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setDecisaoSaving(false);
        }
    }

    async function exportarCsv(cicloId: string, nome: string) {
        try {
            const res = await apiFetch(`/api/avaliacao/ciclos/${cicloId}/resultados/export`, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${nome.replace(/\s+/g, "_")}_resultados.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(`Falha no download: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    const updatePergunta = (idx: number, val: string) => {
        const updated = [...criarPerguntas];
        updated[idx] = val;
        setCriarPerguntas(updated);
    };

    return (
        <section className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Desempenho
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Ciclos de Avaliação</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Avaliações formais de desempenho com perguntas configuradas e escala 1-5.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4 mr-1" /> Atualizar</Button>
                    {isAdmin && (
                        <Button size="sm" onClick={() => setCriarOpen(true)}>
                            <Plus className="size-4 mr-1" /> Novo Ciclo
                        </Button>
                    )}
                </div>
            </div>

            {/* Lista de ciclos */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
            ) : ciclos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClipboardList className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum ciclo criado ainda.</p>
                    {isAdmin && (
                        <Button className="mt-4" size="sm" onClick={() => setCriarOpen(true)}>
                            <Plus className="size-4 mr-1" /> Criar primeiro ciclo
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {ciclos.map((ciclo) => {
                        const cfg = CICLO_STATUS[ciclo.status] ?? CICLO_STATUS[0];
                        const StatusIcon = cfg.icon;
                        const fechado = ciclo.status === 1;
                        const rascunho = ciclo.status === 2;
                        const emCalibragem = ciclo.status === 3;
                        const aberto = ciclo.status === 0;
                        return (
                            <div key={ciclo.id} className="rounded-xl border border-border/40 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <StatusIcon className={`size-4 shrink-0 ${fechado ? "text-muted-foreground" : emCalibragem ? "text-violet-500" : rascunho ? "text-amber-500" : "text-blue-500"}`} />
                                        <span className="font-semibold text-sm">{ciclo.nome}</span>
                                        <Badge variant={cfg.tone} className="text-xs">{cfg.label}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        Período: {ciclo.periodo} · {ciclo.totalPerguntas} pergunta{ciclo.totalPerguntas !== 1 ? "s" : ""} · {ciclo.totalRespostas} resposta{ciclo.totalRespostas !== 1 ? "s" : ""} · Criado por {ciclo.criadoPorNome}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    {rascunho && isAdmin && (
                                        <Button size="sm" onClick={() => void ativarCiclo(ciclo.id)}>
                                            <Play className="size-4 mr-1" /> Ativar
                                        </Button>
                                    )}
                                    {aberto && isAdmin && (
                                        <Button variant="outline" size="sm" onClick={() => void gerarConvites(ciclo.id)}>
                                            <Mail className="size-4 mr-1" /> Gerar Convites
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => void openResultados(ciclo)}>
                                        <BarChart2 className="size-4 mr-1" /> Resultados
                                    </Button>
                                    {(emCalibragem || fechado) && isAdmin && (
                                        <Button variant="outline" size="sm" onClick={() => void openCalibragem(ciclo)}>
                                            <Scale className="size-4 mr-1" /> Calibragem
                                        </Button>
                                    )}
                                    {isAdmin && (
                                        <Button variant="outline" size="sm" onClick={() => void exportarCsv(ciclo.id, ciclo.nome)}>
                                            <Download className="size-4 mr-1" /> CSV
                                        </Button>
                                    )}
                                    {(aberto || emCalibragem) && (
                                        <Button size="sm" onClick={() => router.push(`/feedback/avaliacao/${ciclo.id}`)}>
                                            Responder <ChevronRight className="size-4 ml-1" />
                                        </Button>
                                    )}
                                    {(aberto || emCalibragem) && isAdmin && (
                                        <Button variant="outline" size="sm" onClick={() => void fecharCiclo(ciclo.id)}>
                                            <Lock className="size-4 mr-1" /> Fechar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Criar Ciclo Dialog */}
            <Dialog open={criarOpen} onOpenChange={setCriarOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Novo Ciclo de Avaliação</DialogTitle>
                        <DialogDescription>Configure o nome, período e as perguntas da avaliação (escala 1-5).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome *</label>
                            <Input placeholder="Ex: Avaliação Q1 2026" value={criarNome} onChange={(e) => setCriarNome(e.target.value)} className="mt-1" maxLength={200} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período *</label>
                            <Input placeholder="Ex: Q1 2026, Semestral 2026..." value={criarPeriodo} onChange={(e) => setCriarPeriodo(e.target.value)} className="mt-1" maxLength={50} />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perguntas (escala 1-5) *</label>
                                <Button variant="ghost" size="sm" onClick={() => setCriarPerguntas([...criarPerguntas, ""])}>
                                    <Plus className="size-3.5 mr-1" /> Adicionar
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {criarPerguntas.map((p, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <span className="text-xs text-muted-foreground pt-2.5 w-5 text-right shrink-0">{idx + 1}.</span>
                                        <Input
                                            placeholder={`Pergunta ${idx + 1}...`}
                                            value={p}
                                            onChange={(e) => updatePergunta(idx, e.target.value)}
                                            maxLength={500}
                                        />
                                        {criarPerguntas.length > 1 && (
                                            <Button variant="ghost" size="icon-xs" onClick={() => setCriarPerguntas(criarPerguntas.filter((_, i) => i !== idx))}>
                                                <Trash2 className="size-3.5 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm mt-2">
                        <input type="checkbox" checked={criarRascunho} onChange={(e) => setCriarRascunho(e.target.checked)} />
                        Criar em rascunho (ativar depois; não aceita respostas até ativar)
                    </label>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCriarOpen(false)} disabled={criarLoading}>Cancelar</Button>
                        <Button onClick={() => void criarCiclo()} disabled={criarLoading || !criarNome.trim()}>
                            {criarLoading ? "Criando..." : "Criar Ciclo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resultados Dialog */}
            <Dialog open={resultadosOpen} onOpenChange={setResultadosOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Resultados — {resultadosCiclo?.nome}</DialogTitle>
                        <DialogDescription>Período: {resultadosCiclo?.periodo} · Score médio por avaliando</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        {resultadosLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                        ) : resultados.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma resposta registrada ainda.</p>
                        ) : (
                            <div className="space-y-2">
                                {resultados.map((r, idx) => (
                                    <div key={r.avaliandoId} className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3">
                                        <span className="text-sm text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold">{r.avaliandoNome}</div>
                                            <div className="text-xs text-muted-foreground">{r.cargo ?? "—"} · {r.totalRespostas} avaliador{r.totalRespostas !== 1 ? "es" : ""}</div>
                                        </div>
                                        <div className="w-40 shrink-0">
                                            <ScoreBar score={r.score} />
                                        </div>
                                        {r.score >= 4 && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
                                        <button
                                            title="Sugerir posição Nine-Box"
                                            onClick={() => {
                                                setNineBoxPotencial(2);
                                                setNineBoxModal({ avaliandoId: r.avaliandoId, avaliandoNome: r.avaliandoNome, cargo: r.cargo, desempenho: scoreToDesempenho(r.score) });
                                            }}
                                            className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                        >
                                            <LayoutGrid className="size-3" /> Nine-Box
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResultadosOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Calibragem Dialog */}
            <Dialog open={calibragemOpen} onOpenChange={setCalibragemOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Comitê de Calibragem — {calibragemCiclo?.nome}</DialogTitle>
                        <DialogDescription>
                            Score do gestor preservado. Comitê pode ajustar; gestor (palavra final) decide qual versão prevalece.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 max-h-[65vh] overflow-y-auto">
                        {calibragemLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
                        ) : calibragemRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma linha de calibragem. Gere respostas antes.</p>
                        ) : (
                            <div className="space-y-2">
                                {calibragemRows.map((r) => (
                                    <div key={r.id} className="rounded-lg border border-border/40 px-3 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold">{r.funcionarioNome}</div>
                                                <div className="text-[11px] text-muted-foreground">{r.cargo ?? "—"}</div>
                                            </div>
                                            <div className="text-xs text-right shrink-0">
                                                <div>Status: <strong>{CALIBRAGEM_STATUS[r.status]}</strong></div>
                                                <div>Decisão: <strong>{CALIBRAGEM_DECISAO[r.decisao]}</strong></div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                                            <div className="rounded bg-muted/30 p-2">
                                                <div className="font-semibold mb-0.5">Gestor</div>
                                                <div>Score: {r.scoreGestor.toFixed(2)} · D: {r.desempenhoGestor ?? "—"} · P: {r.potencialGestor ?? "—"}</div>
                                            </div>
                                            <div className="rounded bg-muted/30 p-2">
                                                <div className="font-semibold mb-0.5">Comitê</div>
                                                <div>Score: {r.scoreComite?.toFixed(2) ?? "—"} · D: {r.desempenhoComite ?? "—"} · P: {r.potencialComite ?? "—"}</div>
                                                {r.justificativaComite && <div className="text-muted-foreground mt-1 italic">&ldquo;{r.justificativaComite}&rdquo;</div>}
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-2">
                                            {r.status !== 2 && (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setAjusteRow(r);
                                                    setAjusteDesempenho(r.desempenhoComite ?? r.desempenhoGestor ?? 2);
                                                    setAjustePotencial(r.potencialComite ?? r.potencialGestor ?? 2);
                                                    setAjusteScore(r.scoreComite?.toString() ?? "");
                                                    setAjusteJustificativa(r.justificativaComite ?? "");
                                                }}>
                                                    <Scale className="size-3.5 mr-1" /> Ajustar (Comitê)
                                                </Button>
                                            )}
                                            {r.status !== 2 && (
                                                <Button size="sm" onClick={() => {
                                                    setDecisaoRow(r);
                                                    setDecisaoVersao(r.scoreComite != null ? 2 : 1);
                                                    setDecisaoObs("");
                                                    setDecisaoGerarNineBox(true);
                                                }}>
                                                    Decidir <ChevronRight className="size-3.5 ml-1" />
                                                </Button>
                                            )}
                                            {r.nineBoxAssessmentId && (
                                                <Badge variant="secondary" className="text-xs"><LayoutGrid className="size-3 mr-1" /> 9Box</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCalibragemOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ajuste do Comitê */}
            <Dialog open={ajusteRow != null} onOpenChange={(o) => { if (!o) setAjusteRow(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajuste do Comitê</DialogTitle>
                        <DialogDescription>{ajusteRow?.funcionarioNome}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score (0-5)</label>
                            <Input type="number" min={0} max={5} step={0.1} value={ajusteScore} onChange={(e) => setAjusteScore(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Desempenho</label>
                            <div className="flex gap-2 mt-1">
                                {[1, 2, 3].map((v) => (
                                    <button key={v} onClick={() => setAjusteDesempenho(v)} className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium ${ajusteDesempenho === v ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                                        {v === 1 ? "Baixo" : v === 2 ? "Médio" : "Alto"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Potencial</label>
                            <div className="flex gap-2 mt-1">
                                {[1, 2, 3].map((v) => (
                                    <button key={v} onClick={() => setAjustePotencial(v)} className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium ${ajustePotencial === v ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                                        {v === 1 ? "Baixo" : v === 2 ? "Médio" : "Alto"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Justificativa</label>
                            <textarea className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm" rows={3}
                                value={ajusteJustificativa} onChange={(e) => setAjusteJustificativa(e.target.value)} maxLength={2000} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAjusteRow(null)} disabled={ajusteSaving}>Cancelar</Button>
                        <Button onClick={() => void salvarAjuste()} disabled={ajusteSaving}>{ajusteSaving ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Decisão do Gestor */}
            <Dialog open={decisaoRow != null} onOpenChange={(o) => { if (!o) setDecisaoRow(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Decisão Final (Gestor)</DialogTitle>
                        <DialogDescription>{decisaoRow?.funcionarioNome}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Qual versão prevalece?</label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button onClick={() => setDecisaoVersao(1)} className={`rounded-md border px-3 py-2 text-left ${decisaoVersao === 1 ? "border-primary bg-primary/10" : "border-border/40"}`}>
                                    <div className="text-sm font-semibold">Gestor</div>
                                    <div className="text-[11px] text-muted-foreground">Score {decisaoRow?.scoreGestor.toFixed(2)} · D {decisaoRow?.desempenhoGestor ?? "—"} · P {decisaoRow?.potencialGestor ?? "—"}</div>
                                </button>
                                <button onClick={() => setDecisaoVersao(2)} className={`rounded-md border px-3 py-2 text-left ${decisaoVersao === 2 ? "border-primary bg-primary/10" : "border-border/40"}`} disabled={decisaoRow?.scoreComite == null && decisaoRow?.desempenhoComite == null && decisaoRow?.potencialComite == null}>
                                    <div className="text-sm font-semibold">Comitê</div>
                                    <div className="text-[11px] text-muted-foreground">Score {decisaoRow?.scoreComite?.toFixed(2) ?? "—"} · D {decisaoRow?.desempenhoComite ?? "—"} · P {decisaoRow?.potencialComite ?? "—"}</div>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observação</label>
                            <textarea className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm" rows={3}
                                value={decisaoObs} onChange={(e) => setDecisaoObs(e.target.value)} maxLength={2000} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={decisaoGerarNineBox} onChange={(e) => setDecisaoGerarNineBox(e.target.checked)} />
                            Gerar Nine-Box automaticamente (amarrado a este ciclo)
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDecisaoRow(null)} disabled={decisaoSaving}>Cancelar</Button>
                        <Button onClick={() => void salvarDecisao()} disabled={decisaoSaving}>{decisaoSaving ? "Salvando..." : "Confirmar Decisão"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nine-Box suggestion modal */}
            {nineBoxModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutGrid className="size-5 text-primary" />
                            <h3 className="text-sm font-semibold">Posicionar no Nine-Box</h3>
                        </div>
                        <div className="text-sm font-medium mb-0.5">{nineBoxModal.avaliandoNome}</div>
                        <div className="text-xs text-muted-foreground mb-4">{nineBoxModal.cargo ?? "—"}</div>

                        <div className="rounded-lg bg-muted/40 p-3 mb-4 text-xs">
                            <div className="font-medium mb-1">Desempenho (calculado da avaliação)</div>
                            <div className="flex gap-2">
                                {[1, 2, 3].map((v) => (
                                    <div key={v} className={`flex-1 rounded-md border px-2 py-1.5 text-center text-xs font-medium ${nineBoxModal.desempenho === v ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                                        {v === 1 ? "Baixo" : v === 2 ? "Médio" : "Alto"}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">
                                Potencial (sua avaliação): <span className="font-bold text-foreground">{nineBoxPotencial === 1 ? "Baixo" : nineBoxPotencial === 2 ? "Médio" : "Alto"}</span>
                            </label>
                            <input
                                type="range" min={1} max={3} step={1} value={nineBoxPotencial}
                                className="w-full accent-primary"
                                onChange={(e) => setNineBoxPotencial(Number(e.target.value))}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                <span>Baixo</span><span>Médio</span><span>Alto</span>
                            </div>
                        </div>

                        <div className="rounded-lg px-3 py-2 text-center text-xs font-semibold bg-primary/10 text-primary mb-5">
                            Quadrante: {NINE_BOX_NAMES[`${nineBoxModal.desempenho}-${nineBoxPotencial}`] ?? "—"}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setNineBoxModal(null)} disabled={savingNineBox}>Cancelar</Button>
                            <Button size="sm" className="flex-1" onClick={() => void salvarNineBox()} disabled={savingNineBox}>
                                {savingNineBox ? "Salvando..." : "Confirmar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
