"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    useReactFlow,
    Controls,
    Background,
    MiniMap,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeTypes,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, Building2, Users, ChevronRight, ChevronLeft, ChevronDown, Star, UserX, Search, X, TrendingUp, UserMinus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Tooltip } from "radix-ui";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface FuncionarioDto {
    id: string;
    nome: string;
    cargo: string | null;
    nivelHierarquicoNome: string | null;
    nivelHierarquicoOrdem: number | null;
}

interface LotacaoDto {
    id: string;
    codigo: string;
    descricao: string;
    level: number;
    parentId: string | null;
    responsavel: FuncionarioDto | null;
    funcionarios: FuncionarioDto[];
    headcountAutorizado: number;
    headcountOcupado: number;
    headcountProvisorio: number;
}

interface EstruturaResponse {
    lotacoes: LotacaoDto[];
    semLotacao: FuncionarioDto[];
}

// ──────────────────────────────────────────────
// Color helpers
// ──────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
    1: "#6d28d9",
    2: "#1d4ed8",
    3: "#0891b2",
    4: "#059669",
    5: "#d97706",
};

const NIVEL_COLORS: Record<number, string> = {
    0: "#7c3aed",
    1: "#1d4ed8",
    2: "#2563eb",
    3: "#0891b2",
    4: "#059669",
    5: "#d97706",
};

function getLevelColor(level: number): string {
    return LEVEL_COLORS[level] ?? "#6b7280";
}

function getNivelColor(ordem: number | null): string {
    if (ordem === null) return "#6b7280";
    return NIVEL_COLORS[ordem] ?? "#6b7280";
}

