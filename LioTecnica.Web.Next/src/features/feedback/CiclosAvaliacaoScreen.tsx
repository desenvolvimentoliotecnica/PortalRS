"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, RefreshCw, CheckCircle2, Clock, Lock, ClipboardList,
    ChevronRight, Trash2, BarChart2, LayoutGrid, Mail, Play, Scale, Download, FileEdit,
    Sparkles, BookTemplate, Users as UsersIcon, MoreHorizontal, Search, Filter,
} from "lucide-react";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
    dataInicio: string | null;
    dataFim: string | null;
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

interface TemplatePerguntaResponse {
    id: string;
    texto: string;
    ordem: number;
}

interface TemplateResponse {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    periodoSugerido: string | null;
    isSystem: boolean;
    isActive: boolean;
    ordem: number;
    totalPerguntas: number;
    criadoEmUtc: string;
    perguntas: TemplatePerguntaResponse[];
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

/* ───── Componentes visuais ───── */

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: "blue" | "slate" | "emerald" | "indigo" }) {
    const palette = {
        blue:    { iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconText: "text-blue-600 dark:text-blue-400" },
        slate:   { iconBg: "bg-slate-100 dark:bg-slate-800",       iconText: "text-slate-500 dark:text-slate-400" },
        emerald: { iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconText: "text-emerald-600 dark:text-emerald-400" },
        indigo:  { iconBg: "bg-indigo-50 dark:bg-indigo-950/40",   iconText: "text-indigo-600 dark:text-indigo-400" },
    }[tone];
    return (
        <div className="rounded-xl border border-border/40 bg-card px-5 py-4 hover:border-border/80 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="text-sm text-muted-foreground font-medium">{label}</div>
                <div className={`shrink-0 size-8 rounded-md ${palette.iconBg} flex items-center justify-center`}>
                    <Icon className={`size-4 ${palette.iconText}`} />
                </div>
            </div>
            <div className="text-3xl font-bold mt-3 tracking-tight">{value}</div>
        </div>
    );
}

function TabPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
        >
            {label}
            <span className={`text-xs ${active ? "opacity-70" : "opacity-60"}`}>{count}</span>
        </button>
    );
}

