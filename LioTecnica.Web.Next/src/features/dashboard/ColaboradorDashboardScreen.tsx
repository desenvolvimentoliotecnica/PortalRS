"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    BadgeCheck,
    CalendarDays,
    ChevronRight,
    FolderOpen,
    Home,
    Key,
    Landmark,
    ScrollText,
    TrendingUp,
    UserCircle,
    Users,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/* ─────────────────────────────────────────────────────────────────────── */

interface PendingCounts {
    ferias: number;
    beneficios: number;
    dependentes: number;
    endereco: number;
}

type BadgeKey = keyof PendingCounts;

interface CardDef {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    badgeKey?: BadgeKey;
}

const CARDS: CardDef[] = [
    {
        title: "Dados Pessoais",
        description: "Visualize e atualize seus dados pessoais",
        href: "/colaborador/perfil",
        icon: UserCircle,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
    },
    {
        title: "Dependentes",
        description: "Gerencie seus dependentes e solicitações",
        href: "/colaborador/dependentes",
        icon: Users,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
        badgeKey: "dependentes",
    },
    {
        title: "Endereço",
        description: "Atualize seu endereço residencial",
        href: "/colaborador/endereco",
        icon: Home,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
        badgeKey: "endereco",
    },
    {
        title: "Dados Bancários",
        description: "Consulte e atualize sua conta bancária",
        href: "/colaborador/dados-bancarios",
        icon: Landmark,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
    },
    {
        title: "Férias",
        description: "Solicite e acompanhe suas férias",
        href: "/colaborador/ferias",
        icon: CalendarDays,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
        badgeKey: "ferias",
    },
    {
        title: "Benefícios",
        description: "Solicite e acompanhe seus benefícios",
        href: "/colaborador/beneficios",
        icon: BadgeCheck,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
        badgeKey: "beneficios",
    },
    {
        title: "Holerites",
        description: "Acesse seus holerites e contracheques",
        href: "/colaborador/holerites",
        icon: ScrollText,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
    },
    {
        title: "Documentos",
        description: "Gerencie seus documentos pessoais",
        href: "/colaborador/documentos",
        icon: FolderOpen,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
    },
    {
        title: "Histórico de Carreira",
        description: "Veja sua trajetória e movimentações na empresa",
        href: "/colaborador/historico-carreira",
        icon: TrendingUp,
        iconColor: "text-primary",
        iconBg: "bg-primary/8",
    },
    {
        title: "Alterar Senha",
        description: "Atualize sua senha de acesso",
        href: "/colaborador/senha",
        icon: Key,
        iconColor: "text-muted-foreground",
        iconBg: "bg-muted",
    },
];

async function fetchCount(url: string): Promise<number> {
    try {
        const res = await apiFetch(url);
        if (!res.ok) return 0;
        const data: unknown = await res.json();
        if (Array.isArray(data)) return data.length;
        if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items: unknown[] }).items)) {
            return (data as { items: unknown[] }).items.length;
        }
        return 0;
    } catch {
        return 0;
    }
}

/* ─────────────────────────────────────────────────────────────────────── */

export default function ColaboradorDashboardScreen({ showHeader = true }: { showHeader?: boolean }) {
    const { me } = useAuth();
    const firstName = me?.displayName?.split(" ")[0] ?? "Colaborador";

    const [counts, setCounts] = useState<PendingCounts>({ ferias: 0, beneficios: 0, dependentes: 0, endereco: 0 });

    useEffect(() => {
        void Promise.allSettled([
            fetchCount("/api/colaborador/solicitacoes-ferias?status=1"),
            fetchCount("/api/colaborador/solicitacoes-beneficio?status=1"),
            fetchCount("/api/colaborador/solicitacoes-dependente?status=1"),
            fetchCount("/api/colaborador/solicitacoes-endereco?status=1"),
        ]).then(([ferias, beneficios, dependentes, endereco]) => {
            setCounts({
                ferias:      ferias.status      === "fulfilled" ? ferias.value      : 0,
                beneficios:  beneficios.status  === "fulfilled" ? beneficios.value  : 0,
                dependentes: dependentes.status === "fulfilled" ? dependentes.value : 0,
                endereco:    endereco.status    === "fulfilled" ? endereco.value    : 0,
            });
        });
    }, []);

    return (
        <section className="space-y-6">
            {/* Header */}
            {showHeader ? (
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Selecione uma área para acessar seus dados e solicitações
                    </p>
                </div>
            ) : (
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Meu Espaço</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Acesse seus dados pessoais e solicitações
                    </p>
                </div>
            )}

            {/* Card grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {CARDS.map((card) => {
                    const Icon = card.icon;
                    const pending = card.badgeKey ? counts[card.badgeKey] : 0;
                    return (
                        <Link
                            key={card.href}
                            href={card.href}
                            className="group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm
                                       transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                        >
                            <div className={`inline-flex size-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                                <Icon className={`size-5 ${card.iconColor}`} aria-hidden />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">{card.title}</span>
                                    {pending > 0 && (
                                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full
                                                         bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                                            {pending > 99 ? "99+" : pending}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{card.description}</p>
                            </div>

                            <ChevronRight
                                className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40
                                           transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground/70"
                                aria-hidden
                            />
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
