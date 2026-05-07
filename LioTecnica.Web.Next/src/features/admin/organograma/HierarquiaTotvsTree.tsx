"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, ChevronRight, ChevronDown, Network, Loader2, Users } from "lucide-react";

/**
 * Componente que renderiza o organograma TOTVS RM (VHIERARQUIA) como árvore navegável.
 * Consome GET /api/hierarquias/tree e exibe nodes hierárquicos com expansão e colaboradores por nó.
 *
 * Diferente do OrganogramaCanvas (React Flow / Datasul), aqui é simples e textual —
 * focado nos dados sincronizados pelo worker Liotecnica.Integration.RM.
 */

const FUNCIONARIOS_PREVIEW_CAP = 15;

interface HierarquiaTreeFuncionarioSummary {
    id: string;
    nome: string;
    matriculaRm?: string | null;
    cargoOuFuncao?: string | null;
}

interface HierarquiaTreeNode {
    id: string;
    idHierarquiaRm: number;
    descricao: string;
    estrutura?: string | null;
    idNivelHierarquiaRm?: number | null;
    isActive: boolean;
    funcionarios?: HierarquiaTreeFuncionarioSummary[];
    children: HierarquiaTreeNode[];
}

function funcionarioMatchesTerm(f: HierarquiaTreeFuncionarioSummary, term: string): boolean {
    if (!term) return true;
    const t = term.toLowerCase();
    if (f.nome.toLowerCase().includes(t)) return true;
    if (f.matriculaRm?.toLowerCase().includes(t)) return true;
    if (f.cargoOuFuncao?.toLowerCase().includes(t)) return true;
    return false;
}

const NIVEL_COLORS: Record<number, string> = {
    1: "bg-violet-100 text-violet-900 border-violet-300",
    2: "bg-blue-100 text-blue-900 border-blue-300",
    3: "bg-cyan-100 text-cyan-900 border-cyan-300",
    4: "bg-emerald-100 text-emerald-900 border-emerald-300",
    5: "bg-amber-100 text-amber-900 border-amber-300",
    6: "bg-orange-100 text-orange-900 border-orange-300",
    7: "bg-rose-100 text-rose-900 border-rose-300",
};

function colorForLevel(level: number | undefined | null): string {
    if (!level) return "bg-slate-100 text-slate-900 border-slate-300";
    return NIVEL_COLORS[level] ?? "bg-slate-100 text-slate-900 border-slate-300";
}

