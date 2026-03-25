"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, X, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OrgNode {
    id: string;
    nome: string;
    cargo: string | null;
    nivelHierarquicoId: string | null;
    nivelHierarquicoNome: string | null;
    gestorDiretoId: string | null;
    areaId: string | null;
    areaNome: string | null;
}

// ──────────────────────────────────────────────
// Dagre auto-layout
// ──────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 20 });

    nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return nodes.map((n) => {
        const pos = g.node(n.id);
        return {
            ...n,
            position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
        };
    });
}

// ──────────────────────────────────────────────
// Custom node component
// ──────────────────────────────────────────────

const NIVEL_COLORS: Record<string, string> = {
    diretor: "#7c3aed",
    gerente: "#2563eb",
    coordenador: "#0891b2",
    analista: "#059669",
    assistente: "#d97706",
    estagi: "#dc2626",
};

function getNivelColor(nome: string | null): string {
    if (!nome) return "#6b7280";
    const key = Object.keys(NIVEL_COLORS).find((k) =>
        nome.toLowerCase().includes(k)
    );
    return key ? NIVEL_COLORS[key] : "#6b7280";
}

function getInitials(nome: string): string {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

function OrgNodeCard({ data }: { data: OrgNode & { selected: boolean } }) {
    const color = getNivelColor(data.nivelHierarquicoNome);
    return (
        <div
            className="rounded-xl shadow-md border bg-white overflow-hidden select-none"
            style={{
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                borderColor: data.selected ? color : "#e5e7eb",
                borderWidth: data.selected ? 2 : 1,
            }}
        >
            <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
            <div className="flex items-center gap-2 px-3 py-2">
                <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-sm font-bold"
                    style={{ width: 40, height: 40, backgroundColor: color }}
                >
                    {getInitials(data.nome)}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{data.nome}</p>
                    {data.cargo && (
                        <p className="text-[11px] text-gray-500 truncate">{data.cargo}</p>
                    )}
                    {data.nivelHierarquicoNome && (
                        <span
                            className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: color }}
                        >
                            {data.nivelHierarquicoNome}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

const nodeTypes: NodeTypes = {
    orgNode: OrgNodeCard as unknown as NodeTypes["orgNode"],
};

// ──────────────────────────────────────────────
// Sidebar component
// ──────────────────────────────────────────────

interface SidebarProps {
    node: OrgNode | null;
    allNodes: OrgNode[];
    onClose: () => void;
    onMoved: () => void;
}

function Sidebar({ node, allNodes, onClose, onMoved }: SidebarProps) {
    const [novoGestorId, setNovoGestorId] = useState<string>("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (node) setNovoGestorId(node.gestorDiretoId ?? "");
    }, [node]);

    const handleSave = async () => {
        if (!node) return;
        setSaving(true);
        try {
            const res = await apiFetch("/api/organograma/mover", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: node.id,
                    novoGestorId: novoGestorId || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error((err as { message?: string })?.message ?? `HTTP ${res.status}`);
            }
            toast.success("Hierarquia atualizada.");
            onMoved();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
        } finally {
            setSaving(false);
        }
    };

    if (!node) return null;

    const color = getNivelColor(node.nivelHierarquicoNome);
    const potentialGestores = allNodes.filter((n) => n.id !== node.id);

    return (
        <div className="w-72 flex-shrink-0 border-l bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold text-gray-700">Detalhes</span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center rounded-full text-white text-lg font-bold"
                        style={{ width: 52, height: 52, backgroundColor: color }}
                    >
                        {getInitials(node.nome)}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">{node.nome}</p>
                        {node.cargo && <p className="text-xs text-gray-500">{node.cargo}</p>}
                        {node.areaNome && (
                            <p className="text-xs text-gray-400">{node.areaNome}</p>
                        )}
                    </div>
                </div>

                {node.nivelHierarquicoNome && (
                    <div>
                        <p className="text-xs text-gray-400 mb-1">Nível Hierárquico</p>
                        <span
                            className="inline-block text-xs font-medium px-2 py-1 rounded-full text-white"
                            style={{ backgroundColor: color }}
                        >
                            {node.nivelHierarquicoNome}
                        </span>
                    </div>
                )}

                <div>
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1.5">
                        <UserCog size={13} />
                        Gestor Direto
                    </label>
                    <select
                        value={novoGestorId}
                        onChange={(e) => setNovoGestorId(e.target.value)}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">— Sem gestor (raiz) —</option>
                        {potentialGestores.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.nome}
                            </option>
                        ))}
                    </select>
                </div>

                <Button
                    size="sm"
                    className="w-full"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Salvando..." : "Salvar hierarquia"}
                </Button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Main canvas component
// ──────────────────────────────────────────────

function OrganogramaCanvasInner() {
    const [rawData, setRawData] = useState<OrgNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [areaFilter, setAreaFilter] = useState<string>("");
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/organograma", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: OrgNode[] = await res.json();
            setRawData(data);
        } catch {
            toast.error("Erro ao carregar organograma.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Build graph whenever rawData or filter changes
    useEffect(() => {
        const filtered = areaFilter
            ? rawData.filter((n) => n.areaNome === areaFilter)
            : rawData;

        const visibleIds = new Set(filtered.map((n) => n.id));

        const rawNodes: Node[] = filtered.map((n) => ({
            id: n.id,
            type: "orgNode",
            position: { x: 0, y: 0 },
            data: { ...n, selected: n.id === selectedId },
        }));

        const rawEdges: Edge[] = filtered
            .filter((n) => n.gestorDiretoId && visibleIds.has(n.gestorDiretoId))
            .map((n) => ({
                id: `e-${n.gestorDiretoId}-${n.id}`,
                source: n.gestorDiretoId!,
                target: n.id,
                type: "smoothstep",
                style: { stroke: "#d1d5db", strokeWidth: 1.5 },
            }));

        const layouted = applyDagreLayout(rawNodes, rawEdges);
        setNodes(layouted);
        setEdges(rawEdges);
    }, [rawData, areaFilter, selectedId, setNodes, setEdges]);

    const selectedNode = useMemo(
        () => rawData.find((n) => n.id === selectedId) ?? null,
        [rawData, selectedId]
    );

    const areas = useMemo(
        () => [...new Set(rawData.map((n) => n.areaNome).filter(Boolean))] as string[],
        [rawData]
    );

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedId((prev) => (prev === node.id ? null : node.id));
    }, []);

    const handleMoved = () => {
        setSelectedId(null);
        load();
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Carregando organograma...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b bg-white">
                <span className="text-sm font-medium text-gray-700">
                    {rawData.length} funcionários
                </span>
                {areas.length > 0 && (
                    <select
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Todas as áreas</option>
                        {areas.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    onClick={load}
                    className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <RefreshCw size={13} />
                    Atualizar
                </button>
            </div>

            {/* Canvas + Sidebar */}
            <div className="flex flex-1 min-h-0">
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={handleNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        minZoom={0.2}
                        maxZoom={2}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable
                    >
                        <Controls showInteractive={false} />
                        <MiniMap
                            nodeColor={(n) => {
                                const nivel = (n.data as unknown as OrgNode).nivelHierarquicoNome;
                                return getNivelColor(nivel);
                            }}
                            pannable
                            zoomable
                        />
                        <Background variant={BackgroundVariant.Dots} gap={20} color="#f0f0f0" />
                    </ReactFlow>
                </div>

                {selectedNode && (
                    <Sidebar
                        node={selectedNode}
                        allNodes={rawData}
                        onClose={() => setSelectedId(null)}
                        onMoved={handleMoved}
                    />
                )}
            </div>

            {!selectedNode && rawData.length > 0 && (
                <div className="text-center text-xs text-gray-400 py-1.5 border-t bg-gray-50">
                    Clique em um funcionário para ver detalhes e alterar a hierarquia
                </div>
            )}
        </div>
    );
}

export default function OrganogramaCanvas() {
    return (
        <ReactFlowProvider>
            <OrganogramaCanvasInner />
        </ReactFlowProvider>
    );
}
