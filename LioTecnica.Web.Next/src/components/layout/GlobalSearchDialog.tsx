"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Briefcase,
    Users,
    UserCircle,
    BadgeCheck,
    MapPin,
    Search,
    Loader2,
    ArrowRight,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

/* ── Types ── */

interface SearchResult {
    id: string;
    label: string;
    sublabel?: string;
    category: Category;
    href: string;
}

type Category = "vagas" | "candidatos" | "pessoas" | "funcionarios" | "areas";

interface CategoryMeta {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

const CATEGORIES: Record<Category, CategoryMeta> = {
    vagas: { label: "Quadro de Vagas", icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
    candidatos: { label: "Candidatos", icon: Users, color: "text-violet-600", bg: "bg-violet-100" },
    pessoas: { label: "Pessoas", icon: UserCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    funcionarios: { label: "Funcionários", icon: BadgeCheck, color: "text-amber-600", bg: "bg-amber-100" },
    areas: { label: "Áreas", icon: MapPin, color: "text-rose-600", bg: "bg-rose-100" },
};

const CATEGORY_ORDER: Category[] = ["vagas", "candidatos", "pessoas", "funcionarios", "areas"];

/* ── Helpers ── */

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) return [] as unknown as T;
    return res.json();
}

function extractItems(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) return data;
    const rec = data as Record<string, unknown> | null;
    if (rec && Array.isArray(rec.items)) return rec.items;
    if (rec && Array.isArray(rec.data)) return rec.data;
    return [];
}

function str(v: unknown): string {
    return typeof v === "string" ? v : "";
}

/* ── Search providers ── */

async function searchVagas(q: string): Promise<SearchResult[]> {
    const data = await fetchJson<unknown>(`/Vagas/_api/vagas`);
    const items = extractItems(data);
    const lower = q.toLowerCase();
    return items
        .filter((v) => {
            const title = str(v.title ?? v.titulo ?? v.nome);
            const code = str(v.code ?? v.codigo);
            return title.toLowerCase().includes(lower) || code.toLowerCase().includes(lower);
        })
        .slice(0, 5)
        .map((v) => ({
            id: str(v.id),
            label: str(v.title ?? v.titulo ?? v.nome) || "Vaga sem título",
            sublabel: str(v.status) || str(v.code ?? v.codigo) || undefined,
            category: "vagas" as const,
            href: "/vagas",
        }));
}

async function searchCandidatos(q: string): Promise<SearchResult[]> {
    const data = await fetchJson<unknown>(`/Candidatos/_api/candidatos?q=${encodeURIComponent(q)}&pageSize=5`);
    const items = extractItems(data);
    return items.slice(0, 5).map((c) => ({
        id: str(c.id),
        label: str(c.fullName ?? c.nome ?? c.name) || "Candidato",
        sublabel: str(c.email) || undefined,
        category: "candidatos" as const,
        href: "/candidatos",
    }));
}

async function searchPessoas(q: string): Promise<SearchResult[]> {
    const data = await fetchJson<unknown>(`/api/pessoas?q=${encodeURIComponent(q)}&pageSize=5`);
    const items = extractItems(data);
    return items.slice(0, 5).map((p) => ({
        id: str(p.id),
        label: str(p.fullName ?? p.name ?? p.nome) || "Pessoa",
        sublabel: str(p.email) || str(p.cpf) || undefined,
        category: "pessoas" as const,
        href: "/app/cadastros/pessoas",
    }));
}

async function searchFuncionarios(q: string): Promise<SearchResult[]> {
    const data = await fetchJson<unknown>(`/api/funcionarios`);
    const items = extractItems(data);
    const lower = q.toLowerCase();
    return items
        .filter((f) => {
            const name = str(f.fullName ?? f.name ?? f.nome);
            const mat = str(f.matricula ?? f.registration);
            return name.toLowerCase().includes(lower) || mat.toLowerCase().includes(lower);
        })
        .slice(0, 5)
        .map((f) => ({
            id: str(f.id),
            label: str(f.fullName ?? f.name ?? f.nome) || "Funcionário",
            sublabel: str(f.cargo ?? f.position ?? f.department) || undefined,
            category: "funcionarios" as const,
            href: "/app/cadastros/funcionarios",
        }));
}

async function searchAreas(q: string): Promise<SearchResult[]> {
    const data = await fetchJson<unknown>(`/api/areas`);
    const items = extractItems(data);
    const lower = q.toLowerCase();
    return items
        .filter((a) => {
            const name = str(a.name ?? a.nome ?? a.description);
            return name.toLowerCase().includes(lower);
        })
        .slice(0, 5)
        .map((a) => ({
            id: str(a.id),
            label: str(a.name ?? a.nome) || "Área",
            sublabel: str(a.description ?? a.descricao) || undefined,
            category: "areas" as const,
            href: "/app/cadastros/areas",
        }));
}

