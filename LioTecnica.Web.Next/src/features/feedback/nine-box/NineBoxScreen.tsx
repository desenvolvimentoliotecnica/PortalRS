"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { RefreshCw } from "lucide-react";
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
    areaNome: string | null;
}

// ──────────────────────────────────────────────
// Quadrant names and colors (3×3 matrix)
// ──────────────────────────────────────────────

// [desempenho 1-3][potencial 1-3]
const QUADRANT_NAMES: Record<string, string> = {
    "1-1": "Questionável",
    "1-2": "Em Desenvolvimento",
    "1-3": "Enigma",
    "2-1": "Efetivo",
    "2-2": "Núcleo",
    "2-3": "Alto Potencial",
    "3-1": "Especialista",
    "3-2": "Alto Desempenho",
    "3-3": "Estrela",
};

const QUADRANT_COLORS: Record<string, string> = {
    "1-1": "#fecaca", // red-200
    "1-2": "#fed7aa", // orange-200
    "1-3": "#fde68a", // amber-200
    "2-1": "#d1fae5", // emerald-100
    "2-2": "#a7f3d0", // emerald-200
    "2-3": "#6ee7b7", // emerald-300
    "3-1": "#bfdbfe", // blue-200
    "3-2": "#93c5fd", // blue-300
    "3-3": "#60a5fa", // blue-400
};

const QUADRANT_TEXT: Record<string, string> = {
    "1-1": "#991b1b",
    "1-2": "#9a3412",
    "1-3": "#92400e",
    "2-1": "#065f46",
    "2-2": "#064e3b",
    "2-3": "#064e3b",
    "3-1": "#1e3a8a",
    "3-2": "#1e3a8a",
    "3-3": "#1e40af",
};

function getInitials(nome: string): string {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
}

// ──────────────────────────────────────────────
// Posicionar modal
// ──────────────────────────────────────────────

// PDI templates por quadrante
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

interface PdiConfirmModalProps {
    funcionarioNome: string;
    qKey: string;
    onConfirm: () => void;
    onSkip: () => void;
    creating: boolean;
}

