"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, ChevronRight, ChevronDown, Network, Loader2 } from "lucide-react";

/**
 * Componente que renderiza o organograma TOTVS RM (VHIERARQUIA) como árvore navegável.
 * Consome GET /api/hierarquias/tree e exibe nodes hierárquicos com expansão.
 *
 * Diferente do OrganogramaCanvas (React Flow / Datasul), aqui é simples e textual —
 * focado nos dados sincronizados pelo worker Liotecnica.Integration.RM.
 */

interface HierarquiaTreeNode {
    id: string;
    idHierarquiaRm: number;
    descricao: string;
    estrutura?: string | null;
    idNivelHierarquiaRm?: number | null;
    isActive: boolean;
    children: HierarquiaTreeNode[];
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
}: {
    node: HierarquiaTreeNode;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    depth: number;
}) {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const colorCls = colorForLevel(node.idNivelHierarquiaRm ?? depth + 1);

    return (
        <>
            <div
                className="flex items-center gap-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded transition-colors"
                style={{ paddingLeft: `${depth * 24}px` }}
                onClick={() => hasChildren && onToggle(node.id)}
            >
                <span className="w-5 h-5 flex items-center justify-center text-slate-400 shrink-0">
                    {hasChildren ? (
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
                {node.estrutura && (
                    <span className="text-xs text-slate-400 ml-auto font-mono">{node.estrutura}</span>
                )}
            </div>
            {isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <HierarquiaTreeNodeRow
                            key={child.id}
                            node={child}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            depth={depth + 1}
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

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/hierarquias/tree", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: HierarquiaTreeNode[] = await res.json();
            setTree(data);
            // Expandir as raízes por default
            setExpandedIds(new Set(data.map((n) => n.id)));
        } catch (err) {
            console.error("Erro hierarquias:", err);
            toast.error("Erro ao carregar hierarquia TOTVS.");
            setTree([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

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
                allIds.add(n.id);
                collect(n.children);
            });
        };
        collect(tree);
        setExpandedIds(allIds);
    }, [tree]);

    const collapseAll = useCallback(() => {
        setExpandedIds(new Set());
    }, []);

    // Busca: expandir caminhos onde algum nó bate
    const filteredTree = useMemo(() => {
        if (!search.trim()) return tree;
        const term = search.toLowerCase().trim();
        const matches = (node: HierarquiaTreeNode): boolean => {
            if (node.descricao.toLowerCase().includes(term)) return true;
            return node.children.some(matches);
        };
        const filter = (nodes: HierarquiaTreeNode[]): HierarquiaTreeNode[] => {
            return nodes
                .filter(matches)
                .map((n) => ({ ...n, children: filter(n.children) }));
        };
        return filter(tree);
    }, [tree, search]);

    // Auto-expandir resultados de busca
    useEffect(() => {
        if (!search.trim()) return;
        const ids = new Set<string>();
        const collect = (nodes: HierarquiaTreeNode[]) => {
            nodes.forEach((n) => {
                ids.add(n.id);
                collect(n.children);
            });
        };
        collect(filteredTree);
        setExpandedIds(ids);
    }, [search, filteredTree]);

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
                <p className="text-xs">Verifique se o worker <code className="font-mono">Liotecnica.Integration.RM</code> está rodando.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200">
                <input
                    type="text"
                    placeholder="Buscar hierarquia..."
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    onClick={expandAll}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
                    title="Expandir tudo"
                >
                    Expandir tudo
                </button>
                <button
                    onClick={collapseAll}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
                    title="Recolher tudo"
                >
                    Recolher
                </button>
                <button
                    onClick={load}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
                    title="Recarregar"
                >
                    <RefreshCw className="size-3" />
                    Atualizar
                </button>
                <span className="text-xs text-slate-500 ml-auto">
                    {totalNodes} hierarquias
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