/* ── Component ── */

export default function GlobalSearchDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Debounced search
    useEffect(() => {
        if (!query.trim() || query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const settled = await Promise.allSettled([
                    searchVagas(query),
                    searchCandidatos(query),
                    searchPessoas(query),
                    searchFuncionarios(query),
                    searchAreas(query),
                ]);

                const all: SearchResult[] = [];
                for (const r of settled) {
                    if (r.status === "fulfilled") all.push(...r.value);
                }
                setResults(all);
                setActiveIndex(0);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const navigate = useCallback(
        (result: SearchResult) => {
            onOpenChange(false);
            router.push(result.href);
        },
        [onOpenChange, router],
    );

    // Keyboard navigation
    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[activeIndex]) {
            e.preventDefault();
            navigate(results[activeIndex]);
        }
    }

    // Scroll active item into view
    useEffect(() => {
        const container = listRef.current;
        if (!container) return;
        const active = container.querySelector(`[data-index="${activeIndex}"]`);
        active?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    // Group results by category
    const grouped = CATEGORY_ORDER.map((cat) => ({
        category: cat,
        meta: CATEGORIES[cat],
        items: results.filter((r) => r.category === cat),
    })).filter((g) => g.items.length > 0);

    let globalIdx = -1;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="!p-0 gap-0 overflow-hidden sm:max-w-xl rounded-xl border border-border/60 shadow-2xl bg-background/95 backdrop-blur-xl"
            >
                <DialogTitle className="sr-only">Busca global</DialogTitle>

                {/* ── Search input ── */}
                <div className="flex items-center gap-3 border-b px-4 py-3">
                    <Search className="size-5 text-muted-foreground/70 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Buscar vagas, candidatos, pessoas, funcionários, áreas..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {loading && <Loader2 className="size-4 animate-spin text-muted-foreground/60 shrink-0" />}
                    <kbd className="hidden sm:inline-flex items-center rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                        ESC
                    </kbd>
                </div>

                {/* ── Results ── */}
                <div
                    ref={listRef}
                    className="max-h-[60vh] min-h-[120px] overflow-y-auto scroll-smooth"
                >
                    {!query.trim() || query.trim().length < 2 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                            <Search className="size-8 mb-2 opacity-40" />
                            <p className="text-sm">Digite pelo menos 2 caracteres para buscar</p>
                            <p className="text-xs mt-1 text-muted-foreground/40">
                                Pesquise em vagas, candidatos, pessoas, funcionários e áreas
                            </p>
                        </div>
                    ) : loading && results.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground/60">
                            <Loader2 className="size-5 mr-2 animate-spin" />
                            <span className="text-sm">Buscando...</span>
                        </div>
                    ) : !loading && results.length === 0 && query.trim().length >= 2 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
                            <p className="text-sm">Nenhum resultado para &ldquo;{query}&rdquo;</p>
                            <p className="text-xs mt-1 text-muted-foreground/40">
                                Tente outros termos de busca
                            </p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {grouped.map((group) => {
                                const Icon = group.meta.icon;
                                return (
                                    <div key={group.category}>
                                        {/* Category header */}
                                        <div className="flex items-center gap-2 px-4 py-1.5">
                                            <div className={`flex items-center justify-center size-5 rounded ${group.meta.bg}`}>
                                                <Icon className={`size-3 ${group.meta.color}`} />
                                            </div>
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                                {group.meta.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/40">
                                                {group.items.length}
                                            </span>
                                        </div>

                                        {/* Items */}
                                        {group.items.map((item) => {
                                            globalIdx++;
                                            const idx = globalIdx;
                                            const isActive = idx === activeIndex;
                                            return (
                                                <button
                                                    key={`${item.category}-${item.id}`}
                                                    data-index={idx}
                                                    onClick={() => navigate(item)}
                                                    onMouseEnter={() => setActiveIndex(idx)}
                                                    className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100
                            ${isActive
                                                            ? "bg-primary/8 text-foreground"
                                                            : "text-foreground/80 hover:bg-muted/50"
                                                        }
                          `}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">{item.label}</div>
                                                        {item.sublabel && (
                                                            <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                                                {item.sublabel}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isActive && (
                                                        <ArrowRight className="size-3.5 text-primary/60 shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground/50">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-border/40 bg-muted/40 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
                            navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-border/40 bg-muted/40 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
                            abrir
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-border/40 bg-muted/40 px-1 py-0.5 font-mono text-[10px]">esc</kbd>
                            fechar
                        </span>
                    </div>
                    <span>Busca global</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
