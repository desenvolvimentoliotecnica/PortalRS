"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    RefreshCw, Plus, Filter, Hand, BarChart3, X, Star, ChevronRight, Edit3,
    GripVertical, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface NineBoxItem {
    assessmentId: string;
    funcionarioId: string;
    funcionarioNome: string;
    cargo: string | null;
    areaNome: string | null;
    nivelHierarquicoNome: string | null;
    desempenho: number; // 1, 2, 3
    potencial: number;  // 1, 2, 3
    observacoes: string | null;
    avaliadorNome: string;
    criadoEmUtc: string;
}

interface FuncionarioOption {
    id: string;
    name: string;
    cargo: string | null;
    areaId: string | null;       // CentroCustoId — "Área" no domínio Liotécnica (comentário no contrato: "Centro de custo — absorveu Area em 31.2")
    areaNome: string | null;     // CentroCustoDescricao
    hierarquiaId: string | null;   // HierarquiaId (organograma TOTVS — fonte real, já que GestorDireto não é populado pelo sync)
    hierarquiaNome: string | null; // HierarquiaDescricao
}

// Visual data per quadrante. perf (desempenho) × pot (potencial), 1..3.
// O mock do HTML usa coordenadas 0..2, aqui mantemos 1..3 (que é o que a API expõe).
const QUADRANTS: Record<string, { label: string; desc: string; bg: string; border: string; title: string; swatch: string }> = {
    // Linha topo (potencial alto = 3)
    "1-3": { label: "Enigma",          desc: "Alto potencial, baixa performance",        bg: "#FEF3C7", border: "#FCD34D", title: "#92400E", swatch: "#F59E0B" },
    "2-3": { label: "Alto Potencial",  desc: "Potencial alto, performance em desenvolvimento", bg: "#D1FAE5", border: "#6EE7B7", title: "#065F46", swatch: "#10B981" },
    "3-3": { label: "Estrela",         desc: "Alto potencial e alta performance",        bg: "#DBEAFE", border: "#93C5FD", title: "#1E40AF", swatch: "#3B82F6" },
    // Linha meio (potencial médio = 2)
    "1-2": { label: "Em Desenvolvimento", desc: "Potencial médio, baixa performance",     bg: "#FED7AA", border: "#FDBA74", title: "#9A3412", swatch: "#F97316" },
    "2-2": { label: "Núcleo",          desc: "Performance e potencial medianos",         bg: "#FEF9C3", border: "#FDE68A", title: "#854D0E", swatch: "#EAB308" },
    "3-2": { label: "Alto Desempenho", desc: "Alta performance, potencial médio",        bg: "#D1FAE5", border: "#6EE7B7", title: "#065F46", swatch: "#10B981" },
    // Linha base (potencial baixo = 1)
    "1-1": { label: "Questionável",    desc: "Baixo desempenho e baixo potencial",       bg: "#FECACA", border: "#FCA5A5", title: "#991B1B", swatch: "#EF4444" },
    "2-1": { label: "Efetivo",         desc: "Performance mediana, baixo potencial",     bg: "#FED7AA", border: "#FDBA74", title: "#9A3412", swatch: "#F97316" },
    "3-1": { label: "Especialista",    desc: "Alto desempenho, baixo potencial",         bg: "#FEF9C3", border: "#FDE68A", title: "#854D0E", swatch: "#EAB308" },
};

