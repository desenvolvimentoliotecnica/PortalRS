"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Briefcase,
    Clock,
    FileText,
    Loader2,
    Paperclip,
    Sparkles,
    UserCheck,
    User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

/* ── Types ── */

type CandidatoDetail = {
    id: string;
    nome: string;
    email: string;
    resumoProfissional: string | null;
    observacoes: string | null;
    cvTexto: string | null;
    status: string | null;
    recrutadorNome: string | null;
    updatedAt: string | null;
};

type DocItem = {
    id: string;
    fileName: string;
    fileType: string | null;
    uploadedAt: string | null;
    downloadUrl: string | null;
};

type MatchResult = {
    score: number;
    threshold: number;
    hitsCount: number;
    missCount: number;
    requirements: Array<{
        keyword: string;
        found: boolean;
        weight: number;
        mandatory: boolean;
    }>;
};

/* ── API ── */

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

/* ── Helpers ── */

/** Normaliza score para 0-100 independente de o backend retornar 0-1 ou 0-100 */
function normalizeScore(v: number): number {
    return Math.round(v > 1 ? v : v * 100);
}

/* ── Component ── */

type Tab = "resumo" | "cv" | "docs" | "match";

export default function CandidatoDetalhesScreen() {
    const sp = useSearchParams();
    const router = useRouter();
    const candidatoId = sp.get("id") ?? "";
    const vagaId = sp.get("vagaId") ?? "";

    const [tab, setTab] = useState<Tab>("resumo");
    const [loading, setLoading] = useState(true);
    const [cand, setCand] = useState<CandidatoDetail | null>(null);
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [match, setMatch] = useState<MatchResult | null>(null);
    const [matchLoading, setMatchLoading] = useState(false);
    const [admissaoLoading, setAdmissaoLoading] = useState(false);

    const iniciarAdmissao = async () => {
        setAdmissaoLoading(true);
        try {
            const res = await apiFetch("/api/pre-admissao/iniciar-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidatoId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error((err as { message?: string }).message ?? "Erro ao iniciar admissão.");
                return;
            }
            const data = (await res.json()) as { id: string };
            toast.success("Admissão iniciada. Preenchendo dados...");
            router.push(`/admissao/nova?id=${data.id}`);
        } catch {
            toast.error("Falha ao iniciar admissão.");
        } finally {
            setAdmissaoLoading(false);
        }
    };

    const load = useCallback(async () => {
        if (!candidatoId) return;
        setLoading(true);
        try {
            const [c, d] = await Promise.all([
                fetchJson<CandidatoDetail>(`/api/candidatos/${candidatoId}`),
                fetchJson<DocItem[]>(`/api/candidatos/${candidatoId}/documents`).catch(() => []),
            ]);
            setCand(c);
            setDocs(Array.isArray(d) ? d : []);
        } catch {
            toast.error("Falha ao carregar candidato.");
        } finally {
            setLoading(false);
        }
    }, [candidatoId]);

    useEffect(() => { void load(); }, [load]);

    /* Load match when tab is selected and vagaId exists */
    useEffect(() => {
        if (tab !== "match" || !vagaId || !candidatoId || match) return;
        setMatchLoading(true);
        fetchJson<MatchResult>(`/api/vagas/${vagaId}/matching/${candidatoId}`)
            .then(setMatch)
            .catch(() => toast.error("Falha ao carregar matching."))
            .finally(() => setMatchLoading(false));
    }, [tab, vagaId, candidatoId, match]);

    const initials = (cand?.nome ?? "—")
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "resumo", label: "Resumo", icon: <FileText className="size-4" /> },
        { key: "cv", label: "Texto do CV", icon: <FileText className="size-4" /> },
        { key: "docs", label: "Documentos", icon: <Paperclip className="size-4" /> },
        { key: "match", label: "Match", icon: <Sparkles className="size-4" /> },
    ];

    if (!candidatoId) {
        return (
            <section className="card-soft p-6 text-center">
                <p className="text-muted-foreground">Nenhum candidato selecionado.</p>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/candidatos">
                        <ArrowLeft className="size-4" /> Voltar para Candidatos
                    </Link>
                </Button>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Detalhes do candidato</h4>
                    <div className="text-muted-foreground text-sm">Match, histórico e status.</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/candidatos">
                        <ArrowLeft className="size-4" /> Voltar
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div className="card-soft p-12 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </div>
            ) : cand ? (
                <div className="card-soft p-4 space-y-4">
                    {/* Candidate header */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex size-14 items-center justify-center rounded-full font-bold text-white text-lg"
                                style={{ background: "rgb(var(--lt-primary))" }}
                            >
                                {initials}
                            </div>
                            <div>
                                <h5 className="font-bold text-base">{cand.nome}</h5>
                                <a href={`mailto:${cand.email}`} className="text-muted-foreground text-sm hover:underline">{cand.email}</a>
                                {cand.updatedAt && (
                                    <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                                        <Clock className="size-3" /> Atualizado: {new Date(cand.updatedAt).toLocaleDateString("pt-BR")}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-end space-y-1.5">
                            {cand.status && (
                                <span className="badge-soft">{cand.status}</span>
                            )}
                            {vagaId && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Briefcase className="size-3" /> Vaga vinculada
                                </div>
                            )}
                            {cand.recrutadorNome && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="size-3" /> Recrutador: {cand.recrutadorNome}
                                </div>
                            )}
                            {cand.status === "Aprovado" && (
                                <Button
                                    size="sm"
                                    onClick={iniciarAdmissao}
                                    disabled={admissaoLoading}
                                >
                                    {admissaoLoading
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <UserCheck className="size-4" />}
                                    Iniciar Admissão
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Tab navigation */}
                    <div className="flex flex-wrap gap-1 rounded-full border px-1 py-1" style={{ background: "rgba(173,200,220,.16)", borderColor: "rgba(16,82,144,.14)" }}>
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key
                                        ? "bg-white shadow-sm text-[rgb(var(--lt-brand))]"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                onClick={() => setTab(t.key)}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {tab === "resumo" && (
                        <div className="space-y-3">
                            <div>
                                <div className="font-semibold mb-1">Resumo profissional</div>
                                <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                                    {cand.resumoProfissional || "—"}
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold mb-1">Observações</div>
                                <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                                    {cand.observacoes || "—"}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "cv" && (
                        <div>
                            <div className="font-semibold mb-1">Texto do CV</div>
                            <div className="text-muted-foreground text-sm mb-2">Texto usado para matching.</div>
                            <textarea
                                className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
                                rows={12}
                                readOnly
                                value={cand.cvTexto || "Sem texto de CV disponível."}
                                style={{ borderColor: "var(--lt-border)" }}
                            />
                        </div>
                    )}

                    {tab === "docs" && (
                        <div>
                            <div className="font-semibold mb-1">Documentos</div>
                            <div className="text-muted-foreground text-sm mb-2">Currículos e anexos do candidato.</div>
                            {docs.length === 0 ? (
                                <div className="text-muted-foreground text-sm py-4 text-center">Nenhum documento encontrado.</div>
                            ) : (
                                <div className="space-y-2">
                                    {docs.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium truncate">{d.fileName}</div>
                                                    {d.uploadedAt && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(d.uploadedAt).toLocaleDateString("pt-BR")}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {d.downloadUrl && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer">
                                                        Download
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === "match" && (
                        <div>
                            {!vagaId ? (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                                    Selecione uma vaga no contexto (ex.: abrindo pelo Matching) para ver o score.
                                </div>
                            ) : matchLoading ? (
                                <div className="py-8 text-center">
                                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : match ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold">Score</div>
                                            <div className="text-muted-foreground text-sm">baseado em pesos e palavras-chave</div>
                                        </div>
                                        <div className="text-2xl font-bold" style={{ color: "rgb(var(--lt-primary))" }}>
                                            {normalizeScore(match.score)}%
                                        </div>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(100, normalizeScore(match.score))}%`,
                                                background: "rgb(var(--lt-primary))",
                                            }}
                                        />
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                        Match mínimo: <strong>{normalizeScore(match.threshold)}%</strong>
                                        {" · "}Encontrados: <strong>{match.hitsCount}</strong>
                                        {" · "}Obrig. faltando: <strong>{match.missCount}</strong>
                                    </div>
                                    {match.requirements.length > 0 && (
                                        <>
                                            <div className="font-semibold mt-2">Requisitos (detalhado)</div>
                                            <div className="space-y-1">
                                                {match.requirements.map((r, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                        <span className={`size-2 rounded-full ${r.found ? "bg-emerald-500" : "bg-red-500"}`} />
                                                        <span className={r.found ? "" : "text-red-600"}>
                                                            {r.keyword}
                                                            {r.mandatory && " (obrigatório)"}
                                                        </span>
                                                        <span className="text-muted-foreground text-xs ml-auto">
                                                            peso: {r.weight}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-muted-foreground text-sm py-4 text-center">Sem dados de match disponíveis.</div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="card-soft p-6 text-center text-muted-foreground">
                    Candidato não encontrado.
                </div>
            )}
        </section>
    );
}