function ParticipantsAvatars({ total }: { total: number }) {
    if (total === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }
    // Mostra até 4 placeholders coloridos + "+N" se sobrar
    const colors = [
        "bg-amber-200 text-amber-800",
        "bg-violet-200 text-violet-800",
        "bg-emerald-200 text-emerald-800",
        "bg-rose-200 text-rose-800",
    ];
    const initials = ["AB", "CM", "JS", "LP"];
    const visible = Math.min(total, 4);
    const extra = total - visible;
    return (
        <div className="flex items-center -space-x-2">
            {Array.from({ length: visible }).map((_, i) => (
                <div
                    key={i}
                    className={`size-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold ${colors[i % colors.length]}`}
                    title="Participante"
                >
                    {initials[i % initials.length]}
                </div>
            ))}
            {extra > 0 && (
                <div className="size-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    +{extra}
                </div>
            )}
        </div>
    );
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
    const [criarTemplateId, setCriarTemplateId] = useState<string | null>(null);

    /* templates (Entrega 1.1 — Fase 1 Paridade Feedz) */
    const [templates, setTemplates] = useState<TemplateResponse[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesPickerOpen, setTemplatesPickerOpen] = useState(false);

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

    /* templates loader */
    const loadTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const data = await fetchJson<TemplateResponse[]>("/api/avaliacao/templates");
            setTemplates(data ?? []);
        } catch {
            toast.error("Falha ao carregar templates de avaliação.");
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    function applyTemplate(t: TemplateResponse) {
        // Pré-popula o form de criar ciclo com os dados do template (editáveis pelo usuário).
        setCriarTemplateId(t.id);
        setCriarNome(t.nome);
        setCriarPeriodo(t.periodoSugerido ?? "");
        setCriarPerguntas(t.perguntas.length > 0 ? t.perguntas.map(p => p.texto) : [""]);
        setCriarRascunho(false);
        setTemplatesPickerOpen(false);
        setCriarOpen(true);
    }

    function resetCriarForm() {
        setCriarTemplateId(null);
        setCriarNome(""); setCriarPeriodo(""); setCriarPerguntas(["", "", ""]); setCriarRascunho(false);
    }

    async function criarCiclo() {
        const perguntas = criarPerguntas.filter(p => p.trim());
        if (!criarNome.trim()) { toast.error("Informe o nome do ciclo."); return; }
        if (!criarPeriodo.trim()) { toast.error("Informe o período."); return; }
        if (perguntas.length === 0) { toast.error("Adicione ao menos uma pergunta."); return; }
        setCriarLoading(true);
        try {
            // Se template foi escolhido E perguntas não foram alteradas, usa endpoint /from-template.
            // Se usuário editou perguntas, cai no fluxo padrão /ciclos (porque já não é um ciclo "puro do template").
            const usaTemplate = criarTemplateId !== null
                && templates.find(t => t.id === criarTemplateId)?.perguntas.map(p => p.texto).join("\n") === perguntas.join("\n");

            if (usaTemplate) {
                await fetchJson("/api/avaliacao/ciclos/from-template", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        templateId: criarTemplateId,
                        nome: criarNome.trim(),
                        periodo: criarPeriodo.trim(),
                        iniciarEmRascunho: criarRascunho,
                    }),
                });
            } else {
                await fetchJson("/api/avaliacao/ciclos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome: criarNome.trim(), periodo: criarPeriodo.trim(), perguntas, iniciarEmRascunho: criarRascunho }),
                });
            }

            toast.success(criarRascunho ? "Ciclo criado em rascunho — ative quando pronto." : "Ciclo criado!");
            setCriarOpen(false);
            resetCriarForm();
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

    // ─── Stats e filtros ───
    const [tabFilter, setTabFilter] = useState<"all" | "abertos" | "rascunhos" | "fechados">("all");
    const [searchQ, setSearchQ] = useState("");

    const stats = ciclos.reduce(
        (acc, c) => {
            acc.total++;
            if (c.status === 0) acc.abertos++;
            else if (c.status === 1) acc.fechados++;
            else if (c.status === 2) acc.rascunhos++;
            else if (c.status === 3) acc.emCalibragem++;
            acc.respostasTotais += c.totalRespostas;
            return acc;
        },
        { total: 0, abertos: 0, fechados: 0, rascunhos: 0, emCalibragem: 0, respostasTotais: 0 }
    );

    const ciclosFiltered = ciclos.filter((c) => {
        if (tabFilter === "abertos" && !(c.status === 0 || c.status === 3)) return false;
        if (tabFilter === "rascunhos" && c.status !== 2) return false;
        if (tabFilter === "fechados" && c.status !== 1) return false;
        if (searchQ.trim() && !c.nome.toLowerCase().includes(searchQ.trim().toLowerCase()) && !c.periodo.toLowerCase().includes(searchQ.trim().toLowerCase())) return false;
        return true;
    });

    function fmtDataExtensa(iso: string | null | undefined) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
        } catch { return iso; }
    }

    return (
        <section className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Desempenho
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Ciclos de Avaliação</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Avaliações formais de desempenho com perguntas configuradas, escala 1-5 e fluxo 360°.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Button variant="outline" size="sm" onClick={() => { void loadTemplates(); setTemplatesPickerOpen(true); }}>
                            <BookTemplate className="size-4 mr-1.5" /> De Template
                        </Button>
                    )}
                    {isAdmin && (
                        <Button size="sm" onClick={() => { resetCriarForm(); setCriarOpen(true); }}>
                            <Plus className="size-4 mr-1" /> Novo Ciclo
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} title="Atualizar">
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Em andamento"        value={stats.abertos}     icon={Play}         tone="blue" />
                <KpiCard label="Rascunhos"           value={stats.rascunhos}   icon={FileEdit}     tone="slate" />
                <KpiCard label="Encerrados"          value={stats.fechados}    icon={CheckCircle2} tone="emerald" />
                <KpiCard label="Pessoas avaliadas"   value={stats.respostasTotais} icon={UsersIcon} tone="indigo" />
            </div>

            {/* ── Tabs filtro + busca + tabela (só quando há ciclos) ── */}
            {!loading && ciclos.length === 0 ? null : (
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border/40">
                    <div className="flex items-center gap-1 flex-wrap">
                        <TabPill active={tabFilter === "all"}       label="Todos"         count={stats.total}    onClick={() => setTabFilter("all")} />
                        <TabPill active={tabFilter === "abertos"}   label="Em andamento"  count={stats.abertos + stats.emCalibragem} onClick={() => setTabFilter("abertos")} />
                        <TabPill active={tabFilter === "rascunhos"} label="Rascunhos"     count={stats.rascunhos} onClick={() => setTabFilter("rascunhos")} />
                        <TabPill active={tabFilter === "fechados"}  label="Encerrados"    count={stats.fechados}  onClick={() => setTabFilter("fechados")} />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input className="h-9 pl-8 w-[220px]" placeholder="Buscar ciclo..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                        </div>
                        <Button variant="outline" size="sm" disabled title="Em breve">
                            <Filter className="size-4 mr-1" /> Filtros
                        </Button>
                    </div>
                </div>

                {/* ── Tabela ── */}
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ciclo</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Período</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progresso</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Participantes</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : ciclosFiltered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                    <ClipboardList className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                                    {ciclos.length === 0 ? "Nenhum ciclo criado ainda." : "Nenhum ciclo bate com os filtros."}
                                </TableCell>
                            </TableRow>
                        ) : ciclosFiltered.map((ciclo) => {
                            const cfg = CICLO_STATUS[ciclo.status] ?? CICLO_STATUS[0];
                            const StatusIcon = cfg.icon;
                            const fechado = ciclo.status === 1;
                            const rascunho = ciclo.status === 2;
                            const emCalibragem = ciclo.status === 3;
                            const aberto = ciclo.status === 0;
                            const totalEsperado = Math.max(ciclo.totalPerguntas, 1);
                            const pct = Math.min(100, Math.round((ciclo.totalRespostas / totalEsperado) * 100));
                            const statusColor =
                                fechado ? { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" } :
                                emCalibragem ? { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" } :
                                rascunho ? { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-700 dark:text-slate-400", dot: "bg-slate-400" } :
                                { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" };
                            const iconColor =
                                fechado ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                emCalibragem ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" :
                                rascunho ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" :
                                "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
                            return (
                                <TableRow key={ciclo.id} className="hover:bg-muted/20 transition-colors">
                                    {/* CICLO: ícone + nome + descrição */}
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`shrink-0 size-10 rounded-lg flex items-center justify-center ${iconColor}`}>
                                                <StatusIcon className="size-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm">{ciclo.nome}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {ciclo.periodo} · {ciclo.totalPerguntas} pergunta{ciclo.totalPerguntas !== 1 ? "s" : ""} · escala 1-5
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    {/* STATUS */}
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                                            <span className={`size-1.5 rounded-full ${statusColor.dot}`} />
                                            {cfg.label}
                                        </span>
                                    </TableCell>
                                    {/* PERÍODO */}
                                    <TableCell>
                                        {ciclo.dataInicio || ciclo.dataFim ? (
                                            <div className="text-xs">
                                                <div>{fmtDataExtensa(ciclo.dataInicio)}</div>
                                                <div className="text-muted-foreground">até {fmtDataExtensa(ciclo.dataFim)}</div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    {/* PROGRESSO */}
                                    <TableCell>
                                        <div className="flex items-center gap-2 min-w-[140px] max-w-[220px]">
                                            <div className="flex-1">
                                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${
                                                            fechado ? "bg-emerald-500" :
                                                            emCalibragem ? "bg-violet-500" :
                                                            "bg-blue-500"
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    {ciclo.totalRespostas}/{ciclo.totalPerguntas} concluídas
                                                </div>
                                            </div>
                                            <span className="text-sm font-semibold w-10 text-right">{pct}%</span>
                                        </div>
                                    </TableCell>
                                    {/* PARTICIPANTES */}
                                    <TableCell>
                                        <ParticipantsAvatars total={ciclo.totalRespostas} />
                                    </TableCell>
                                    {/* AÇÕES */}
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" title="Ações">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuItem onClick={() => void openResultados(ciclo)}>
                                                    <BarChart2 className="size-4 mr-2" /> Ver resultados
                                                </DropdownMenuItem>
                                                {(aberto || emCalibragem) && (
                                                    <DropdownMenuItem onClick={() => router.push(`/feedback/avaliacao/${ciclo.id}`)}>
                                                        <ChevronRight className="size-4 mr-2" /> Responder
                                                    </DropdownMenuItem>
                                                )}
                                                {rascunho && isAdmin && (
                                                    <DropdownMenuItem onClick={() => void ativarCiclo(ciclo.id)}>
                                                        <Play className="size-4 mr-2" /> Ativar ciclo
                                                    </DropdownMenuItem>
                                                )}
                                                {aberto && isAdmin && (
                                                    <DropdownMenuItem onClick={() => void gerarConvites(ciclo.id)}>
                                                        <Mail className="size-4 mr-2" /> Gerar convites
                                                    </DropdownMenuItem>
                                                )}
                                                {(emCalibragem || fechado) && isAdmin && (
                                                    <DropdownMenuItem onClick={() => void openCalibragem(ciclo)}>
                                                        <Scale className="size-4 mr-2" /> Calibragem
                                                    </DropdownMenuItem>
                                                )}
                                                {isAdmin && (
                                                    <DropdownMenuItem onClick={() => void exportarCsv(ciclo.id, ciclo.nome)}>
                                                        <Download className="size-4 mr-2" /> Exportar CSV
                                                    </DropdownMenuItem>
                                                )}
                                                {(aberto || emCalibragem) && isAdmin && (
                                                    <DropdownMenuItem onClick={() => void fecharCiclo(ciclo.id)} className="text-destructive">
                                                        <Lock className="size-4 mr-2" /> Fechar ciclo
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            )}

            {/* Templates Picker Dialog (Entrega 1.1 — Fase 1 Paridade Feedz) */}
            <Dialog open={templatesPickerOpen} onOpenChange={setTemplatesPickerOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookTemplate className="size-5 text-primary" />
                            Escolha um Template
                        </DialogTitle>
                        <DialogDescription>
                            Selecione um modelo pronto para criar seu ciclo rapidamente. Os campos serão pré-preenchidos e ainda podem ser editados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 max-h-[60vh] overflow-y-auto">
                        {templatesLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
                        ) : templates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum template disponível.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {templates.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => applyTemplate(t)}
                                        className="text-left rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:border-primary hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-sm">{t.nome}</h3>
                                            {t.isSystem && <Badge variant="secondary" className="text-[10px] shrink-0"><Sparkles className="size-2.5 mr-0.5" /> Padrão</Badge>}
                                        </div>
                                        {t.descricao && (
                                            <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{t.descricao}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                            <span>{t.totalPerguntas} pergunta{t.totalPerguntas !== 1 ? "s" : ""}</span>
                                            {t.periodoSugerido && <span>· {t.periodoSugerido}</span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplatesPickerOpen(false)}>Cancelar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Criar Ciclo Dialog */}
            <Dialog open={criarOpen} onOpenChange={(o) => { setCriarOpen(o); if (!o) resetCriarForm(); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Novo Ciclo de Avaliação
                            {criarTemplateId && (
                                <Badge variant="secondary" className="text-[10px]">
                                    <BookTemplate className="size-2.5 mr-0.5" /> Do template
                                </Badge>
                            )}
                        </DialogTitle>
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