function PdiConfirmModal({ funcionarioNome, qKey, onConfirm, onSkip, creating }: PdiConfirmModalProps) {
    const tpl = PDI_TEMPLATES[qKey];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-center mb-4"
                    style={{ backgroundColor: QUADRANT_COLORS[qKey], color: QUADRANT_TEXT[qKey] }}
                >
                    {QUADRANT_NAMES[qKey]}
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
            toast.success(`${funcionario.name} posicionado em "${QUADRANT_NAMES[qKey]}"`);
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

                {/* Quadrant preview */}
                <div
                    className="rounded-xl px-4 py-3 mb-5 text-center font-semibold"
                    style={{
                        backgroundColor: QUADRANT_COLORS[qKey],
                        color: QUADRANT_TEXT[qKey],
                    }}
                >
                    {QUADRANT_NAMES[qKey]}
                </div>

                {/* Sliders */}
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
// Card de funcionário na célula
// ──────────────────────────────────────────────

function FuncionarioCard({ item, onClick }: { item: NineBoxItem; onClick: () => void }) {
    const color = QUADRANT_TEXT[`${item.desempenho}-${item.potencial}`] ?? "#374151";
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/70 hover:bg-white/90 px-2 py-1 text-left shadow-sm transition-colors w-full"
        >
            <div
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-[10px] font-bold"
                style={{ width: 24, height: 24, backgroundColor: color }}
            >
                {getInitials(item.funcionarioNome)}
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-900 truncate">{item.funcionarioNome}</p>
                {item.cargo && <p className="text-[9px] text-gray-500 truncate">{item.cargo}</p>}
            </div>
        </button>
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
    const [addingFuncionarioId, setAddingFuncionarioId] = useState("");
    const [pdiModal, setPdiModal] = useState<{ funcionarioId: string; funcionarioNome: string; qKey: string } | null>(null);
    const [creatingPdi, setCreatingPdi] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [matrizRes, funcRes] = await Promise.all([
                apiFetch("/api/nine-box/matriz", { cache: "no-store" }),
                apiFetch("/api/funcionarios?pageSize=200", { cache: "no-store" }),
            ]);
            if (matrizRes.ok) setItems(await matrizRes.json());
            if (funcRes.ok) {
                const data = await funcRes.json();
                const arr = Array.isArray(data) ? data : (data?.items ?? []);
                setFuncionarios(arr.map((f: { id: string; name: string; jobPositionName?: string | null; areaNome?: string | null }) => ({
                    id: f.id,
                    name: f.name,
                    cargo: f.jobPositionName ?? null,
                    areaNome: f.areaNome ?? null,
                })));
            }
        } catch {
            toast.error("Erro ao carregar Nine-Box.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Indexed by funcionarioId for quick lookup
    const assessmentByFuncionario = useMemo(() =>
        new Map(items.map((i) => [i.funcionarioId, i])),
        [items]
    );

    const funcionariosNaMatriz = useMemo(() => new Set(items.map((i) => i.funcionarioId)), [items]);

    const currentAssessment = selectedFuncionario
        ? (assessmentByFuncionario.get(selectedFuncionario.id) ?? null)
        : null;

    const handleCardClick = (item: NineBoxItem) => {
        const f = funcionarios.find((f) => f.id === item.funcionarioId);
        if (f) setSelectedFuncionario(f);
    };

    const handleAddFuncionario = () => {
        const f = funcionarios.find((f) => f.id === addingFuncionarioId);
        if (f) { setSelectedFuncionario(f); setAddingFuncionarioId(""); }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Carregando...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">Nine-in-Box</h2>
                <div className="flex items-center gap-2 ml-auto">
                    <select
                        value={addingFuncionarioId}
                        onChange={(e) => setAddingFuncionarioId(e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Posicionar funcionário...</option>
                        {funcionarios.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.name}{funcionariosNaMatriz.has(f.id) ? " ✓" : ""}
                            </option>
                        ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={handleAddFuncionario} disabled={!addingFuncionarioId}>
                        Posicionar
                    </Button>
                    <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Nine-Box Grid */}
            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                {/* Y axis label */}
                <div className="flex">
                    <div className="w-8 flex items-center justify-center">
                        <span
                            className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest"
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                            Potencial ↑
                        </span>
                    </div>
                    <div className="flex-1">
                        {/* 3 rows (potencial 3→1) */}
                        {[3, 2, 1].map((potencial) => (
                            <div key={potencial} className="flex border-b last:border-b-0">
                                {/* Row label */}
                                <div className="w-14 flex items-center justify-center border-r bg-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium">
                                        {["Baixo", "Médio", "Alto"][potencial - 1]}
                                    </span>
                                </div>
                                {/* 3 columns (desempenho 1→3) */}
                                {[1, 2, 3].map((desempenho) => {
                                    const qKey = `${desempenho}-${potencial}`;
                                    const cellItems = items.filter(
                                        (i) => i.desempenho === desempenho && i.potencial === potencial
                                    );
                                    return (
                                        <div
                                            key={desempenho}
                                            className="flex-1 min-h-[120px] p-2 border-r last:border-r-0 relative"
                                            style={{ backgroundColor: QUADRANT_COLORS[qKey] }}
                                        >
                                            <p
                                                className="text-[9px] font-semibold uppercase tracking-wide mb-2 opacity-80"
                                                style={{ color: QUADRANT_TEXT[qKey] }}
                                            >
                                                {QUADRANT_NAMES[qKey]}
                                            </p>
                                            <div className="space-y-1">
                                                {cellItems.map((item) => (
                                                    <FuncionarioCard
                                                        key={item.funcionarioId}
                                                        item={item}
                                                        onClick={() => handleCardClick(item)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {/* X axis labels */}
                        <div className="flex border-t bg-gray-50">
                            <div className="w-14" />
                            {["Baixo", "Médio", "Alto"].map((label) => (
                                <div key={label} className="flex-1 text-center py-1 border-r last:border-r-0">
                                    <span className="text-[10px] text-gray-500 font-medium">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* X axis overall label */}
                <div className="text-center py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest border-t bg-gray-50">
                    Desempenho →
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(QUADRANT_NAMES).map(([key, name]) => (
                    <span
                        key={key}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: QUADRANT_COLORS[key], color: QUADRANT_TEXT[key] }}
                    >
                        {name}
                    </span>
                ))}
            </div>

            {/* Summary */}
            <p className="text-xs text-gray-400">
                {items.length} funcionário{items.length !== 1 ? "s" : ""} posicionado{items.length !== 1 ? "s" : ""}.
                Clique em um card para rever o posicionamento.
            </p>

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
        </div>
    );
}
