"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    AlertCircle,
    AlertTriangle,
    Bot,
    Brain,
    ClipboardList,
    Download,
    Eye,
    Loader2,
    Mail,
    MoreHorizontal,
    PenSquare,
    Send,
    Sparkles,
    UserPlus,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import {
    MATCHING_FETCH_TIMEOUT_MS,
    MATCHING_LLM_CACHE_TIMEOUT_MS,
    MATCHING_SCORE_DIVERGENCE_THRESHOLD,
} from "@/features/recrutamento/matching/matchingHelpers";
import { AssistenteIaApi } from "@/features/assistente-ia/assistente-ia-api";
import MatchingBreakdownDialog, {
    useMatchingBreakdownDialog,
} from "@/features/recrutamento/matching/MatchingBreakdownDialog";
import LlmMatchingDialog, {
    useLlmMatchingDialog,
} from "@/features/recrutamento/matching/LlmMatchingDialog";

export interface HubCandidateRow {
    id: string;
    nome: string;
    email: string | null;
    fone: string | null;
    celular: string | null;
    status: string;
    createdAtUtc: string;
    candidaturaId?: string | null;
    etapaMacro?: string | number | null;
}

export interface CandidatosMatchTabProps {
    vagaId: string;
    candidates: HubCandidateRow[];
    temDescricaoCargo: boolean;
    matchMinimoPercentual: number;
    isReadOnly: boolean;
    onAddCandidate: () => void;
    onViewCandidate: (id: string) => void | Promise<void>;
    onEditCandidate: (id: string) => void | Promise<void>;
    onApproveCandidate: (c: HubCandidateRow) => void;
    onReenviarProposta: (c: HubCandidateRow) => void | Promise<void>;
    onAcompanharAdmissao: (candidatoId: string) => Promise<void>;
}

type MatchingModo = "ai" | "semantic" | "lexical";
type SortCol = "nome" | "data" | "score";
type MatchFilter = "todos" | "sem_match" | "abaixo" | "passou" | "divergencia" | "com_llm";

const ETAPA_MACRO_LABELS: Record<string, string> = {
    Aplicada: "Aplicada",
    EmTriagem: "Em triagem",
    Entrevista: "Entrevista",
    EntrevistaTecnica: "Entrevista técnica",
    Teste: "Teste",
    Proposta: "Proposta",
    Contratado: "Em processo de admissão",
    ReprovadoRh: "Reprovado RH",
    ReprovadoGestor: "Reprovado Gestor",
    Recusado: "Recusado",
    Desistiu: "Desistiu",
};

interface MatchRow {
    calculated: boolean;
    loading: boolean;
    error?: string;
    scoreFinal: number;
    scoreLexico: number | null;
    scoreSemantico: number | null;
    distanciaKm: number | null;
    modo: MatchingModo;
    passou: boolean;
    reqsFaltando: number;
    llmScore: number | null;
    llmPassou: boolean | null;
    llmCacheLoading: boolean;
}

type PortalCandidateDocument = {
    tipo?: string;
    nome?: string;
    link?: string | null;
    fileName?: string | null;
    temArquivo?: boolean;
};

function isPdfDocumentName(nomeArquivo: string | null | undefined): boolean {
    return (nomeArquivo ?? "").toLowerCase().endsWith(".pdf");
}

function findCurriculoDocument(items: PortalCandidateDocument[]): PortalCandidateDocument | undefined {
    return items.find((doc) => {
        const tipo = (doc.tipo ?? "").toLowerCase();
        const nome = (doc.nome ?? "").toLowerCase();
        return tipo.includes("curr") || nome.includes("curr");
    });
}

async function parseMatchApiError(res: Response): Promise<string> {
    const raw = await res.text().catch(() => "");
    if (!raw.trim()) return `HTTP ${res.status}`;
    try {
        const j = JSON.parse(raw) as Record<string, unknown>;
        const m = j.message ?? j.title ?? j.detail;
        if (typeof m === "string" && m.trim()) return m.trim();
    } catch {
        /* ignore */
    }
    return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw.trim();
}