function HierarquiaTreeNodeRow({
    node,
    expandedIds,
    onToggle,
    depth,
    searchNorm,
}: {
    node: HierarquiaTreeNode;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    depth: number;
    searchNorm: string;
}) {
    const [showAllEmployees, setShowAllEmployees] = useState(false);
    const isExpanded = expandedIds.has(node.id);
    const funcRaw = node.funcionarios ?? [];
    const funcFiltered = searchNorm
        ? funcRaw.filter((f) => funcionarioMatchesTerm(f, searchNorm))
        : funcRaw;
    const funcCountTotal = funcRaw.length;
    const needsCap = funcFiltered.length > FUNCIONARIOS_PREVIEW_CAP;
    const funcDisplayed =
        showAllEmployees || !needsCap ? funcFiltered : funcFiltered.slice(0, FUNCIONARIOS_PREVIEW_CAP);

    const hasChildren = node.children.length > 0;
    const hasFuncionarios = funcFiltered.length > 0;
    const hasExpandableContent = hasChildren || hasFuncionarios;
    const colorCls = colorForLevel(node.idNivelHierarquiaRm ?? depth + 1);

    return (
        <>
            <div
                aria-expanded={hasExpandableContent ? isExpanded : undefined}
                className={`flex items-center gap-2 py-1.5 rounded transition-colors ${hasExpandableContent ? "hover:bg-slate-50 cursor-pointer" : ""}`}
                style={{ paddingLeft: `${depth * 24}px` }}
                onClick={() => hasExpandableContent && onToggle(node.id)}
            >
                <span className="w-5 h-5 flex items-center justify-center text-slate-400 shrink-0">
                    {hasExpandableContent ? (
                        isExpanded ? (
                            <ChevronDown className="size-4" />
                        ) : (
                            <ChevronRight className="size-4" />
                        )
                    ) : (
                        <span className="size-1.5 rounded-full bg-slate-300" />
                    )}
                </span>
                <span
                    className={`px-2 py-0.5 text-xs font-medium rounded border ${colorCls} shrink-0`}
                    title={`Hierarquia ID ${node.idHierarquiaRm} (TOTVS RM)`}
                >
                    {node.idHierarquiaRm}
                </span>
                <span className="font-medium text-sm text-slate-800 truncate">{node.descricao}</span>
                {funcCountTotal > 0 && (
                    <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 flex items-center gap-0.5"
                        title="Colaboradores vinculados a este nó (HierarquiaId)"
                    >
                        <Users className="size-3 opacity-70" />
                        {funcCountTotal}
                    </span>
                )}
                {node.estrutura && (
                    <span className="text-xs text-slate-400 ml-auto font-mono truncate max-w-[40%]">
                        {node.estrutura}
                    </span>
                )}
            </div>

            {isExpanded && hasFuncionarios && (
                <div
                    className="border-l border-slate-200 py-1 space-y-0.5 pl-3"
                    style={{ marginLeft: `${12 + depth * 24}px` }}
                >
                    <div
                        className={
                            needsCap && showAllEmployees
                                ? "max-h-64 overflow-y-auto pr-1 space-y-0.5"
                                : "space-y-0.5"
                        }
                    >
                        {funcDisplayed.map((f) => (
                            <div
                                key={f.id}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-sm py-0.5 px-1 rounded hover:bg-slate-50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Link
                                    href={`/funcionarios/perfil?id=${f.id}`}
                                    className="font-medium text-blue-700 hover:underline"
                                >
                                    {f.nome}
                                </Link>
                                {f.matriculaRm && (
                                    <span className="text-xs text-slate-500 font-mono">Chapa {f.matriculaRm}</span>
                                )}
                                {f.cargoOuFuncao && (
                                    <span className="text-xs text-slate-500 truncate max-w-full">{f.cargoOuFuncao}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    {needsCap && (
                        <button
                            type="button"
                            className="text-xs text-blue-600 hover:underline mt-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAllEmployees((v) => !v);
                            }}
                        >
                            {showAllEmployees
                                ? "Mostrar menos"
                                : `Mostrar mais (${funcFiltered.length - FUNCIONARIOS_PREVIEW_CAP} restantes)`}
                        </button>
                    )}
                </div>
            )}

            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <HierarquiaTreeNodeRow
                            key={child.id}
                            node={child}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            depth={depth + 1}
                            searchNorm={searchNorm}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

export default function HierarquiaTotvsTree() {
    const [tree, setTree] = useState<HierarquiaTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [includeInactiveFuncionarios, setIncludeInactiveFuncionarios] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const qs = includeInactiveFuncionarios ? "?includeInactiveFuncionarios=true" : "";
            const res = await apiFetch(`/api/hierarquias/tree${qs}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: HierarquiaTreeNode[] = await res.json();
            setTree(data);
            setExpandedIds(new Set(data.map((n) => n.id)));
        } catch (err) {
            console.error("Erro hierarquias:", err);
            toast.error("Erro ao carregar hierarquia TOTVS.");
            setTree([]);
        } finally {
            setLoading(false);
        }
    }, [includeInactiveFuncionarios]);

    useEffect(() => {
        load();
    }, [load]);

    const searchNorm = useMemo(() => search.trim().toLowerCase(), [search]);

    const handleToggle = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        const allIds = new Set<string>();
        const collect = (nodes: HierarquiaTreeNode[]) => {
            nodes.forEach((n) => {
                const hasKids = n.children.length > 0;
                const hasFuncs = (n.funcionarios?.length ?? 0) > 0;
                if (hasKids || hasFuncs) allIds.add(n.id);
                collect(n.children);
            });
        };
        collect(tree);
        setExpandedIds(allIds);
    }, [tree]);

    const collapseAll = useCallback(() => {
        setExpandedIds(new Set());
    }, []);

    const filteredTree = useMemo(() => {
        if (!searchNorm) return tree;
        const matches = (node: HierarquiaTreeNode): boolean => {
            if (node.descricao.toLowerCase().includes(searchNorm)) return true;
            if ((node.funcionarios ?? []).some((f) => funcionarioMatchesTerm(f, searchNorm))) return true;
            return node.children.some(matches);
        };
        const filter = (nodes: HierarquiaTreeNode[]): HierarquiaTreeNode[] => {
            return nodes
                .filter(matches)
                .map((n) => ({ ...n, children: filter(n.children) }));
        };
        return filter(tree);
    }, [tree, searchNorm]);

    useEffect(() => {
        if (!searchNorm) return;
        const ids = new Set<string>();
        const collect = (nodes: HierarquiaTreeNode[]) => {
            nodes.forEach((n) => {
                const hasKids = n.children.length > 0;
                const hasFuncs = (n.funcionarios?.length ?? 0) > 0;
                if (hasKids || hasFuncs) ids.add(n.id);
                collect(n.children);
            });
        };
        collect(filteredTree);
        setExpandedIds(ids);
    }, [searchNorm, filteredTree]);

    const totalNodes = useMemo(() => {
        let count = 0;
        const walk = (ns: HierarquiaTreeNode[]) => {
            ns.forEach((n) => {
                count++;
                walk(n.children);
            });
        };
        walk(tree);
        return count;
    }, [tree]);

    const totalColaboradores = useMemo(() => {
        let count = 0;
        const walk = (ns: HierarquiaTreeNode[]) => {
            ns.forEach((n) => {
                count += n.funcionarios?.length ?? 0;
                walk(n.children);
            });
        };
        walk(tree);
        return count;
    }, [tree]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="size-6 animate-spin text-slate-400" />
                <p className="text-sm text-slate-500">Carregando hierarquia TOTVS...</p>
            </div>
        );
    }

    if (tree.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                <Network className="size-8 text-slate-300" />
                <p className="text-sm">Nenhuma hierarquia sincronizada ainda.</p>
                <p className="text-xs">
                    Verifique se o worker <code className="font-mono">Liotecnica.Integration.RM</code> está rodando.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-slate-200">
                <input
                    type="text"
                    placeholder="Buscar hierarquia ou colaborador..."
                    className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={includeInactiveFuncionarios}
                        onChange={(e) => setIncludeInactiveFuncionarios(e.target.checked)}
                        className="rounded border-slate-300"
                    />
                    Inativos no organograma
                </label>
                <button
                    type="button"
                    onClick={expandAll}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
                    title="Expandir tudo"
                >
                    Expandir tudo
                </button>
                <button
                    type="button"
                    onClick={collapseAll}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
                    title="Recolher tudo"
                >
                    Recolher
                </button>
                <button
                    type="button"
                    onClick={() => load()}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
                    title="Recarregar"
                >
                    <RefreshCw className="size-3" />
                    Atualizar
                </button>
                <span className="text-xs text-slate-500 ml-auto whitespace-nowrap">
                    {totalNodes} hierarquias · {totalColaboradores} colaboradores neste grafo
                </span>
            </div>

            <div className="px-3 pb-3 max-h-[calc(100dvh-280px)] overflow-y-auto">
                {filteredTree.map((root) => (
                    <HierarquiaTreeNodeRow
                        key={root.id}
                        node={root}
                        expandedIds={expandedIds}
                        onToggle={handleToggle}
                        depth={0}
                        searchNorm={searchNorm}
                    />
                ))}
                {filteredTree.length === 0 && search.trim() && (
                    <div className="text-center py-6 text-slate-400 text-sm">
                        Nenhuma hierarquia encontrada para &quot;{search}&quot;
                    </div>
                )}
            </div>
        </div>
    );
}