function getInitials(nome: string): string {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

// ──────────────────────────────────────────────
// Node dimensions
// ──────────────────────────────────────────────

const LOT_W = 270;
const LOT_H = 110;
const FUNC_W = 210;
const FUNC_H = 88;

// ──────────────────────────────────────────────
// Dagre layout (handles mixed node sizes)
// ──────────────────────────────────────────────

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", ranksep: 70, nodesep: 24 });

    nodes.forEach((n) => {
        const isLotacao = n.type === "lotacaoNode";
        g.setNode(n.id, {
            width: isLotacao ? LOT_W : FUNC_W,
            height: isLotacao ? LOT_H : FUNC_H,
        });
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return nodes.map((n) => {
        const pos = g.node(n.id);
        const w = n.type === "lotacaoNode" ? LOT_W : FUNC_W;
        const h = n.type === "lotacaoNode" ? LOT_H : FUNC_H;
        return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
    });
}

// ──────────────────────────────────────────────
// Lotação node
// ──────────────────────────────────────────────

interface LotacaoNodeData {
    id: string;
    codigo: string;
    descricao: string;
    level: number;
    responsavel: FuncionarioDto | null;
    totalFuncionarios: number;
    expanded: boolean;
    onToggle: () => void;
    headcountAutorizado: number;
    headcountOcupado: number;
    headcountProvisorio: number;
}

function LotacaoNodeCard({ data }: { data: LotacaoNodeData }) {
    const color = getLevelColor(data.level);
    const hasEmployees = data.totalFuncionarios > 0;

    return (
        <div
            className="rounded-xl shadow-md border border-gray-200 bg-white overflow-hidden select-none"
            style={{ width: LOT_W, minHeight: LOT_H, pointerEvents: "all" }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0, border: 0, minWidth: 0, minHeight: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0, border: 0, minWidth: 0, minHeight: 0 }} />

            {/* Top stripe */}
            <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

            <div className="px-3 py-2.5 flex flex-col gap-1">
                {/* Header: code + description + expand button */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={13} style={{ color, flexShrink: 0 }} />
                        <OrgTooltip content={data.codigo}>
                            <span className="text-[11px] font-bold truncate" style={{ color }}>
                                {data.codigo}
                            </span>
                        </OrgTooltip>
                        <OrgTooltip content={data.descricao}>
                            <span className="text-xs font-semibold text-gray-800 truncate">
                                {data.descricao}
                            </span>
                        </OrgTooltip>
                    </div>

                    {hasEmployees && (
                        <button
                            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); data.onToggle(); }}
                            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer"
                            style={{
                                color,
                                borderColor: color,
                                backgroundColor: data.expanded ? color + "15" : "transparent",
                            }}
                        >
                            <Users size={9} />
                            {data.totalFuncionarios}
                            {data.expanded
                                ? <ChevronDown size={9} />
                                : <ChevronRight size={9} />}
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Headcount */}
                {data.headcountAutorizado > 0 && (() => {
                    const ratio = data.headcountOcupado / data.headcountAutorizado;
                    const hcColor = ratio > 1 ? "#dc2626" : ratio >= 0.9 ? "#d97706" : "#059669";
                    return (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: hcColor }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: hcColor }}>
                                    {data.headcountOcupado}/{data.headcountAutorizado}
                                </span>
                            </div>
                            {data.headcountProvisorio > 0 && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                                    +{data.headcountProvisorio} prov.
                                </span>
                            )}
                        </div>
                    );
                })()}

                {/* Responsável */}
                {data.responsavel ? (
                    <div className="flex items-center gap-2">
                        <div
                            className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-[11px] font-bold"
                            style={{ width: 32, height: 32, backgroundColor: color }}
                        >
                            {getInitials(data.responsavel.nome)}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1">
                                <OrgTooltip content={data.responsavel.nome}>
                                    <p className="text-[11px] font-semibold text-gray-900 truncate">
                                        {data.responsavel.nome}
                                    </p>
                                </OrgTooltip>
                                <Star size={10} className="flex-shrink-0 text-blue-500" />
                            </div>
                            {data.responsavel.cargo && (
                                <OrgTooltip content={data.responsavel.cargo}>
                                    <p className="text-[10px] text-gray-500 truncate">{data.responsavel.cargo}</p>
                                </OrgTooltip>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-[10px] text-gray-400 italic">Sem responsável definido</p>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Funcionário node
// ──────────────────────────────────────────────

interface FuncionarioNodeData extends FuncionarioDto {
    isResponsavel: boolean;
    highlighted: boolean;
    isCurrent: boolean;
}

function FuncionarioNodeCard({ data }: { data: FuncionarioNodeData }) {
    const color = getNivelColor(data.nivelHierarquicoOrdem);
    const [showMenu, setShowMenu] = React.useState(false);

    return (
        <div
            className="rounded-lg shadow overflow-visible select-none relative"
            style={{
                width: FUNC_W,
                minHeight: FUNC_H,
                border: data.isCurrent
                    ? "2px solid #2563eb"
                    : data.highlighted ? `2px solid ${color}` : "1px solid #e5e7eb",
                boxShadow: data.isCurrent
                    ? "0 0 0 5px rgba(37,99,235,0.25), 0 4px 14px rgba(37,99,235,0.2)"
                    : data.highlighted ? `0 0 0 3px ${color}22` : undefined,
                backgroundColor: data.isCurrent ? "rgba(37,99,235,0.07)" : data.highlighted ? `${color}09` : "#ffffff",
            }}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
        >
            <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0, border: 0, minWidth: 0, minHeight: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0, border: 0, minWidth: 0, minHeight: 0 }} />

            <div className="h-1 w-full" style={{ backgroundColor: color }} />

            <div className="flex items-start gap-2 px-2.5 py-2">
                <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-[11px] font-bold"
                    style={{ width: 34, height: 34, backgroundColor: color }}
                >
                    {getInitials(data.nome)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <OrgTooltip content={data.nome}>
                            <p className="text-[11px] font-semibold text-gray-900 truncate">{data.nome}</p>
                        </OrgTooltip>
                        {data.isResponsavel && (
                            <Star size={10} className="flex-shrink-0 text-blue-500" />
                        )}
                    </div>
                    {data.cargo && (
                        <OrgTooltip content={data.cargo}>
                            <p className="text-[10px] text-gray-500 truncate">{data.cargo}</p>
                        </OrgTooltip>
                    )}
                    {data.nivelHierarquicoNome && (
                        <span
                            className="inline-block mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: color }}
                        >
                            {data.nivelHierarquicoNome}
                        </span>
                    )}
                </div>
            </div>

            {/* Hover action menu */}
            {showMenu && (
                <div
                    className="absolute left-0 right-0 bottom-0 translate-y-full z-50 bg-white border border-gray-200 rounded-b-lg shadow-lg flex"
                    onMouseEnter={() => setShowMenu(true)}
                    onMouseLeave={() => setShowMenu(false)}
                >
                    <Link
                        href={`/funcionarios/perfil?id=${data.id}`}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-violet-600 hover:bg-violet-50 transition-colors border-r border-gray-100"
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Ver Perfil 360°"
                    >
                        <ExternalLink size={10} />
                        Perfil
                    </Link>
                    <OrgTooltip content="Solicitar Promoção">
                        <button
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-emerald-600 hover:bg-emerald-50 transition-colors border-r border-gray-100"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <TrendingUp size={10} />
                            Promoção
                        </button>
                    </OrgTooltip>
                    <OrgTooltip content="Solicitar Desligamento">
                        <button
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-red-500 hover:bg-red-50 transition-colors"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <UserMinus size={10} />
                            Desligar
                        </button>
                    </OrgTooltip>
                </div>
            )}
        </div>
    );
}

// Tooltip wrapper that renders via portal — works inside React Flow
function OrgTooltip({ content, children }: { content: string; children: React.ReactNode }) {
    return (
        <Tooltip.Root delayDuration={400}>
            <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    side="top"
                    sideOffset={4}
                    className="z-[9999] max-w-xs rounded bg-gray-900 px-2 py-1 text-[11px] text-white shadow-lg"
                >
                    {content}
                    <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

const nodeTypes: NodeTypes = {
    lotacaoNode: LotacaoNodeCard as unknown as NodeTypes["lotacaoNode"],
    funcionarioNode: FuncionarioNodeCard as unknown as NodeTypes["funcionarioNode"],
};

// ──────────────────────────────────────────────
// Graph builder
// ──────────────────────────────────────────────

function norm(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matches(func: FuncionarioDto, term: string): boolean {
    const q = norm(term);
    return norm(func.nome).includes(q) || norm(func.cargo ?? "").includes(q);
}

function buildGraph(
    lotacoes: LotacaoDto[],
    semLotacao: FuncionarioDto[],
    expandedIds: Set<string>,
    showSemLotacao: boolean,
    searchTerm: string,
    onToggle: (id: string) => void
): { nodes: Node[]; edges: Edge[]; resultNodeIds: string[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const resultNodeIds: string[] = [];
    const lotacaoIds = new Set(lotacoes.map((l) => l.id));
    const isSearching = searchTerm.trim().length > 0;

    // When searching: compute which lotações have at least one match
    // so they get auto-expanded and only matching employees are shown
    const lotacoesComMatch = isSearching
        ? new Set(lotacoes.filter((l) => l.funcionarios.some((f) => matches(f, searchTerm))).map((l) => l.id))
        : new Set<string>();

    const semLotacaoMatches = isSearching
        ? semLotacao.filter((f) => matches(f, searchTerm))
        : semLotacao;

    // Lotação nodes
    for (const lot of lotacoes) {
        const isExpanded = isSearching
            ? lotacoesComMatch.has(lot.id)
            : expandedIds.has(lot.id);

        nodes.push({
            id: `lot-${lot.id}`,
            type: "lotacaoNode",
            position: { x: 0, y: 0 },
            data: {
                ...lot,
                totalFuncionarios: lot.funcionarios.length,
                expanded: isExpanded,
                onToggle: () => onToggle(lot.id),
                headcountAutorizado: lot.headcountAutorizado ?? 0,
                headcountOcupado: lot.headcountOcupado ?? 0,
                headcountProvisorio: lot.headcountProvisorio ?? 0,
            } satisfies LotacaoNodeData,
        });

        // Edge to parent lotação
        if (lot.parentId && lotacaoIds.has(lot.parentId)) {
            edges.push({
                id: `e-lot-${lot.parentId}-${lot.id}`,
                source: `lot-${lot.parentId}`,
                target: `lot-${lot.id}`,
                type: "smoothstep",
                style: { stroke: "#94a3b8", strokeWidth: 2 },
            });
        }

        // Employee nodes when expanded — responsável is already shown inside the lotação card,
        // so we only create nodes for non-responsável employees. All connect to the lotação node.
        if (isExpanded) {
            const visibleFuncs = isSearching
                ? lot.funcionarios.filter((f) => matches(f, searchTerm))
                : lot.funcionarios;

            const responsavelId = lot.responsavel?.id;

            // Se o responsável corresponde à busca, o resultado de navegação aponta para o nó da lotação
            if (isSearching && responsavelId && visibleFuncs.some((f) => f.id === responsavelId)) {
                resultNodeIds.push(`lot-${lot.id}`);
            }

            for (const func of visibleFuncs) {
                // Responsável já aparece no card da lotação — não criar nó duplicado
                if (func.id === responsavelId) continue;

                const nodeId = `func-${func.id}`;
                nodes.push({
                    id: nodeId,
                    type: "funcionarioNode",
                    position: { x: 0, y: 0 },
                    className: isSearching ? "org-result-node" : undefined,
                    data: {
                        ...func,
                        isResponsavel: false,
                        highlighted: isSearching,
                        isCurrent: false,
                    } satisfies FuncionarioNodeData,
                });

                edges.push({
                    id: `e-lot-${lot.id}-${nodeId}`,
                    source: `lot-${lot.id}`,
                    target: nodeId,
                    type: "smoothstep",
                    style: { stroke: "#d1d5db", strokeWidth: 1 },
                });

                if (isSearching) resultNodeIds.push(nodeId);
            }
        }
    }

    // Sem lotação: show if toggle on, or if searching and has matches
    const showSlSection = showSemLotacao || (isSearching && semLotacaoMatches.length > 0);
    if (showSlSection && semLotacaoMatches.length > 0) {
        for (const func of semLotacaoMatches) {
            const nodeId = `func-sl-${func.id}`;
            nodes.push({
                id: nodeId,
                type: "funcionarioNode",
                position: { x: 0, y: 0 },
                className: isSearching ? "org-result-node" : undefined,
                data: { ...func, isResponsavel: false, highlighted: isSearching, isCurrent: false } satisfies FuncionarioNodeData,
            });
            if (isSearching) resultNodeIds.push(nodeId);
        }
    }

    return { nodes, edges, resultNodeIds };
}

// ──────────────────────────────────────────────
// Main canvas
// ──────────────────────────────────────────────

function OrganogramaCanvasInner() {
    const [estrutura, setEstrutura] = useState<EstruturaResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [showSemLotacao, setShowSemLotacao] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [resultCount, setResultCount] = useState(0);
    const [resultIndex, setResultIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultPositionsRef = useRef<Array<{ cx: number; cy: number }>>([]);
    const resultNodeIdsRef = useRef<string[]>([]);
    const { setCenter, getNode, fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/organograma/estrutura", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: EstruturaResponse = await res.json();
            setEstrutura(data);
            setExpandedIds(new Set()); // iniciar recolhido
        } catch {
            toast.error("Erro ao carregar organograma.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggle = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Full graph rebuild — runs on any structural change, never on resultIndex
    useEffect(() => {
        if (!estrutura) return;

        const { nodes: rawNodes, edges: rawEdges, resultNodeIds } = buildGraph(
            estrutura.lotacoes,
            estrutura.semLotacao,
            expandedIds,
            showSemLotacao,
            searchTerm,
            handleToggle
        );

        const layouted = applyDagreLayout(rawNodes, rawEdges);

        resultNodeIdsRef.current = resultNodeIds;
        resultPositionsRef.current = resultNodeIds.map((id) => {
            const n = layouted.find((ln) => ln.id === id);
            return n
                ? { cx: n.position.x + FUNC_W / 2, cy: n.position.y + FUNC_H / 2 }
                : { cx: 0, cy: 0 };
        });
        setResultCount(resultNodeIds.length);

        setNodes(layouted);
        setEdges(rawEdges);

        // Após mudança estrutural (expansão/recolhimento), reajusta o viewport
        if (!searchTerm) {
            setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50);
        }
    }, [estrutura, expandedIds, showSemLotacao, searchTerm, handleToggle, setNodes, setEdges, fitView]);

    // Reset navigation index when the search term changes
    useEffect(() => { setResultIndex(0); }, [searchTerm]);

    // Patch isCurrent in-place when navigating between results (no re-layout)
    useEffect(() => {
        if (!searchTerm) return;
        const currentNodeId = resultNodeIdsRef.current[resultIndex];
        setNodes((prev) =>
            prev.map((n) => {
                if (n.type !== "funcionarioNode") return n;
                const prevData = n.data as unknown as FuncionarioNodeData;
                const shouldBeCurrent = n.id === currentNodeId;
                if (prevData.isCurrent === shouldBeCurrent) return n;
                return { ...n, data: { ...prevData, isCurrent: shouldBeCurrent } };
            })
        );
    }, [resultIndex, searchTerm, setNodes]);

    // Zoom to the currently focused result node
    useEffect(() => {
        if (!searchTerm || resultPositionsRef.current.length === 0) return;
        const pos = resultPositionsRef.current[resultIndex];
        if (!pos) return;
        const timer = setTimeout(() => {
            setCenter(pos.cx, pos.cy, { zoom: 1.4, duration: 600 });
        }, 200);
        return () => clearTimeout(timer);
    }, [searchTerm, resultIndex, setCenter]);

    const selectSuggestion = useCallback((s: { type: string; label: string; id?: string }) => {
        setShowDropdown(false);
        setActiveIdx(-1);
        if (s.type === "lotacao" && s.id) {
            // Expand the lotação and zoom to it
            setInputValue(s.label);
            setSearchTerm(""); // clear employee search
            setExpandedIds((prev) => new Set([...prev, s.id!]));
            setTimeout(() => {
                const node = getNode(`lot-${s.id}`);
                if (node) setCenter(node.position.x + LOT_W / 2, node.position.y + LOT_H / 2, { zoom: 1.4, duration: 600 });
            }, 150);
        } else {
            setInputValue(s.label);
            setSearchTerm(s.label);
        }
    }, [getNode, setCenter]);

    const totalFuncionarios = useMemo(
        () => (estrutura?.lotacoes.reduce((s, l) => s + l.funcionarios.length, 0) ?? 0) + (estrutura?.semLotacao.length ?? 0),
        [estrutura]
    );

    // Autocomplete suggestions — with accent normalization, lotações included
    const suggestions = useMemo(() => {
        if (!estrutura || inputValue.trim().length < 1) return [];
        const q = norm(inputValue);

        const allFuncs: FuncionarioDto[] = [
            ...estrutura.lotacoes.flatMap((l) => l.funcionarios),
            ...estrutura.semLotacao,
        ];

        // Lotação suggestions (by description or code)
        const lotacaoMatches = estrutura.lotacoes
            .filter((l) => norm(l.descricao).includes(q) || norm(l.codigo).includes(q))
            .slice(0, 6)
            .map((l) => ({ label: l.descricao, sublabel: l.codigo, type: "lotacao" as const, id: l.id }));

        // Unique employee names matching query
        const nameMatches = Array.from(
            new Map(
                allFuncs.filter((f) => norm(f.nome).includes(q)).map((f) => [f.nome, f])
            ).values()
        ).slice(0, 6).map((f) => ({ label: f.nome, sublabel: f.cargo ?? undefined, type: "nome" as const, id: undefined }));

        // Unique cargo names matching query
        const shownLabels = new Set([...lotacaoMatches, ...nameMatches].map((s) => norm(s.label)));
        const cargoMatches = Array.from(
            new Set(
                allFuncs
                    .map((f) => f.cargo)
                    .filter((c): c is string => !!c && norm(c).includes(q) && !shownLabels.has(norm(c)))
            )
        ).slice(0, 6).map((c) => ({ label: c, sublabel: undefined, type: "cargo" as const, id: undefined }));

        return [...lotacaoMatches, ...nameMatches, ...cargoMatches];
    }, [estrutura, inputValue]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Carregando organograma...
            </div>
        );
    }

    if (!estrutura || (estrutura.lotacoes.length === 0 && estrutura.semLotacao.length === 0)) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Building2 size={32} className="opacity-30" />
                <p className="text-sm">Nenhuma lotação ou funcionário ativo encontrado.</p>
                <p className="text-xs">Configure as unidades de lotação e atribua funcionários primeiro.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <style>{`
                @keyframes org-pulse {
                    0%   { transform: scale(1); }
                    40%  { transform: scale(1.06); }
                    100% { transform: scale(1); }
                }
            `}</style>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-white flex-wrap">
                {/* Search with autocomplete */}
                <div className="relative">
                    <div className="relative flex items-center">
                        <Search size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                setActiveIdx(-1);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
                                } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setActiveIdx((i) => Math.max(i - 1, -1));
                                } else if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (activeIdx >= 0) {
                                        selectSuggestion(suggestions[activeIdx]);
                                    } else {
                                        const val = inputValue.trim();
                                        if (val) setSearchTerm(val);
                                        setShowDropdown(false);
                                    }
                                } else if (e.key === "Escape") {
                                    setInputValue(""); setSearchTerm("");
                                    setShowDropdown(false); setActiveIdx(-1);
                                }
                            }}
                            placeholder="Buscar funcionário ou cargo..."
                            className="pl-7 pr-7 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-96"
                        />
                        {(inputValue || searchTerm) && (
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setInputValue(""); setSearchTerm(""); setShowDropdown(false); setActiveIdx(-1); inputRef.current?.focus(); }}
                                className="absolute right-2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Dropdown */}
                    {showDropdown && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-[480px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                            {suggestions.map((s, i) => (
                                <button
                                    key={`${s.type}-${s.label}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectSuggestion(s)}
                                    className={[
                                        "w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors",
                                        i === activeIdx ? "bg-blue-50" : "hover:bg-gray-50",
                                    ].join(" ")}
                                >
                                    <span className={[
                                        "flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded",
                                        s.type === "lotacao" ? "bg-purple-100 text-purple-700" :
                                        s.type === "nome" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600",
                                    ].join(" ")}>
                                        {s.type === "lotacao" ? "LOTAÇÃO" : s.type === "nome" ? "FUNC" : "CARGO"}
                                    </span>
                                    <span className="text-xs text-gray-800 truncate">{s.label}</span>
                                    {s.sublabel && (
                                        <span className="text-[10px] text-gray-400 truncate ml-auto">{s.sublabel}</span>
                                    )}
                                </button>
                            ))}
                            <p className="text-[10px] text-gray-400 px-3 py-1.5 border-t bg-gray-50">
                                ↵ Enter para buscar
                            </p>
                        </div>
                    )}
                </div>

                {/* Result navigation */}
                {searchTerm && resultCount > 0 && (
                    <>
                        <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                            <button
                                onClick={() => setResultIndex((i) => (i - 1 + resultCount) % resultCount)}
                                className="text-blue-600 hover:text-blue-800 disabled:opacity-30 p-0.5 rounded"
                                disabled={resultCount <= 1}
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span className="text-xs font-medium text-blue-700 min-w-[4rem] text-center">
                                {resultIndex + 1} de {resultCount}
                            </span>
                            <button
                                onClick={() => setResultIndex((i) => (i + 1) % resultCount)}
                                className="text-blue-600 hover:text-blue-800 disabled:opacity-30 p-0.5 rounded"
                                disabled={resultCount <= 1}
                            >
                                <ChevronRight size={13} />
                            </button>
                        </div>
                        <span className="text-xs text-blue-600 font-medium">
                            {resultCount} encontrado{resultCount !== 1 ? "s" : ""}
                        </span>
                    </>
                )}

                {/* Right-side controls */}
                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400">
                        <ChevronRight size={10} />
                        Clique no contador para expandir
                    </div>

                    {estrutura.semLotacao.length > 0 && (
                        <button
                            onClick={() => setShowSemLotacao((v) => !v)}
                            className={[
                                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
                                showSemLotacao
                                    ? "bg-orange-50 border-orange-300 text-orange-700"
                                    : "border-gray-300 text-gray-500 hover:border-gray-400",
                            ].join(" ")}
                        >
                            <UserX size={11} />
                            {estrutura.semLotacao.length} sem lotação
                        </button>
                    )}

                    <div className="w-px h-4 bg-gray-200" />

                    <span className="text-xs text-gray-500">
                        {estrutura.lotacoes.length} lotações · {totalFuncionarios} funcionários
                    </span>

                    <div className="w-px h-4 bg-gray-200" />

                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <RefreshCw size={13} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative bg-white">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.25 }}
                    minZoom={0.15}
                    maxZoom={2}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                >
                    <Controls showInteractive={false} />
                    <MiniMap
                        nodeColor={(n) =>
                            n.type === "lotacaoNode"
                                ? getLevelColor((n.data as unknown as LotacaoNodeData).level)
                                : getNivelColor((n.data as unknown as FuncionarioNodeData).nivelHierarquicoOrdem)
                        }
                        pannable
                        zoomable
                    />
                    <Background variant={BackgroundVariant.Dots} gap={20} color="#f0f0f0" />
                </ReactFlow>
            </div>
        </div>
    );
}

export default function OrganogramaCanvas() {
    return (
        <Tooltip.Provider delayDuration={400}>
            <ReactFlowProvider>
                <OrganogramaCanvasInner />
            </ReactFlowProvider>
        </Tooltip.Provider>
    );
}