async function fetchLlmCache(
    vagaId: string,
    candidatoId: string,
): Promise<{ scoreFinal: number; passouMatchMinimo: boolean } | null> {
    try {
        const res = await apiFetch(
            `/api/vagas/${vagaId}/matching-llm-cached/${candidatoId}`,
            { cache: "no-store" },
            MATCHING_LLM_CACHE_TIMEOUT_MS,
        );
        if (!res.ok) return null;
        return (await res.json()) as { scoreFinal: number; passouMatchMinimo: boolean };
    } catch {
        return null;
    }
}

export default function CandidatosMatchTab({
    vagaId,
    candidates,
    temDescricaoCargo,
    matchMinimoPercentual,
    isReadOnly,
    onAddCandidate,
    onViewCandidate,
    onEditCandidate,
    onApproveCandidate,
    onReenviarProposta,
    onAcompanharAdmissao,
}: CandidatosMatchTabProps) {
    const [matchById, setMatchById] = useState<Record<string, MatchRow>>({});
    const [reindexando, setReindexando] = useState(false);
    const [tenantLlmLabel, setTenantLlmLabel] = useState<string | null>(null);
    const [embeddingsOk, setEmbeddingsOk] = useState<boolean | null>(null);
    const [sortCol, setSortCol] = useState<SortCol>("nome");
    const [filter, setFilter] = useState<MatchFilter>("todos");
    const [notifyTarget, setNotifyTarget] = useState<HubCandidateRow | null>(null);
    const [notifySending, setNotifySending] = useState(false);
    const [previewingCvId, setPreviewingCvId] = useState<string | null>(null);
    const [pdfPreview, setPdfPreview] = useState<{ url: string; nomeArquivo: string } | null>(null);
    const breakdownDialog = useMatchingBreakdownDialog();
    const llmDialog = useLlmMatchingDialog();

    useEffect(() => {
        return () => {
            if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
        };
    }, [pdfPreview?.url]);

    useEffect(() => {
        AssistenteIaApi.health()
            .then((h) => {
                const emb = h as { embedding?: { usesCloudGemini?: boolean }; ollama?: { reachable?: boolean } };
                if (emb.embedding?.usesCloudGemini) setEmbeddingsOk(true);
                else setEmbeddingsOk(!!emb.ollama?.reachable);
            })
            .catch(() => setEmbeddingsOk(false));
        apiFetch("/api/tenant-configuracao/ai")
            .then(async (res) => {
                if (!res.ok) return;
                const dto = (await res.json()) as { effectiveLlmProvider?: string; effectiveLlmModel?: string };
                const p = dto.effectiveLlmProvider ?? "?";
                const m = dto.effectiveLlmModel ? ` (${dto.effectiveLlmModel})` : "";
                setTenantLlmLabel(`${p}${m}`);
            })
            .catch(() => setTenantLlmLabel(null));
    }, []);

    /** Só leitura de Análise IA em cache — sem breakdown híbrido. */
    const prefetchLlmCaches = useCallback(async () => {
        if (!temDescricaoCargo || candidates.length === 0) return;

        setMatchById((prev) => {
            const next = { ...prev };
            for (const c of candidates) {
                if (!next[c.id]) {
                    next[c.id] = emptyMatchRow();
                }
                next[c.id] = { ...next[c.id], llmCacheLoading: true };
            }
            return next;
        });

        const queue = [...candidates];
        const workers = Array.from({ length: 2 }, async () => {
            while (queue.length > 0) {
                const c = queue.shift();
                if (!c) return;
                const llm = await fetchLlmCache(vagaId, c.id);
                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        ...(prev[c.id] ?? emptyMatchRow()),
                        llmCacheLoading: false,
                        llmScore: llm?.scoreFinal ?? null,
                        llmPassou: llm?.passouMatchMinimo ?? null,
                    },
                }));
            }
        });
        await Promise.all(workers);
    }, [vagaId, candidates, temDescricaoCargo]);

    useEffect(() => {
        void prefetchLlmCaches();
    }, [prefetchLlmCaches]);

    const calcularMatch = useCallback(
        async (c: HubCandidateRow) => {
            if (!temDescricaoCargo) return;

            setMatchById((prev) => ({
                ...prev,
                [c.id]: {
                    ...(prev[c.id] ?? emptyMatchRow()),
                    loading: true,
                    error: undefined,
                },
            }));

            try {
                const res = await apiFetch(
                    `/api/vagas/${vagaId}/matching-breakdown-hybrid/${c.id}`,
                    { cache: "no-store" },
                    MATCHING_FETCH_TIMEOUT_MS,
                );
                if (!res.ok) throw new Error(await parseMatchApiError(res));

                const data = (await res.json()) as {
                    scoreFinal: number;
                    scoreLexico: number | null;
                    scoreSemantico: number | null;
                    distanciaKm: number | null;
                    modo: MatchingModo;
                    passouMatchMinimo: boolean;
                    requisitosObrigatoriosFaltando: string[];
                };

                const llm = await fetchLlmCache(vagaId, c.id);

                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        calculated: true,
                        loading: false,
                        scoreFinal: data.scoreFinal,
                        scoreLexico: data.scoreLexico,
                        scoreSemantico: data.scoreSemantico,
                        distanciaKm: data.distanciaKm,
                        modo: data.modo ?? "semantic",
                        passou: data.passouMatchMinimo,
                        reqsFaltando: data.requisitosObrigatoriosFaltando?.length ?? 0,
                        llmScore: llm?.scoreFinal ?? prev[c.id]?.llmScore ?? null,
                        llmPassou: llm?.passouMatchMinimo ?? prev[c.id]?.llmPassou ?? null,
                        llmCacheLoading: false,
                    },
                }));
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Falha ao calcular match";
                toast.error(`${c.nome}: ${msg}`, { duration: 8000 });
                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        ...(prev[c.id] ?? emptyMatchRow()),
                        calculated: false,
                        loading: false,
                        error: msg,
                    },
                }));
            }
        },
        [vagaId, temDescricaoCargo],
    );

    const reindexar = useCallback(async () => {
        setReindexando(true);
        try {
            const r = await AssistenteIaApi.reindexar(true);
            toast.success(
                `Currículos atualizados: ${r.candidatosIndexados} candidato(s) e ${r.itensIndexados} descrição(ões) de cargo.`,
            );
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setReindexando(false);
        }
    }, []);

    const solicitarAtualizacaoDados = useCallback(async () => {
        if (!notifyTarget) return;
        const campos = missingCandidateFields(notifyTarget);
        if (campos.length === 0) {
            toast.info("Este candidato não tem pendências de contato visíveis nesta lista.");
            setNotifyTarget(null);
            return;
        }

        setNotifySending(true);
        try {
            const res = await apiFetch(`/api/candidatos/${notifyTarget.id}/portal-notificacoes/solicitar-dados`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vagaId,
                    camposPendentes: campos,
                }),
            });
            if (!res.ok) throw new Error(await parseMatchApiError(res));
            toast.success("Solicitação enviada para o portal do candidato.");
            setNotifyTarget(null);
        } catch (err) {
            toast.error(`Erro ao avisar candidato: ${(err as Error).message}`);
        } finally {
            setNotifySending(false);
        }
    }, [notifyTarget, vagaId]);

    const buscarCurriculo = useCallback(async (candidato: HubCandidateRow) => {
        const res = await apiFetch(`/api/public/portal-candidates/${candidato.id}/documents`, { cache: "no-store" });
        if (!res.ok) throw new Error(await parseMatchApiError(res));
        const data = (await res.json()) as { items?: PortalCandidateDocument[] };
        const curriculo = findCurriculoDocument(data.items ?? []);
        if (!curriculo?.link) {
            throw new Error("Nenhum CV disponível neste candidato.");
        }
        return curriculo;
    }, []);

    const baixarCurriculo = useCallback(async (candidato: HubCandidateRow) => {
        try {
            const curriculo = await buscarCurriculo(candidato);
            const link = curriculo.link;
            if (!link) throw new Error("Nenhum CV disponível neste candidato.");
            const download = await apiFetch(link, { cache: "no-store" });
            if (!download.ok) throw new Error(await parseMatchApiError(download));
            const blob = await download.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = curriculo.fileName || curriculo.nome || `curriculo-${candidato.nome}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            toast.error(`Falha ao baixar CV: ${err instanceof Error ? err.message : "erro desconhecido"}`);
        }
    }, [buscarCurriculo]);

    const visualizarCurriculo = useCallback(async (candidato: HubCandidateRow) => {
        setPreviewingCvId(candidato.id);
        try {
            const curriculo = await buscarCurriculo(candidato);
            const nomeArquivo = curriculo.fileName || curriculo.nome || `curriculo-${candidato.nome}.pdf`;
            if (!isPdfDocumentName(nomeArquivo)) {
                throw new Error("A visualização no navegador está disponível apenas para PDFs.");
            }
            const link = curriculo.link;
            if (!link) throw new Error("Nenhum CV disponível neste candidato.");
            const res = await apiFetch(link, { cache: "no-store", headers: { Accept: "application/pdf,*/*" } }, 120_000);
            if (!res.ok) throw new Error(await parseMatchApiError(res));
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
            setPdfPreview((current) => {
                if (current?.url) URL.revokeObjectURL(current.url);
                return { url: objectUrl, nomeArquivo };
            });
        } catch (err) {
            toast.error(`Falha ao visualizar CV: ${err instanceof Error ? err.message : "erro desconhecido"}`);
        } finally {
            setPreviewingCvId(null);
        }
    }, [buscarCurriculo]);

    function closePdfPreview() {
        setPdfPreview((current) => {
            if (current?.url) URL.revokeObjectURL(current.url);
            return null;
        });
    }

    const rows = useMemo(() => {
        let list = candidates.map((c) => ({ ...c, m: matchById[c.id] }));

        if (filter === "sem_match") {
            list = list.filter((r) => !r.m?.calculated);
        } else if (filter === "abaixo") {
            list = list.filter((r) => r.m?.calculated && !r.m.passou);
        } else if (filter === "passou") {
            list = list.filter((r) => r.m?.calculated && r.m.passou);
        } else if (filter === "divergencia") {
            list = list.filter((r) => {
                const b = r.m?.scoreFinal;
                const l = r.m?.llmScore;
                return b != null && l != null && Math.abs(b - l) > MATCHING_SCORE_DIVERGENCE_THRESHOLD;
            });
        } else if (filter === "com_llm") {
            list = list.filter((r) => r.m?.llmScore != null);
        }

        return list.sort((a, b) => {
            if (sortCol === "score") {
                const sa = a.m?.calculated ? a.m.scoreFinal : -1;
                const sb = b.m?.calculated ? b.m.scoreFinal : -1;
                return sb - sa;
            }
            if (sortCol === "data") {
                return new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
            }
            return a.nome.localeCompare(b.nome, "pt-BR");
        });
    }, [candidates, matchById, filter, sortCol]);

    const stats = useMemo(() => {
        const calculated = candidates.filter((c) => matchById[c.id]?.calculated).length;
        const comLlm = candidates.filter((c) => matchById[c.id]?.llmScore != null).length;
        return { calculated, comLlm };
    }, [candidates, matchById]);

    const filterChips: { id: MatchFilter; label: string }[] = [
        { id: "todos", label: "Todos" },
        { id: "sem_match", label: "Sem match calculado" },
        { id: "passou", label: "Passou mínimo" },
        { id: "abaixo", label: "Abaixo do mínimo" },
        { id: "com_llm", label: "Com Análise IA" },
        { id: "divergencia", label: "Divergência >20" },
    ];

    return (
        <div className="mt-4 space-y-3">
            {/* Cabeçalho */}
            <div className="rounded-xl border border-border/40 bg-card p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full bg-primary/10 p-2 shrink-0">
                        <Users className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-sm">Candidatos & Match</div>
                        <div className="text-xs text-muted-foreground">
                            {candidates.length} candidato(s) · mínimo da vaga: {matchMinimoPercentual}%
                            {temDescricaoCargo && stats.calculated > 0 && (
                                <span> · {stats.calculated} com compatibilidade calculada</span>
                            )}
                            {stats.comLlm > 0 && <span> · {stats.comLlm} com Análise IA em cache</span>}
                        </div>
                        {temDescricaoCargo && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Análise IA: <span className="text-foreground/80">{tenantLlmLabel ?? "…"}</span>
                                {" · "}
                                Embeddings:{" "}
                                {embeddingsOk === null && "verificando…"}
                                {embeddingsOk === true && <span className="text-emerald-600">ok</span>}
                                {embeddingsOk === false && <span className="text-amber-600">fallback léxico</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!isReadOnly && (
                        <Button size="sm" onClick={onAddCandidate} className="gap-1.5">
                            <UserPlus className="size-3.5" />
                            Candidato
                        </Button>
                    )}
                    {temDescricaoCargo && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void reindexar()}
                            disabled={reindexando}
                            className="gap-1.5"
                            title="Use após incluir ou alterar currículos ou a descrição da vaga, para o match por IA usar os textos mais recentes."
                        >
                            {reindexando ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                            Atualizar currículos
                        </Button>
                    )}
                </div>
            </div>

            {!temDescricaoCargo && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-900 dark:text-amber-300">Matching indisponível</p>
                        <p className="text-amber-800/80 dark:text-amber-400/80 mt-1">
                            Vincule uma <strong>Descrição de Cargo (DNALIO)</strong> na edição da vaga para calcular match.
                            A lista de candidatos e ações de RH continuam disponíveis.
                        </p>
                    </div>
                </div>
            )}

            {temDescricaoCargo && candidates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Filtrar</span>
                    {filterChips.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilter(chip.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                filter === chip.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            )}

            {candidates.length === 0 ? (
                <div className="rounded-xl border border-border/40 bg-card p-8 text-center">
                    <Users className="mx-auto size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum candidato nesta vaga ainda.</p>
                    {!isReadOnly && (
                        <Button size="sm" className="mt-4 gap-1.5" onClick={onAddCandidate}>
                            <UserPlus className="size-3.5" />
                            Adicionar candidato
                        </Button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-border/40 bg-card overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th
                                    className="px-3 py-2 text-left cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("nome")}
                                >
                                    Candidato {sortCol === "nome" && "▼"}
                                </th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th
                                    className="px-3 py-2 text-left cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("data")}
                                >
                                    Data {sortCol === "data" && "▼"}
                                </th>
                                <th
                                    className="px-3 py-2 text-center whitespace-nowrap cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("score")}
                                    title="Divergência entre o score automático e a Análise IA"
                                >
                                    Match {sortCol === "score" && "▼"}
                                </th>
                                <th className="px-3 py-2 text-center">Mínimo da vaga</th>
                                <th className="px-3 py-2 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                                        Nenhum candidato neste filtro.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => {
                                    const m = r.m;
                                    return (
                                        <tr
                                            key={r.id}
                                            className="cursor-pointer hover:bg-muted/20 align-middle"
                                            onClick={() => void onViewCandidate(r.id)}
                                            title="Clique para visualizar os dados do candidato"
                                        >
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{r.nome}</div>
                                                <div className="text-[11px] text-muted-foreground">{r.email ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700">
                                                    {candidateStageLabel(r)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(r.createdAtUtc).toLocaleDateString("pt-BR")}
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {!temDescricaoCargo ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : (
                                                    <MatchScoreCell
                                                        m={m}
                                                        onCalcular={() => void calcularMatch(r)}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {!temDescricaoCargo ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : !m?.calculated ? (
                                                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                        {matchMinimoPercentual}%
                                                    </span>
                                                ) : m.passou ? (
                                                    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                        {matchMinimoPercentual}% · passou
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                        {matchMinimoPercentual}% · abaixo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <RowActions
                                                    candidato={r}
                                                    m={m}
                                                    temDescricaoCargo={temDescricaoCargo}
                                                    isReadOnly={isReadOnly}
                                                    onCalcularMatch={() => void calcularMatch(r)}
                                                    onBreakdown={() => breakdownDialog.open(vagaId, r.id, r.nome)}
                                                    onAnaliseIa={() => llmDialog.open(vagaId, r.id, r.nome)}
                                                    onView={() => void onViewCandidate(r.id)}
                                                    onEdit={() => void onEditCandidate(r.id)}
                                                    onPreviewCv={() => void visualizarCurriculo(r)}
                                                    onDownloadCv={() => void baixarCurriculo(r)}
                                                    previewingCv={previewingCvId === r.id}
                                                    onApprove={() => onApproveCandidate(r)}
                                                    onReenviarProposta={() => void onReenviarProposta(r)}
                                                    onNotify={() => setNotifyTarget(r)}
                                                    onAcompanhar={() => void onAcompanharAdmissao(r.id)}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {breakdownDialog.target && (
                <MatchingBreakdownDialog
                    open
                    onClose={breakdownDialog.close}
                    vagaId={breakdownDialog.target.vagaId}
                    candidatoId={breakdownDialog.target.candidatoId}
                    candidatoNome={breakdownDialog.target.candidatoNome}
                />
            )}

            {llmDialog.target && (
                <LlmMatchingDialog
                    open
                    onClose={llmDialog.close}
                    vagaId={llmDialog.target.vagaId}
                    candidatoId={llmDialog.target.candidatoId}
                    candidatoNome={llmDialog.target.candidatoNome}
                    onAnalyzed={(result) => {
                        const cid = llmDialog.target!.candidatoId;
                        setMatchById((prev) => ({
                            ...prev,
                            [cid]: {
                                ...(prev[cid] ?? emptyMatchRow()),
                                llmScore: result.scoreFinal,
                                llmPassou: result.passouMatchMinimo,
                                llmCacheLoading: false,
                            },
                        }));
                    }}
                />
            )}

            <Dialog open={!!notifyTarget} onOpenChange={(open) => !open && setNotifyTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Avisar candidato para completar dados</DialogTitle>
                        <DialogDescription>
                            A mensagem será exibida dentro do Portal de Vagas do candidato.
                        </DialogDescription>
                    </DialogHeader>
                    {notifyTarget && (
                        <div className="space-y-3 text-sm">
                            <div>
                                <div className="font-medium">{notifyTarget.nome}</div>
                                <div className="text-xs text-muted-foreground">{notifyTarget.email || "Sem e-mail cadastrado"}</div>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                                    Pendências que serão solicitadas
                                </div>
                                <ul className="space-y-1">
                                    {missingCandidateFields(notifyTarget).map((field) => (
                                        <li key={field} className="flex items-center gap-2">
                                            <span className="inline-flex size-4 items-center justify-center rounded border text-[10px]">
                                                ✓
                                            </span>
                                            <span>{field}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                O candidato verá a ação necessária em <strong>Notificações</strong> e poderá ir para o
                                perfil para atualizar os dados.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotifyTarget(null)} disabled={notifySending}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void solicitarAtualizacaoDados()} disabled={notifySending}>
                            {notifySending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Enviar solicitação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {pdfPreview ? (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={closePdfPreview}>
                    <div className="flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-800">Visualizar PDF</div>
                                <div className="truncate text-xs text-muted-foreground">{pdfPreview.nomeArquivo}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => {
                                        const a = document.createElement("a");
                                        a.href = pdfPreview.url;
                                        a.download = pdfPreview.nomeArquivo || "curriculo.pdf";
                                        a.rel = "noopener";
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                    }}
                                >
                                    <Download className="size-4" />
                                    Baixar
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                                    onClick={closePdfPreview}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                        <iframe title={`PDF - ${pdfPreview.nomeArquivo}`} src={pdfPreview.url} className="min-h-0 flex-1 bg-slate-100" />
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function emptyMatchRow(): MatchRow {
    return {
        calculated: false,
        loading: false,
        scoreFinal: 0,
        scoreLexico: null,
        scoreSemantico: null,
        distanciaKm: null,
        modo: "lexical",
        passou: false,
        reqsFaltando: 0,
        llmScore: null,
        llmPassou: null,
        llmCacheLoading: false,
    };
}

function missingCandidateFields(candidato: HubCandidateRow): string[] {
    const fields: string[] = [];
    if (!candidato.email?.trim()) fields.push("e-mail");
    if (!candidato.celular?.trim()) fields.push("celular");
    if (!candidato.fone?.trim()) fields.push("telefone");
    return fields;
}

function normalizeEtapaMacro(value: string | number | null | undefined): string {
    if (typeof value === "number") {
        return ["Aplicada", "EmTriagem", "Entrevista", "Teste", "Proposta", "Contratado", "Recusado", "Desistiu", "EntrevistaTecnica", "ReprovadoRh", "ReprovadoGestor"][value] ?? "Aplicada";
    }
    return value ?? "Aplicada";
}

function candidateStageLabel(candidato: HubCandidateRow): string {
    if (candidato.etapaMacro == null) return candidato.status;
    const etapa = normalizeEtapaMacro(candidato.etapaMacro);
    return ETAPA_MACRO_LABELS[etapa] ?? etapa;
}

function canApproveCandidate(candidato: HubCandidateRow): boolean {
    return normalizeEtapaMacro(candidato.etapaMacro) === "Proposta";
}

function canAcompanharAdmissao(candidato: HubCandidateRow): boolean {
    const etapa = normalizeEtapaMacro(candidato.etapaMacro);
    return etapa === "Contratado" || candidato.status === "Aprovado";
}

function MatchScoreCell({ m, onCalcular }: { m?: MatchRow; onCalcular: () => void }) {
    if (m?.loading) {
        return (
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" />
                Calculando…
            </span>
        );
    }

    if (m?.error) {
        return (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="text-red-600 text-xs max-w-[140px] truncate" title={m.error}>
                    {m.error}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 whitespace-nowrap" onClick={onCalcular}>
                    Tentar de novo
                </Button>
            </span>
        );
    }

    if (!m?.calculated) {
        return (
            <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1 shrink-0 whitespace-nowrap"
                onClick={onCalcular}
            >
                <Sparkles className="size-3 shrink-0" />
                Calcular match
            </Button>
        );
    }

    return <DivergencePtsChip m={m} />;
}

function DivergencePtsChip({ m }: { m: MatchRow }) {
    const breakdown = m.scoreFinal;
    const llm = m.llmScore;
    const diverge =
        llm != null && Math.abs(breakdown - llm) > MATCHING_SCORE_DIVERGENCE_THRESHOLD;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                m.passou
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            }`}
            title={llm != null ? `Compatibilidade ${breakdown}% vs Análise IA ${llm}% — métodos distintos` : "Compatibilidade calculada"}
        >
            {breakdown}%
            {diverge && <AlertTriangle className="size-3 shrink-0 text-amber-600" />}
        </span>
    );
}

