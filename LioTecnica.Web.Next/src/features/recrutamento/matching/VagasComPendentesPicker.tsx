"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Briefcase, Loader2, MapPin, Users } from "lucide-react";
import { apiJson } from "@/lib/api";

/**
 * Picker mostrado na tela de Matching IA quando não há `vagaId` na URL.
 * Lista as vagas do tenant que têm candidatos SEM último score de match
 * (LastMatchAtUtc == null) — para que o RH escolha qual vaga trabalhar.
 *
 * <para>Entry point típico: card "N candidatos pendentes de matching" do dashboard
 * → link /matching → sem vagaId → renderiza este picker.</para>
 */
interface VagaComPendentesMatch {
    id: string;
    codigo: string | null;
    titulo: string;
    status: string;
    senioridade: string | null;
    cidade: string | null;
    uf: string | null;
    countPendentes: number;
}

export function VagasComPendentesPicker({ onPick }: { onPick: (vagaId: string) => void }) {
    const [vagas, setVagas] = useState<VagaComPendentesMatch[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await apiJson<VagaComPendentesMatch[]>("/api/dashboard/vagas-com-pendentes-match");
                if (!cancelled) setVagas(res);
            } catch (err) {
                if (!cancelled) setError((err as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="rounded-xl border border-border/40 bg-card p-6 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Procurando vagas com candidatos pendentes…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm">
                <strong className="text-red-700 dark:text-red-400">Falha ao carregar vagas:</strong> {error}
            </div>
        );
    }

    const totalPendentes = (vagas || []).reduce((s, v) => s + v.countPendentes, 0);

    if (!vagas || vagas.length === 0) {
        return (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-500/15 p-2">
                        <Briefcase className="size-5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-emerald-900 dark:text-emerald-300">Tudo em dia!</h3>
                        <p className="text-sm text-emerald-800/80 dark:text-emerald-400/80 mt-1">
                            Nenhuma vaga tem candidatos pendentes de matching. Acesse o{" "}
                            <Link href="/vagas" className="underline hover:text-emerald-950">painel de vagas</Link>{" "}
                            para selecionar uma manualmente.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Banner explicativo */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertCircle className="size-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                        {totalPendentes} candidato(s) pendentes em {vagas.length} vaga(s)
                    </h3>
                    <p className="text-sm text-amber-800/80 dark:text-amber-400/80">
                        Selecione a vaga que deseja trabalhar. O matching será calculado quando você abrir a vaga.
                    </p>
                </div>
            </div>

            {/* Lista de vagas clicável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vagas.map((v) => (
                    <button
                        key={v.id}
                        type="button"
                        onClick={() => onPick(v.id)}
                        className="text-left rounded-xl border border-border/40 bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                                    {v.codigo || v.id.slice(0, 8)}
                                </p>
                                <h4 className="font-semibold text-sm mt-0.5 group-hover:text-primary transition-colors line-clamp-2">
                                    {v.titulo}
                                </h4>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-bold shrink-0">
                                {v.countPendentes}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <span className={`size-1.5 rounded-full ${v.status === "Aberta" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                                {v.status}
                            </span>
                            {v.senioridade && (
                                <span className="inline-flex items-center gap-1">
                                    <Users className="size-3" />
                                    {v.senioridade}
                                </span>
                            )}
                            {v.cidade && (
                                <span className="inline-flex items-center gap-1">
                                    <MapPin className="size-3" />
                                    {v.cidade}{v.uf ? `/${v.uf}` : ""}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-end mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Abrir matching <ArrowRight className="size-3 ml-1" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
