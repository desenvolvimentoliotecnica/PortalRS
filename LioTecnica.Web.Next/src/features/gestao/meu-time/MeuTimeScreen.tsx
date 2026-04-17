"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Cake, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
    if (url) return <img src={url} alt={nome} className="size-10 rounded-full object-cover" />;
    return (
        <div className="size-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-semibold">
            {nome.charAt(0).toUpperCase()}
        </div>
    );
}

export default function MeuTimeScreen() {
    const [time, setTime] = useState<Subordinado[]>([]);
    const [headcount, setHeadcount] = useState<Headcount | null>(null);
    const [aniversarios, setAniversarios] = useState<Aniversario[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            apiFetch("/api/gestao/meu-time").then((r) => r.json() as Promise<Subordinado[]>),
            apiFetch("/api/gestao/headcount-area").then((r) => r.json() as Promise<Headcount>),
            apiFetch("/api/gestao/aniversarios?dias=30").then((r) => r.json() as Promise<Aniversario[]>),
        ])
            .then(([t, h, a]) => {
                setTime(Array.isArray(t) ? t : []);
                setHeadcount(h ?? null);
                setAniversarios(Array.isArray(a) ? a : []);
            })
            .catch(() => toast.error("Erro ao carregar dados do time."))
            .finally(() => setLoading(false));
    }, []);

    const emExperiencia = time.filter((f) => f.emExperiencia);

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
                <p className="text-muted-foreground text-sm">Visão geral dos seus subordinados diretos</p>
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

            {/* ── Time Completo ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="size-4 text-violet-600" />
                        Time Completo ({time.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {time.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-6">
                            Nenhum subordinado direto encontrado.
                        </p>
                    ) : (
                        <div className="divide-y">
                            {time.map((f) => (
                                <div key={f.id} className="flex items-center gap-3 py-3">
                                    <Avatar nome={f.nome} url={f.avatarUrl} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{f.nome}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {[f.cargo, f.area].filter(Boolean).join(" · ")}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {f.emExperiencia && (
                                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                                Experiência
                                            </Badge>
                                        )}
                                        {f.diasParaAniversario != null && f.diasParaAniversario <= 7 && (
                                            <Badge variant="outline" className="text-xs text-pink-600 border-pink-300">
                                                🎂 {f.diasParaAniversario === 0 ? "Hoje" : `${f.diasParaAniversario}d`}
                                            </Badge>
                                        )}
                                        <Link
                                            href={`/funcionarios/${f.id}/perfil`}
                                            className="text-xs text-violet-600 hover:underline flex items-center gap-0.5"
                                        >
                                            Ver perfil <ArrowRight className="size-3" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