function RowActions({
    candidato,
    m,
    temDescricaoCargo,
    isReadOnly,
    onCalcularMatch,
    onBreakdown,
    onAnaliseIa,
    onView,
    onEdit,
    onPreviewCv,
    onDownloadCv,
    previewingCv,
    onApprove,
    onReenviarProposta,
    onNotify,
    onAcompanhar,
}: {
    candidato: HubCandidateRow;
    m?: MatchRow;
    temDescricaoCargo: boolean;
    isReadOnly: boolean;
    onCalcularMatch: () => void;
    onBreakdown: () => void;
    onAnaliseIa: () => void;
    onView: () => void;
    onEdit: () => void;
    onPreviewCv: () => void;
    onDownloadCv: () => void;
    previewingCv: boolean;
    onApprove: () => void;
    onReenviarProposta: () => void;
    onNotify: () => void;
    onAcompanhar: () => void;
}) {
    const breakdownLabel = m?.calculated ? `Compatibilidade ${m.scoreFinal}%` : "Compatibilidade";
    const analiseIaLabel = m?.llmScore != null ? `Análise IA ${m.llmScore}%` : "Análise IA";
    const missingFields = missingCandidateFields(candidato);
    const approvalAvailable = canApproveCandidate(candidato);

    return (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {temDescricaoCargo && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs hidden lg:inline-flex whitespace-nowrap"
                        onClick={onBreakdown}
                        disabled={m?.loading}
                    >
                        {breakdownLabel}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 border-violet-500/40 text-violet-700 hover:bg-violet-500/10 hidden lg:inline-flex whitespace-nowrap"
                        onClick={onAnaliseIa}
                        disabled={m?.loading}
                    >
                        <Brain className="size-3 shrink-0" />
                        {analiseIaLabel}
                    </Button>
                </>
            )}
            <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 hidden xl:inline-flex whitespace-nowrap"
                onClick={onPreviewCv}
                disabled={previewingCv}
            >
                {previewingCv ? <Loader2 className="size-3 shrink-0 animate-spin" /> : <Eye className="size-3 shrink-0" />}
                Visualizar CV
            </Button>
            <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 hidden xl:inline-flex whitespace-nowrap"
                onClick={onDownloadCv}
            >
                <Download className="size-3 shrink-0" />
                Baixar CV
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Ações</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {temDescricaoCargo && (
                        <>
                            <DropdownMenuItem onClick={onCalcularMatch} disabled={m?.loading}>
                                <Sparkles className="size-4 mr-2" />
                                {m?.calculated ? "Recalcular match" : "Calcular match"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBreakdown} disabled={m?.loading}>
                                {breakdownLabel}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onAnaliseIa}>
                                <Brain className="size-4 mr-2" />
                                {analiseIaLabel}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {!isReadOnly && (
                        <DropdownMenuItem onClick={onEdit}>
                            <PenSquare className="size-4 mr-2" />
                            Editar candidato
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onView}>
                        <Eye className="size-4 mr-2" />
                        Visualizar candidato
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onPreviewCv} disabled={previewingCv}>
                        {previewingCv ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Eye className="size-4 mr-2" />}
                        Visualizar CV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDownloadCv}>
                        <Download className="size-4 mr-2" />
                        Baixar CV
                    </DropdownMenuItem>
                    {!isReadOnly && approvalAvailable && (
                        <DropdownMenuItem onClick={onReenviarProposta}>
                            <Send className="size-4 mr-2" />
                            Reenviar proposta
                        </DropdownMenuItem>
                    )}
                    {!isReadOnly && missingFields.length > 0 && (
                        <DropdownMenuItem onClick={onNotify}>
                            <AlertCircle className="size-4 mr-2" />
                            Avisar candidato
                        </DropdownMenuItem>
                    )}
                    {!isReadOnly && approvalAvailable && (
                        <DropdownMenuItem onClick={onApprove}>
                            <Mail className="size-4 mr-2" />
                            {candidato.status === "Aprovado" ? "Reenviar aprovação" : "Aprovar candidato"}
                        </DropdownMenuItem>
                    )}
                    {!isReadOnly && !approvalAvailable && !canAcompanharAdmissao(candidato) && (
                        <DropdownMenuItem disabled title={normalizeEtapaMacro(candidato.etapaMacro) === "Contratado"
                            ? "Use Acompanhar admissão após o aceite da proposta."
                            : "Avance a candidatura até Proposta antes de aprovar."}>
                            <Mail className="size-4 mr-2" />
                            Aprovar candidato indisponível
                        </DropdownMenuItem>
                    )}
                    {!isReadOnly && canAcompanharAdmissao(candidato) && (
                        <DropdownMenuItem onClick={onAcompanhar}>
                            <ClipboardList className="size-4 mr-2" />
                            Acompanhar admissão
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