// PDI templates por quadrante (mantido do código anterior — usado pelo PdiConfirmModal).
const PDI_TEMPLATES: Record<string, { titulo: string; descricao: string }> = {
    "1-1": { titulo: "Plano de Melhoria de Performance", descricao: "Identificar causas de baixo desempenho e potencial. Definir metas claras de curto prazo com acompanhamento semanal." },
    "1-2": { titulo: "Plano de Desenvolvimento de Competências", descricao: "Foco em capacitação técnica e comportamental. Mentorias e treinamentos para elevar o nível de entrega." },
    "1-3": { titulo: "Plano de Engajamento e Clareza de Carreira", descricao: "Alto potencial não convertido em desempenho. Identificar barreiras, alinhar expectativas e definir trilha de carreira clara." },
    "2-1": { titulo: "Plano de Retenção e Reconhecimento", descricao: "Profissional efetivo com desempenho estável. Foco em reconhecimento, benefícios e plano de carreira para retenção." },
    "2-2": { titulo: "Plano de Crescimento Sustentável", descricao: "Pilar da equipe com equilíbrio desempenho-potencial. Desenvolvimento de liderança técnica e expansão de responsabilidades." },
    "2-3": { titulo: "Plano de Aceleração de Carreira", descricao: "Alto potencial com desempenho consistente. Acelerar crescimento com projetos desafiadores e mentoria de líderes sênior." },
    "3-1": { titulo: "Plano de Expansão de Liderança", descricao: "Especialista técnico de alto desempenho. Desenvolver habilidades de liderança, mentoria de equipe e gestão de projetos." },
    "3-2": { titulo: "Plano de Desenvolvimento para Liderança Sênior", descricao: "Alto desempenho com potencial de crescimento. Preparar para posições de liderança sênior com foco em visão estratégica." },
    "3-3": { titulo: "Plano de Sucessão e Retenção de Talentos", descricao: "Estrela da organização. Plano de sucessão, projetos de alto impacto, e estratégia de retenção personalizada." },
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getInitials(nome: string): string {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

// Cor determinística por nome — paleta pastel suave (16 tons).
const PALETTE = [
    "#FDBA74", "#A5B4FC", "#86EFAC", "#FCA5A5", "#F9A8D4", "#7DD3FC",
    "#FDE68A", "#C4B5FD", "#FBBF24", "#6EE7B7", "#F472B6", "#60A5FA",
    "#FCD34D", "#FB923C", "#A7F3D0", "#93C5FD",
];
function avatarColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
}

function shortName(full: string): string {
    const parts = full.split(" ").filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last[0]?.toUpperCase() ?? ""}.`;
}

// ──────────────────────────────────────────────
// Avatar
// ──────────────────────────────────────────────

function Avatar({ seed, name, size = 28, ring = false }: { seed: string; name: string; size?: number; ring?: boolean }) {
    const fontSize = size <= 22 ? 9 : size <= 28 ? 10 : size <= 36 ? 12 : 14;
    return (
        <div
            className={`inline-flex items-center justify-center rounded-full font-semibold text-slate-900 select-none ${ring ? "ring-2 ring-white" : ""}`}
            style={{ width: size, height: size, fontSize, background: avatarColor(seed) }}
            title={name}
        >
            {getInitials(name)}
        </div>
    );
}

// ──────────────────────────────────────────────
// PersonChip — usado dentro do quadrante
// ──────────────────────────────────────────────

function PersonChip({
    item,
    mode,
    onDragStart,
    onClick,
    dragging,
    selected,
}: {
    item: NineBoxItem;
    mode: "compact" | "labeled";
    onDragStart: (e: React.DragEvent, id: string) => void;
    onClick: (e: React.MouseEvent) => void;
    dragging?: boolean;
    selected?: boolean;
}) {
    if (mode === "compact") {
        return (
            <div
                draggable
                onDragStart={(e) => onDragStart(e, item.assessmentId)}
                onClick={onClick}
                className={`cursor-grab active:cursor-grabbing transition-transform ${dragging ? "opacity-30" : "hover:scale-110"} ${selected ? "ring-2 ring-primary ring-offset-1 rounded-full" : ""}`}
                title={`${item.funcionarioNome}${item.cargo ? ` · ${item.cargo}` : ""}`}
            >
                <Avatar seed={item.funcionarioId} name={item.funcionarioNome} size={32} ring />
            </div>
        );
    }
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item.assessmentId)}
            onClick={onClick}
            className={`flex items-center gap-2 bg-white/95 hover:bg-white border border-white shadow-sm rounded-lg pl-1 pr-2.5 py-1 cursor-grab active:cursor-grabbing max-w-full ${dragging ? "opacity-30" : ""} ${selected ? "ring-2 ring-primary" : ""}`}
            title={item.cargo ?? ""}
        >
            <Avatar seed={item.funcionarioId} name={item.funcionarioNome} size={24} />
            <div className="min-w-0">
                <div className="text-[11.5px] font-semibold text-slate-900 truncate leading-tight">
                    {shortName(item.funcionarioNome)}
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Quadrant cell
// ──────────────────────────────────────────────

function Quadrant({
    desempenho,
    potencial,
    items,
    mode,
    isDragOver,
    isMoving,
    movingItemId,
    onDragOver,
    onDragLeave,
    onDrop,
    onClickHeader,
    onClickChip,
    onChipDragStart,
}: {
    desempenho: number;
    potencial: number;
    items: NineBoxItem[];
    mode: "compact" | "labeled";
    isDragOver: boolean;
    isMoving: boolean;
    movingItemId: string | null;
    onDragOver: () => void;
    onDragLeave: () => void;
    onDrop: () => void;
    onClickHeader: () => void;
    onClickChip: (item: NineBoxItem, e: React.MouseEvent) => void;
    onChipDragStart: (e: React.DragEvent, id: string) => void;
}) {
    const key = `${desempenho}-${potencial}`;
    const q = QUADRANTS[key];
    const isTopTier = desempenho === 3 && potencial === 3;

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
            onDragLeave={onDragLeave}
            onDrop={(e) => { e.preventDefault(); onDrop(); }}
            className="relative flex flex-col p-3 transition-colors group cursor-pointer min-h-[200px]"
            style={{
                background: q.bg,
                outline: isDragOver ? `2px dashed ${q.title}` : "none",
                outlineOffset: -4,
            }}
        >
            {/* Header — clica aqui para abrir drawer */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClickHeader(); }}
                className="flex items-start justify-between mb-2 text-left w-full"
            >
                <div className="min-w-0">
                    <div className="text-[11px] font-bold tracking-wider uppercase truncate" style={{ color: q.title }}>
                        {q.label}
                    </div>
                    <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: q.title, opacity: 0.7 }}>
                        {q.desc}
                    </div>
                </div>
                <span
                    className="text-[11px] font-semibold rounded-full px-2 h-5 inline-flex items-center shrink-0 ml-2"
                    style={{ background: "rgba(255,255,255,0.6)", color: q.title }}
                >
                    {items.length}
                </span>
            </button>

            {/* Chips */}
            <div className="flex-1 flex flex-wrap content-start gap-1.5">
                {items.map((it) => (
                    <PersonChip
                        key={it.assessmentId}
                        item={it}
                        mode={mode}
                        dragging={false}
                        selected={movingItemId === it.assessmentId}
                        onDragStart={onChipDragStart}
                        onClick={(e) => onClickChip(it, e)}
                    />
                ))}
                {items.length === 0 && (
                    <div className="text-[11px] italic mt-auto mb-2 mx-auto opacity-50" style={{ color: q.title }}>
                        {isMoving ? "soltar aqui" : "arraste para cá"}
                    </div>
                )}
            </div>

            {isTopTier && (
                <span className="absolute top-2 right-9 opacity-70" style={{ color: "#F59E0B" }}>
                    <Star className="size-3" />
                </span>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────
// Modais
// ──────────────────────────────────────────────

interface PdiConfirmModalProps {
    funcionarioNome: string;
    qKey: string;
    onConfirm: () => void;
    onSkip: () => void;
    creating: boolean;
}

function PdiConfirmModal({ funcionarioNome, qKey, onConfirm, onSkip, creating }: PdiConfirmModalProps) {
    const tpl = PDI_TEMPLATES[qKey];
    const q = QUADRANTS[qKey];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-center mb-4"
                    style={{ backgroundColor: q?.bg, color: q?.title }}
                >
                    {q?.label}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Criar PDI para {funcionarioNome}?</h3>
                <p className="text-xs text-gray-500 mb-3">
                    Sugestão baseada no quadrante: <span className="font-medium text-gray-700">{tpl?.titulo}</span>
                </p>
                <p className="text-xs text-gray-400 mb-5">{tpl?.descricao}</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={onSkip} disabled={creating}>Pular</Button>
                    <Button size="sm" className="flex-1" onClick={onConfirm} disabled={creating}>
                        {creating ? "Criando..." : "Criar PDI"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface PosicionarModalProps {
    funcionario: FuncionarioOption | null;
    currentAssessment: NineBoxItem | null;
    onClose: () => void;
    onSaved: (funcionarioId: string, funcionarioNome: string, qKey: string) => void;
}

function PosicionarModal({ funcionario, currentAssessment, onClose, onSaved }: PosicionarModalProps) {
    const [desempenho, setDesempenho] = useState(currentAssessment?.desempenho ?? 2);
    const [potencial, setPotencial] = useState(currentAssessment?.potencial ?? 2);
    const [observacoes, setObservacoes] = useState(currentAssessment?.observacoes ?? "");
    const [saving, setSaving] = useState(false);

    if (!funcionario) return null;

    const qKey = `${desempenho}-${potencial}`;
    const q = QUADRANTS[qKey];

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiFetch("/api/nine-box", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: funcionario.id,
                    desempenho,
                    potencial,
                    observacoes: observacoes || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error((err as { message?: string })?.message ?? `HTTP ${res.status}`);
            }
            toast.success(`${funcionario.name} posicionado em "${q.label}"`);
            onSaved(funcionario.id, funcionario.name, qKey);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Posicionar no Nine-Box</h3>
                <p className="text-xs text-gray-500 mb-4">
                    {funcionario.name}{funcionario.cargo ? ` · ${funcionario.cargo}` : ""}
                </p>

                <div
                    className="rounded-xl px-4 py-3 mb-5 text-center font-semibold"
                    style={{ backgroundColor: q.bg, color: q.title }}
                >
                    {q.label}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600">
                            Desempenho: <span className="font-bold">{["Baixo", "Médio", "Alto"][desempenho - 1]}</span>
                        </label>
                        <input
                            type="range" min={1} max={3} step={1} value={desempenho}
                            className="w-full mt-1 accent-blue-600"
                            onChange={(e) => setDesempenho(Number(e.target.value))}
                        />
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Baixo</span><span>Médio</span><span>Alto</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600">
                            Potencial: <span className="font-bold">{["Baixo", "Médio", "Alto"][potencial - 1]}</span>
                        </label>
                        <input
                            type="range" min={1} max={3} step={1} value={potencial}
                            className="w-full mt-1 accent-emerald-600"
                            onChange={(e) => setPotencial(Number(e.target.value))}
                        />
                        <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Baixo</span><span>Médio</span><span>Alto</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600">Observações (opcional)</label>
                        <textarea
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            rows={2}
                            className="mt-1 w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Notas sobre este posicionamento..."
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
                    <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                        {saving ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────

export default function NineBoxScreen() {
    const [items, setItems] = useState<NineBoxItem[]>([]);
    const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioOption | null>(null);
    const [pdiModal, setPdiModal] = useState<{ funcionarioId: string; funcionarioNome: string; qKey: string } | null>(null);
    const [creatingPdi, setCreatingPdi] = useState(false);

    // Filtros / display
    const [filter, setFilter] = useState<"all" | "placed" | "unplaced">("all");
    const [showLegend, setShowLegend] = useState(true);
    const [density] = useState<"compact" | "labeled">("labeled");

    // Filtros do escopo: hierarquia (organograma TOTVS) e área (CentroCusto). "" = sem filtro.
    // Por que Hierarquia e não Gestor: no banco da Liotécnica, GestorDiretoId não é populado pelo
    // sync TOTVS RM (0/636 ativos). Hierarquia (PFUNCAO/PSECAO) é a fonte real do organograma.
    const [hierarquiaFilter, setHierarquiaFilter] = useState<string>("");
    const [areaFilter, setAreaFilter] = useState<string>("");

    const hasAnyScopeFilter = Boolean(hierarquiaFilter || areaFilter);

    // Drag state
    const [dragOverKey, setDragOverKey] = useState<string | null>(null); // "d-p" ou "unplaced"
    const [movingItemId, setMovingItemId] = useState<string | null>(null);
    const [movingSaving, setMovingSaving] = useState(false);

    // Drawer
    const [drawerKey, setDrawerKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // Status=1 = Ativo (filtro pedido pelo Lucas: "funcionarios deve ser somente os ativos ok?")
            // PageSize=500 cobre quase todo tenant; em tenant maior precisa virar paginação real (TODO).
            const [matrizRes, funcRes] = await Promise.all([
                apiFetch("/api/nine-box/matriz", { cache: "no-store" }),
                apiFetch("/api/funcionarios?pageSize=500&status=1", { cache: "no-store" }),
            ]);
            if (matrizRes.ok) setItems(await matrizRes.json());
            if (funcRes.ok) {
                const data = await funcRes.json();
                const arr = Array.isArray(data) ? data : (data?.items ?? []);
                interface FuncRow {
                    id: string;
                    name: string;
                    jobPositionName?: string | null;
                    centroCustoId?: string | null;
                    centroCustoDescricao?: string | null;
                    hierarquiaId?: string | null;
                    hierarquiaDescricao?: string | null;
                }
                setFuncionarios((arr as FuncRow[]).map((f) => ({
                    id: f.id,
                    name: f.name,
                    cargo: f.jobPositionName ?? null,
                    areaId: f.centroCustoId ?? null,
                    areaNome: f.centroCustoDescricao ?? null,
                    hierarquiaId: f.hierarquiaId ?? null,
                    hierarquiaNome: f.hierarquiaDescricao ?? null,
                })));
            }
        } catch {
            toast.error("Erro ao carregar Nine-Box.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Funcionários no escopo (depois dos filtros de hierarquia/área).
    // Quando nenhum filtro está ativo, retornamos lista vazia — nada deve aparecer na tela
    // até o usuário restringir o escopo (evita poluir com 600+ pessoas do tenant).
    const funcionariosFiltrados = useMemo(() => {
        if (!hasAnyScopeFilter) return [];
        return funcionarios.filter((f) => {
            if (hierarquiaFilter && f.hierarquiaId !== hierarquiaFilter) return false;
            if (areaFilter && f.areaId !== areaFilter) return false;
            return true;
        });
    }, [funcionarios, hierarquiaFilter, areaFilter, hasAnyScopeFilter]);

    const funcionariosScopeIds = useMemo(
        () => new Set(funcionariosFiltrados.map((f) => f.id)),
        [funcionariosFiltrados]
    );

    // Itens da matriz só aparecem quando há filtro aplicado.
    const itemsFiltrados = useMemo(() => {
        if (!hasAnyScopeFilter) return [];
        return items.filter((i) => funcionariosScopeIds.has(i.funcionarioId));
    }, [items, funcionariosScopeIds, hasAnyScopeFilter]);

    const placedFuncIds = useMemo(
        () => new Set(itemsFiltrados.map((i) => i.funcionarioId)),
        [itemsFiltrados]
    );

    const unplaced = useMemo(
        () => funcionariosFiltrados.filter((f) => !placedFuncIds.has(f.id)),
        [funcionariosFiltrados, placedFuncIds]
    );

    const totalPlaced = itemsFiltrados.length;
    const total = funcionariosFiltrados.length || (totalPlaced + unplaced.length);

    // Lookups únicos para os selects, derivados da lista TODA (não dos filtrados),
    // assim o usuário sempre vê todas as opções disponíveis.
    const hierarquiasDisponiveis = useMemo(() => {
        const map = new Map<string, string>();
        for (const f of funcionarios) {
            if (f.hierarquiaId && f.hierarquiaNome && !map.has(f.hierarquiaId)) {
                map.set(f.hierarquiaId, f.hierarquiaNome);
            }
        }
        return Array.from(map.entries())
            .map(([id, nome]) => ({ id, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [funcionarios]);

    const areasDisponiveis = useMemo(() => {
        const map = new Map<string, string>();
        for (const f of funcionarios) {
            if (f.areaId && f.areaNome && !map.has(f.areaId)) {
                map.set(f.areaId, f.areaNome);
            }
        }
        return Array.from(map.entries())
            .map(([id, nome]) => ({ id, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [funcionarios]);

    const getCellItems = (desempenho: number, potencial: number): NineBoxItem[] => {
        if (filter === "unplaced") return [];
        return itemsFiltrados.filter((i) => i.desempenho === desempenho && i.potencial === potencial);
    };

    // Drag and drop helpers
    const onChipDragStart = (e: React.DragEvent, assessmentId: string) => {
        e.dataTransfer.setData("text/plain", assessmentId);
        e.dataTransfer.effectAllowed = "move";
        setMovingItemId(assessmentId);
    };

    const onUnplacedDragStart = (e: React.DragEvent, funcionarioId: string) => {
        e.dataTransfer.setData("text/plain", `unplaced:${funcionarioId}`);
        e.dataTransfer.effectAllowed = "move";
    };

    const dropOnQuadrant = async (desempenho: number, potencial: number, payload: string) => {
        setDragOverKey(null);
        const isUnplaced = payload.startsWith("unplaced:");
        const id = isUnplaced ? payload.slice("unplaced:".length) : null;
        const item = !isUnplaced ? items.find((i) => i.assessmentId === payload) : null;

        const funcionarioId = isUnplaced ? id! : item?.funcionarioId;
        const funcionarioNome = isUnplaced
            ? funcionarios.find((f) => f.id === id)?.name ?? "Funcionário"
            : item?.funcionarioNome ?? "";

        if (!funcionarioId) return;
        if (item && item.desempenho === desempenho && item.potencial === potencial) {
            setMovingItemId(null);
            return;
        }

        setMovingSaving(true);
        try {
            const res = await apiFetch("/api/nine-box", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId,
                    desempenho,
                    potencial,
                    observacoes: item?.observacoes ?? null,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const qKey = `${desempenho}-${potencial}`;
            toast.success(`${funcionarioNome} posicionado em "${QUADRANTS[qKey].label}".`);
            setMovingItemId(null);
            await load();
        } catch {
            toast.error("Falha ao mover.");
        } finally {
            setMovingSaving(false);
        }
    };

    const onChipClick = (item: NineBoxItem) => {
        const f = funcionarios.find((x) => x.id === item.funcionarioId);
        if (f) setSelectedFuncionario(f);
    };

    const currentAssessment = selectedFuncionario
        ? items.find((i) => i.funcionarioId === selectedFuncionario.id) ?? null
        : null;

    return (
        <section className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Sucessão & Talentos
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Nine-Box</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Matriz 3×3 de Desempenho × Potencial. Arraste cards entre quadrantes ou clique no header de um quadrante para abrir os detalhes.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowLegend((v) => !v)}>
                        {showLegend ? "Ocultar legenda" : "Mostrar legenda"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={load} title="Atualizar" disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center bg-muted rounded-lg p-0.5 text-[12.5px]">
                    {[
                        { k: "all" as const, l: `Todos (${total})` },
                        { k: "placed" as const, l: `Posicionados (${totalPlaced})` },
                        { k: "unplaced" as const, l: `Pendentes (${unplaced.length})` },
                    ].map((f) => (
                        <button
                            key={f.k}
                            onClick={() => setFilter(f.k)}
                            className={`h-7 px-3 rounded-md font-medium transition-colors ${filter === f.k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {f.l}
                        </button>
                    ))}
                </div>

                {/* Filtros de escopo: Hierarquia (organograma TOTVS) / Área (CentroCusto) */}
                <div className="flex items-center gap-2 ml-2">
                    <div className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Filter className="size-3.5" /> Escopo:
                    </div>
                    <select
                        value={hierarquiaFilter}
                        onChange={(e) => setHierarquiaFilter(e.target.value)}
                        className="h-8 rounded-md border border-border/60 bg-card px-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        title="Filtrar por hierarquia (organograma TOTVS)"
                    >
                        <option value="">Hierarquia...</option>
                        {hierarquiasDisponiveis.map((h) => (
                            <option key={h.id} value={h.id}>{h.nome}</option>
                        ))}
                    </select>
                    <select
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                        className="h-8 rounded-md border border-border/60 bg-card px-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        title="Filtrar por área (centro de custo)"
                    >
                        <option value="">Área...</option>
                        {areasDisponiveis.map((a) => (
                            <option key={a.id} value={a.id}>{a.nome}</option>
                        ))}
                    </select>
                    {hasAnyScopeFilter && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setHierarquiaFilter(""); setAreaFilter(""); }}
                            title="Limpar filtros"
                        >
                            <X className="size-3.5" />
                        </Button>
                    )}
                </div>

                <div className="flex-1" />
            </div>

            {loading ? (
                <div className="rounded-2xl border border-border/40 bg-card p-12 text-center text-muted-foreground text-sm">
                    Carregando matriz...
                </div>
            ) : !hasAnyScopeFilter ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-10 text-center">
                    <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Filter className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">Selecione um escopo para começar</h3>
                    <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                        Escolha uma <strong>Hierarquia</strong> (organograma TOTVS) ou uma <strong>Área</strong> nos filtros acima
                        para listar os colaboradores e abrir a matriz. Sem filtro, a tela ficaria com {funcionarios.length} pessoas — pesado
                        de operar.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Matrix ── */}
                    <div className="rounded-2xl border border-border/40 bg-card p-5">
                        <div className="grid" style={{ gridTemplateColumns: "auto 1fr", gridTemplateRows: "1fr auto", gap: 12 }}>
                            {/* Y axis */}
                            <div className="flex flex-col items-center justify-center pr-1">
                                <div
                                    className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold"
                                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                                >
                                    Potencial →
                                </div>
                            </div>

                            {/* Matrix grid (rows top→bottom: pot 3, 2, 1) */}
                            <div className="grid grid-cols-3 overflow-hidden rounded-xl" style={{ gridTemplateRows: "repeat(3, minmax(220px, 1fr))" }}>
                                {[3, 2, 1].map((potencial) => (
                                    <React.Fragment key={potencial}>
                                        {[1, 2, 3].map((desempenho) => {
                                            const key = `${desempenho}-${potencial}`;
                                            const cellItems = getCellItems(desempenho, potencial);
                                            return (
                                                <Quadrant
                                                    key={key}
                                                    desempenho={desempenho}
                                                    potencial={potencial}
                                                    items={cellItems}
                                                    mode={density}
                                                    isDragOver={dragOverKey === key}
                                                    isMoving={movingItemId !== null}
                                                    movingItemId={movingItemId}
                                                    onDragOver={() => setDragOverKey(key)}
                                                    onDragLeave={() => setDragOverKey((v) => (v === key ? null : v))}
                                                    onDrop={async () => {
                                                        // O dataTransfer é pego diretamente via state (movingItemId) + payload prefix
                                                        const data = movingItemId ?? "";
                                                        if (!data) return;
                                                        await dropOnQuadrant(desempenho, potencial, data);
                                                    }}
                                                    onClickHeader={() => setDrawerKey(key)}
                                                    onClickChip={(it) => onChipClick(it)}
                                                    onChipDragStart={onChipDragStart}
                                                />
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* corner spacer */}
                            <div />

                            {/* X axis labels */}
                            <div>
                                <div className="grid grid-cols-3 mt-2 text-[12px] font-medium text-muted-foreground">
                                    {["Baixo", "Médio", "Alto"].map((l) => (
                                        <div key={l} className="text-center">{l}</div>
                                    ))}
                                </div>
                                <div className="text-center mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                                    Desempenho →
                                </div>
                            </div>
                        </div>

                        {movingSaving && (
                            <div className="mt-3 text-[11px] text-muted-foreground italic text-center">Salvando posicionamento...</div>
                        )}
                    </div>

                    {/* ── Legend ── */}
                    {showLegend && (
                        <div className="rounded-xl border border-border/40 bg-card p-4">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Legenda dos 9 Quadrantes</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(QUADRANTS).map(([k, q]) => (
                                    <div key={k} className="flex items-start gap-2 rounded-lg border border-border/30 p-3">
                                        <span className="mt-0.5 size-4 rounded shrink-0" style={{ background: q.swatch }} />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold" style={{ color: q.title }}>{q.label}</div>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{q.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Bottom panels: A posicionar + Distribuição ── */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* A posicionar */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOverKey("unplaced"); }}
                            onDragLeave={() => setDragOverKey((v) => (v === "unplaced" ? null : v))}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOverKey(null);
                                // arrastar de volta para "A posicionar" não é suportado pela API de domínio (não removemos o assessment).
                                // Apenas limpamos o estado de drag sem ação destrutiva.
                                setMovingItemId(null);
                            }}
                            className={`col-span-12 lg:col-span-7 rounded-2xl border bg-card ${dragOverKey === "unplaced" ? "border-primary ring-2 ring-primary/20" : "border-border/40"}`}
                        >
                            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
                                <span className="size-8 rounded-lg bg-amber-50 text-amber-600 inline-flex items-center justify-center shrink-0">
                                    <Hand className="size-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">A posicionar</div>
                                    <div className="text-[14px] font-semibold">
                                        {unplaced.length} {unplaced.length === 1 ? "pessoa pendente" : "pessoas pendentes"}
                                    </div>
                                </div>
                                <div className="text-[11.5px] text-muted-foreground hidden md:block">Arraste para um quadrante</div>
                            </div>
                            <div className="p-3">
                                {unplaced.length === 0 ? (
                                    funcionariosFiltrados.length === 0 ? (
                                        <div className="text-center py-4 text-[12.5px] text-muted-foreground w-full">
                                            Nenhum funcionário ativo no escopo selecionado.
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-[12.5px] text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                                            <Check className="size-3.5 text-emerald-500" />
                                            Todos posicionados.
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {unplaced.map((p) => (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={(e) => onUnplacedDragStart(e, p.id)}
                                                onClick={() => setSelectedFuncionario(p)}
                                                className="group flex items-center gap-2 rounded-full border border-dashed border-border/60 bg-muted/30 hover:border-primary/60 hover:bg-primary/5 pl-1 pr-3 py-1 cursor-grab active:cursor-grabbing"
                                            >
                                                <Avatar seed={p.id} name={p.name} size={26} />
                                                <div className="min-w-0">
                                                    <div className="text-[12px] font-semibold truncate leading-tight">{p.name}</div>
                                                    <div className="text-[10.5px] text-muted-foreground truncate leading-tight">{p.cargo ?? "—"}</div>
                                                </div>
                                                <GripVertical className="size-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Distribuição */}
                        <div className="col-span-12 lg:col-span-5 rounded-2xl border border-border/40 bg-card">
                            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
                                <span className="size-8 rounded-lg bg-blue-50 text-blue-600 inline-flex items-center justify-center shrink-0">
                                    <BarChart3 className="size-4" />
                                </span>
                                <div className="flex-1">
                                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Distribuição</div>
                                    <div className="text-[14px] font-semibold">{totalPlaced} de {total} posicionados</div>
                                </div>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                {[
                                    { l: "Top tier",          sub: "Estrela · Alto Pot.",   keys: ["3-3", "2-3", "3-2"], color: "#3B82F6" },
                                    { l: "Núcleo",            sub: "Núcleo · Especialista", keys: ["2-2", "3-1"],         color: "#EAB308" },
                                    { l: "Em desenvolvimento", sub: "Em Desenv. · Efetivo",  keys: ["1-2", "2-1"],         color: "#F97316" },
                                    { l: "Atenção",           sub: "Enigma · Questionável", keys: ["1-3", "1-1"],         color: "#EF4444" },
                                ].map((r, i) => {
                                    const count = itemsFiltrados.filter((it) => r.keys.includes(`${it.desempenho}-${it.potencial}`)).length;
                                    const pct = total ? Math.round((count / total) * 100) : 0;
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <span className="size-2 rounded-full shrink-0" style={{ background: r.color }} />
                                                    <span className="truncate font-medium">{r.l}</span>
                                                </span>
                                                <span className="tabular-nums text-muted-foreground text-[11.5px]">{count} · {pct}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                                            </div>
                                            <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{r.sub}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── Drawer ao clicar no header de um quadrante ── */}
            {drawerKey && (() => {
                const q = QUADRANTS[drawerKey];
                const ids = itemsFiltrados.filter((i) => `${i.desempenho}-${i.potencial}` === drawerKey);
                return (
                    <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawerKey(null)}>
                        <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.35)" }} />
                        <div
                            className="relative bg-card w-[420px] max-w-full h-full shadow-2xl flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-border/40" style={{ background: q.bg }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: q.title }}>Quadrante</div>
                                        <div className="text-[20px] font-semibold mt-0.5" style={{ color: q.title }}>{q.label}</div>
                                        <div className="text-[13px] mt-1" style={{ color: q.title, opacity: 0.8 }}>{q.desc}</div>
                                    </div>
                                    <button
                                        onClick={() => setDrawerKey(null)}
                                        className="size-8 rounded-lg hover:bg-white/40 inline-flex items-center justify-center"
                                        style={{ color: q.title }}
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 flex-1 overflow-y-auto">
                                <div className="text-[12px] text-muted-foreground mb-3">
                                    {ids.length} {ids.length === 1 ? "pessoa" : "pessoas"} neste quadrante
                                </div>
                                {ids.length === 0 && (
                                    <div className="text-[13px] text-muted-foreground italic text-center py-12">Nenhuma pessoa aqui ainda.</div>
                                )}
                                <div className="space-y-2">
                                    {ids.map((it) => (
                                        <div
                                            key={it.assessmentId}
                                            className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5 hover:border-border"
                                        >
                                            <Avatar seed={it.funcionarioId} name={it.funcionarioNome} size={36} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13.5px] font-semibold truncate">{it.funcionarioNome}</div>
                                                <div className="text-[11.5px] text-muted-foreground truncate">
                                                    {it.cargo ?? "—"}{it.areaNome ? ` · ${it.areaNome}` : ""}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setDrawerKey(null);
                                                    onChipClick(it);
                                                }}
                                                className="text-muted-foreground hover:text-foreground"
                                                title="Editar posicionamento"
                                            >
                                                <ChevronRight className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border-t border-border/40 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                        // Abre o primeiro como atalho de "edição em massa" — é só um quick action.
                                        if (ids[0]) {
                                            setDrawerKey(null);
                                            onChipClick(ids[0]);
                                        }
                                    }}
                                    disabled={ids.length === 0}
                                >
                                    <Edit3 className="size-3.5 mr-1.5" /> Recomendações
                                </Button>
                                <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                        // Abre painel de posicionar com a primeira pessoa unplaced.
                                        if (unplaced[0]) {
                                            setDrawerKey(null);
                                            setSelectedFuncionario(unplaced[0]);
                                        } else {
                                            toast.message("Não há funcionários pendentes.");
                                        }
                                    }}
                                >
                                    <Plus className="size-3.5 mr-1.5" /> Adicionar
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {selectedFuncionario && (
                <PosicionarModal
                    funcionario={selectedFuncionario}
                    currentAssessment={currentAssessment}
                    onClose={() => setSelectedFuncionario(null)}
                    onSaved={(funcionarioId, funcionarioNome, qKey) => {
                        setSelectedFuncionario(null);
                        load();
                        setPdiModal({ funcionarioId, funcionarioNome, qKey });
                    }}
                />
            )}

            {pdiModal && (
                <PdiConfirmModal
                    funcionarioNome={pdiModal.funcionarioNome}
                    qKey={pdiModal.qKey}
                    creating={creatingPdi}
                    onSkip={() => setPdiModal(null)}
                    onConfirm={async () => {
                        const tpl = PDI_TEMPLATES[pdiModal.qKey];
                        if (!tpl) { setPdiModal(null); return; }
                        setCreatingPdi(true);
                        try {
                            const prazo = new Date();
                            prazo.setMonth(prazo.getMonth() + 3);
                            const res = await apiFetch("/api/feedback/plans", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    targetUserId: pdiModal.funcionarioId,
                                    title: tpl.titulo,
                                    description: tpl.descricao,
                                    dueDate: prazo.toISOString(),
                                    goals: [],
                                }),
                            });
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            toast.success("PDI criado com sucesso!");
                        } catch {
                            toast.error("Erro ao criar PDI.");
                        } finally {
                            setCreatingPdi(false);
                            setPdiModal(null);
                        }
                    }}
                />
            )}
        </section>
    );
}
