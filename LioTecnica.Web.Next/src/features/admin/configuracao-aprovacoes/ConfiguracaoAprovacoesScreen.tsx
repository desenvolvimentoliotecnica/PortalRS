"use client";

import { useCallback, useEffect, useRef, useState, Fragment, type CSSProperties } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Save, Plus, ChevronUp, ChevronDown, Trash2, Settings2, Info, Zap, CheckCircle2, XCircle, Eye } from "lucide-react";

/* ──────────────────────────── constants ──────────────────────────── */

const TIPO_APROVADOR_OPTIONS: { value: number; label: string; desc: string; badge?: string }[] = [
    {
        value: 2,
        label: "Responsável da Unidade",
        desc: "O responsável cadastrado na própria unidade de lotação do solicitante.",
        badge: "Hierarquia",
    },
    {
        value: 3,
        label: "Responsável da Unidade Pai",
        desc: "O responsável da unidade imediatamente acima (nível gerência).",
        badge: "Hierarquia",
    },
    {
        value: 4,
        label: "Responsável da Unidade Raiz",
        desc: "O responsável da unidade no topo da hierarquia (nível diretoria).",
        badge: "Hierarquia",
    },
    {
        value: 0,
        label: "Gestor Direto",
        desc: "O gerente direto vinculado ao cadastro do funcionário solicitante.",
        badge: "Hierarquia",
    },
    {
        value: 1,
        label: "Gestor do Gestor",
        desc: "O gerente do gerente direto do solicitante (dois níveis acima).",
        badge: "Hierarquia",
    },
    {
        value: 5,
        label: "Funcionário Fixo",
        desc: "Sempre a mesma pessoa específica, independente de quem solicitou ou da hierarquia.",
        badge: "Fixo",
    },
    {
        value: 6,
        label: "Fila de Perfil",
        desc: "Todos os usuários do perfil selecionado veem a tarefa. O primeiro que agir assume e aprova.",
        badge: "Fila",
    },
    {
        value: 7,
        label: "Criar Vaga (Rascunho)",
        desc: "Etapa automática: o sistema cria a vaga em rascunho para o RH preencher e publicar. Avança imediatamente, sem necessidade de aprovador.",
        badge: "Processo",
    },
    {
        value: 9,
        label: "Revisão RH",
        desc: "Etapa manual: alguém do perfil selecionado revisa e completa os dados da vaga antes do envio à integração. Requer ação humana.",
        badge: "Processo",
    },
    {
        value: 8,
        label: "Enviar para Integração",
        desc: "Etapa automática: finaliza o fluxo e envia os dados para integração com TOTVS. Deve ser a etapa final do fluxo.",
        badge: "Processo",
    },
];

interface ProcessStepDef {
    tipoAprovador: number;
    label: string;
    /** If true, step is not required but MUST appear in this position in the sequence if added. */
    optional?: boolean;
}

/**
 * Defines the mandatory process sequence for each flow (key = TipoFluxo).
 * Non-optional steps block saving if absent. ALL present process steps must
 * respect the order defined here — e.g. "Revisão RH" after "Criar Vaga".
 */
const PROCESS_SEQUENCE_BY_FLOW: Record<number, ProcessStepDef[]> = {
    1: [
        { tipoAprovador: 7, label: "Criar Vaga (Rascunho)" },
        { tipoAprovador: 9, label: "Revisão RH", optional: true },
        { tipoAprovador: 8, label: "Enviar para Integração" },
    ],
    2: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Promoção
    3: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Desligamento
    4: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Férias
    5: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Benefícios
    6: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Dependentes
    7: [{ tipoAprovador: 8, label: "Enviar para Integração" }], // Endereço
    8: [], // Aumento de Headcount — etapas definidas livremente pelo admin (ex.: Diretoria)
};

const TABS = [
    { value: 1, label: "Requisição de Vaga" },
    { value: 2, label: "Promoção" },
    { value: 3, label: "Desligamento" },
    { value: 4, label: "Férias" },
    { value: 5, label: "Benefícios" },
    { value: 6, label: "Dependentes" },
    { value: 7, label: "Endereço" },
    { value: 8, label: "Aumento de Headcount" },
];


/* ──────────────────────────── types ──────────────────────────── */

interface EtapaConfigDto {
    id?: string;
    ordem: number;
    label: string;
    tipoAprovador: number;
    funcionarioFixoId: string | null;
    funcionarioFixoNome: string | null;
    roleFilaId: string | null;
    roleFilaNome: string | null;
    ativo: boolean;
}

interface LookupItem {
    id: string;
    name: string;
}

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    value,
    onChange,
    placeholder,
}: {
    items: LookupItem[];
    value: string | null;
    onChange: (id: string | null, name: string | null) => void;
    placeholder: string;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = items.find((i) => i.id === value) ?? null;
    const filtered = query.trim()
        ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
        : items;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className="flex gap-1">
                <input
                    className="h-9 flex-1 rounded-md border border-input px-3 text-sm bg-background"
                    placeholder={`Buscar ${placeholder}...`}
                    value={open ? query : (selected?.name ?? "")}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => { onChange(null, null); setQuery(""); }}
                        className="px-2 text-muted-foreground hover:text-foreground text-xs"
                        tabIndex={-1}
                    >✕</button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                    ) : (
                        filtered.slice(0, 80).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(item.id, item.name);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.name}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── SimpleDescSelect ──────────────────────────── */

function SimpleDescSelect({
    options,
    value,
    onChange,
    width = 200,
}: {
    options: { value: number; label: string; desc: string }[];
    value: number;
    onChange: (v: number) => void;
    width?: number;
}) {
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selected = options.find((o) => o.value === value) ?? options[0];

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleOpen() {
        if (!triggerRef.current) { setOpen((v) => !v); return; }
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownH = options.length * 64;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < dropdownH && rect.top > spaceBelow;
        if (openUpward) {
            setDropdownStyle({ position: "fixed", bottom: window.innerHeight - rect.top + 4, left: rect.left, width, zIndex: 9999 });
        } else {
            setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width, zIndex: 9999 });
        }
        setOpen((v) => !v);
    }

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={handleOpen}
                className="h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/30 transition-colors"
            >
                <span className="truncate">{selected.label}</span>
                <ChevronDown className={`size-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div ref={dropdownRef} style={dropdownStyle} className="rounded-lg border border-input bg-background shadow-xl overflow-y-auto max-h-[60vh]">
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>{opt.label}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</div>
                                </div>
                                {isSelected && <span className="flex-shrink-0 mt-0.5 text-primary text-xs font-bold">✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── TipoAprovadorSelect ──────────────────────────── */

const BADGE_STYLES: Record<string, { badge: string; header: string }> = {
    Hierarquia: {
        badge: "bg-blue-500/10 text-blue-700 border border-blue-200",
        header: "text-blue-600 border-b border-blue-100 bg-blue-50/60",
    },
    Fixo: {
        badge: "bg-orange-500/10 text-orange-700 border border-orange-200",
        header: "text-orange-700 border-b border-orange-100 bg-orange-50/60",
    },
    Fila: {
        badge: "bg-violet-500/10 text-violet-700 border border-violet-200",
        header: "text-violet-700 border-b border-violet-100 bg-violet-50/60",
    },
    Processo: {
        badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-200",
        header: "text-emerald-700 border-b border-emerald-100 bg-emerald-50/60",
    },
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
    Hierarquia: "Aprovador resolvido automaticamente pela estrutura organizacional",
    Fixo: "Sempre a mesma pessoa, independente da hierarquia",
    Fila: "Qualquer membro do perfil pode assumir e aprovar",
    Processo: "Etapa do processo RH — automática (sistema executa) ou revisão manual",
};

function TipoAprovadorSelect({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selected = TIPO_APROVADOR_OPTIONS.find((o) => o.value === value) ?? TIPO_APROVADOR_OPTIONS[0];

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Calculate fixed position when opening
    function handleOpen() {
        if (!triggerRef.current) { setOpen((v) => !v); return; }
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownH = 380; // approximate max height
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUpward = spaceBelow < dropdownH && spaceAbove > spaceBelow;

        if (openUpward) {
            setDropdownStyle({
                position: "fixed",
                bottom: window.innerHeight - rect.top + 4,
                left: rect.left,
                width: 384,
                zIndex: 9999,
            });
        } else {
            setDropdownStyle({
                position: "fixed",
                top: rect.bottom + 4,
                left: rect.left,
                width: 384,
                zIndex: 9999,
            });
        }
        setOpen((v) => !v);
    }

    // Group options by badge
    const groups: { badge: string; items: typeof TIPO_APROVADOR_OPTIONS }[] = [];
    for (const opt of TIPO_APROVADOR_OPTIONS) {
        const badge = opt.badge ?? "";
        const existing = groups.find((g) => g.badge === badge);
        if (existing) existing.items.push(opt);
        else groups.push({ badge, items: [opt] });
    }

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={handleOpen}
                className="h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/30 transition-colors"
            >
                <span className="flex items-center gap-2 min-w-0">
                    {selected.badge && (
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${BADGE_STYLES[selected.badge]?.badge ?? ""}`}>
                            {selected.badge}
                        </span>
                    )}
                    <span className="truncate">{selected.label}</span>
                </span>
                <ChevronDown className={`size-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown — rendered with fixed positioning to escape any overflow:hidden parent */}
            {open && (
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    className="rounded-lg border border-input bg-background shadow-xl overflow-y-auto max-h-[60vh]"
                >
                    {groups.map(({ badge, items }) => (
                        <div key={badge}>
                            {/* Group header */}
                            <div className={`px-3 py-2 flex items-center gap-2 ${BADGE_STYLES[badge]?.header ?? ""}`}>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${BADGE_STYLES[badge]?.badge ?? ""}`}>
                                    {badge}
                                </span>
                                <span className="text-[11px] font-medium">{GROUP_DESCRIPTIONS[badge]}</span>
                            </div>
                            {/* Items */}
                            {items.map((opt) => {
                                const isSelected = opt.value === value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onChange(opt.value);
                                            setOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                                                {opt.label}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                {opt.desc}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <span className="flex-shrink-0 mt-0.5 text-primary text-xs font-bold">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── EtapaRow ──────────────────────────── */

function EtapaRow({
    etapa,
    index,
    total,
    funcionarios,
    roles,
    onChange,
    onMoveUp,
    onMoveDown,
    onRemove,
}: {
    etapa: EtapaConfigDto;
    index: number;
    total: number;
    funcionarios: LookupItem[];
    roles: LookupItem[];
    onChange: (updated: EtapaConfigDto) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
}) {
    const isFilaDePerfil = etapa.tipoAprovador === 6;
    const isFuncionarioFixo = etapa.tipoAprovador === 5;
    const isAutoProcesso = etapa.tipoAprovador === 7 || etapa.tipoAprovador === 8; // CriarVagaRascunho | EnviarIntegracao
    const isRevisaoRH = etapa.tipoAprovador === 9;

    function handleTipoChange(newTipo: number) {
        const usaFila = newTipo === 6 || newTipo === 9;
        onChange({
            ...etapa,
            tipoAprovador: newTipo,
            funcionarioFixoId: newTipo === 5 ? etapa.funcionarioFixoId : null,
            funcionarioFixoNome: newTipo === 5 ? etapa.funcionarioFixoNome : null,
            roleFilaId: usaFila ? etapa.roleFilaId : null,
            roleFilaNome: usaFila ? etapa.roleFilaNome : null,
        });
    }

    return (
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3 space-y-2">
            {/* Linha principal — todos os campos side by side */}
            <div className="flex items-center gap-3">
                {/* Número */}
                <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                </span>

                {/* Nome da etapa */}
                <div className="flex-1 min-w-0">
                    <input
                        className="h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                        placeholder="Nome da etapa (ex: Responsável, Compliance, RH…)"
                        value={etapa.label}
                        onChange={(e) => onChange({ ...etapa, label: e.target.value })}
                    />
                </div>

                {/* Tipo de aprovador — custom dropdown descritivo */}
                <div className="w-72 flex-shrink-0">
                    <TipoAprovadorSelect value={etapa.tipoAprovador} onChange={handleTipoChange} />
                </div>

                {/* Campo condicional (ocupa espaço fixo para não deslocar botões) */}
                <div className="w-60 flex-shrink-0">
                    {isAutoProcesso ? (
                        <span className="flex items-center h-9 px-3 text-xs text-emerald-600 italic gap-1.5">
                            <Zap className="size-3 flex-shrink-0" /> Etapa automática
                        </span>
                    ) : isFuncionarioFixo ? (
                        <AutocompleteSelect
                            items={funcionarios}
                            value={etapa.funcionarioFixoId}
                            onChange={(id, name) => onChange({ ...etapa, funcionarioFixoId: id, funcionarioFixoNome: name })}
                            placeholder="funcionário"
                        />
                    ) : isFilaDePerfil || isRevisaoRH ? (
                        <select
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={etapa.roleFilaId ?? ""}
                            onChange={(e) => {
                                const sel = roles.find((r) => r.id === e.target.value);
                                onChange({ ...etapa, roleFilaId: e.target.value || null, roleFilaNome: sel?.name ?? null });
                            }}
                        >
                            <option value="">Selecionar perfil…</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="flex items-center h-9 px-3 text-xs text-muted-foreground italic">
                            Resolvido pela hierarquia
                        </span>
                    )}
                </div>

                {/* Reorder + delete */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={index === 0}
                        className="p-1.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                        title="Mover para cima"
                    >
                        <ChevronUp className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={index === total - 1}
                        className="p-1.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                        title="Mover para baixo"
                    >
                        <ChevronDown className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                        title="Remover etapa"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </div>

        </div>
    );
}

/* ──────────────────────────── FlowPreview ──────────────────────────── */

function FlowPreview({ etapas }: { etapas: EtapaConfigDto[] }) {
    if (etapas.length === 0) return null;

    return (
        <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-2.5">
                <Eye className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Preview do Fluxo
                </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
                {/* Início */}
                <div className="flex-shrink-0 flex items-center justify-center h-8 px-3 rounded-full bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-600">
                    Início
                </div>

                {etapas.map((etapa, idx) => {
                    const opt = TIPO_APROVADOR_OPTIONS.find((o) => o.value === etapa.tipoAprovador);
                    const badge = opt?.badge ?? "";
                    const isAuto = etapa.tipoAprovador === 7 || etapa.tipoAprovador === 8;

                    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
                        Hierarquia: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
                        Fixo:       { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700" },
                        Fila:       { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-700" },
                        Processo:   { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
                    };
                    const colors = colorMap[badge] ?? { bg: "bg-muted", border: "border-border", text: "text-foreground" };

                    return (
                        <div key={idx} className="flex items-center gap-1 flex-shrink-0">
                            {/* Arrow */}
                            <svg width="14" height="10" viewBox="0 0 14 10" className="text-muted-foreground/50 flex-shrink-0">
                                <path d="M0 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {/* Node */}
                            <div
                                className={`flex-shrink-0 flex flex-col items-center justify-center h-auto min-h-8 px-2.5 py-1.5 rounded-lg border ${colors.bg} ${colors.border} ${colors.text} max-w-36`}
                                title={opt?.desc ?? ""}
                            >
                                <span className="text-[10px] font-bold opacity-60 uppercase tracking-wide">{idx + 1}</span>
                                <span className="text-xs font-medium text-center leading-tight truncate max-w-full">
                                    {etapa.label || opt?.label || "—"}
                                </span>
                                {isAuto && (
                                    <span className="flex items-center gap-0.5 text-[9px] opacity-70 mt-0.5">
                                        <Zap className="size-2.5" /> automático
                                    </span>
                                )}
                                {etapa.funcionarioFixoNome && (
                                    <span className="text-[9px] opacity-70 truncate max-w-full">{etapa.funcionarioFixoNome}</span>
                                )}
                                {etapa.roleFilaNome && (
                                    <span className="text-[9px] opacity-70 truncate max-w-full">{etapa.roleFilaNome}</span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Fim */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <svg width="14" height="10" viewBox="0 0 14 10" className="text-muted-foreground/50 flex-shrink-0">
                        <path d="M0 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex-shrink-0 flex items-center justify-center h-8 px-3 rounded-full bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-600">
                        Fim
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── FluxoTab ──────────────────────────── */

function FluxoTab({
    tipoFluxo,
    funcionarios,
    roles,
}: {
    tipoFluxo: number;
    funcionarios: LookupItem[];
    roles: LookupItem[];
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [etapas, setEtapas] = useState<EtapaConfigDto[]>([]);
    const [referenciaUnidade, setReferenciaUnidade] = useState<number>(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [etapasRes, globalRes] = await Promise.all([
                apiFetch(`/api/etapas-config-aprovacao/${tipoFluxo}`),
                apiFetch(`/api/etapas-config-aprovacao/${tipoFluxo}/global`),
            ]);
            const data = await etapasRes.json() as EtapaConfigDto[];
            const globalData = await globalRes.json() as { referenciaUnidade: number };
            // API may return tipoAprovador as enum name string — convert to number
            const TIPO_NAME_MAP: Record<string, number> = {
                GestorDireto: 0, GestorDoGestor: 1, ResponsavelUnidade: 2,
                ResponsavelUnidadePai: 3, ResponsavelUnidadeRaiz: 4,
                FuncionarioFixo: 5, FilaDePerfil: 6,
                CriarVagaRascunho: 7, EnviarIntegracao: 8, RevisaoRH: 9,
            };
            const normalized = (Array.isArray(data) ? data : []).map(e => ({
                ...e,
                tipoAprovador: typeof e.tipoAprovador === "string" && isNaN(Number(e.tipoAprovador))
                    ? (TIPO_NAME_MAP[e.tipoAprovador] ?? 0)
                    : Number(e.tipoAprovador),
            }));
            setEtapas(normalized);
            setReferenciaUnidade(globalData?.referenciaUnidade ?? 0);
        } catch {
            toast.error("Falha ao carregar etapas.");
        } finally {
            setLoading(false);
        }
    }, [tipoFluxo]);

    useEffect(() => { void load(); }, [load]);

    function addEtapa() {
        setEtapas((prev) => [
            ...prev,
            {
                ordem: prev.length + 1,
                label: "",
                tipoAprovador: 2,
                funcionarioFixoId: null,
                funcionarioFixoNome: null,
                roleFilaId: null,
                roleFilaNome: null,
                ativo: true,
            },
        ]);
    }

    function removeEtapa(index: number) {
        setEtapas((prev) => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, ordem: i + 1 })));
    }

    function moveUp(index: number) {
        if (index === 0) return;
        setEtapas((prev) => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next.map((e, i) => ({ ...e, ordem: i + 1 }));
        });
    }

    function moveDown(index: number) {
        setEtapas((prev) => {
            if (index >= prev.length - 1) return prev;
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next.map((e, i) => ({ ...e, ordem: i + 1 }));
        });
    }

    function updateEtapa(index: number, updated: EtapaConfigDto) {
        setEtapas((prev) => prev.map((e, i) => (i === index ? updated : e)));
    }

    async function save() {
        const sequenceDefs = PROCESS_SEQUENCE_BY_FLOW[tipoFluxo] ?? [];
        if (sequenceDefs.length > 0) {
            const presentTipos = new Set(etapas.map((e) => e.tipoAprovador));

            // 1) Required steps must be present
            const missing = sequenceDefs.filter((d) => !d.optional && !presentTipos.has(d.tipoAprovador));
            if (missing.length > 0) {
                toast.error(`Etapas obrigatórias ausentes: ${missing.map((d) => d.label).join(", ")}.`);
                return;
            }

            // 2) Present process steps must respect the defined sequence order
            const presentInSeq = sequenceDefs.filter((d) => presentTipos.has(d.tipoAprovador));
            for (let si = 1; si < presentInSeq.length; si++) {
                const prevOrdem = etapas.find((e) => e.tipoAprovador === presentInSeq[si - 1].tipoAprovador)!.ordem;
                const currOrdem = etapas.find((e) => e.tipoAprovador === presentInSeq[si].tipoAprovador)!.ordem;
                if (currOrdem <= prevOrdem) {
                    toast.error(`Sequência incorreta: "${presentInSeq[si - 1].label}" deve aparecer antes de "${presentInSeq[si].label}".`);
                    return;
                }
            }

            // 3) "Enviar para Integração" must be the last step
            const enviarIdx = etapas.findIndex((e) => e.tipoAprovador === 8);
            if (enviarIdx !== -1 && enviarIdx !== etapas.length - 1) {
                toast.error('"Enviar para Integração" deve ser a última etapa do fluxo.');
                return;
            }
        }

        for (let i = 0; i < etapas.length; i++) {
            if (!etapas[i].label.trim()) {
                toast.error(`Etapa ${i + 1}: preencha o nome da etapa.`);
                return;
            }
            if (etapas[i].tipoAprovador === 5 && !etapas[i].funcionarioFixoId) {
                toast.error(`Etapa ${i + 1}: selecione o funcionário fixo.`);
                return;
            }
            if ((etapas[i].tipoAprovador === 6 || etapas[i].tipoAprovador === 9) && !etapas[i].roleFilaId) {
                toast.error(`Etapa ${i + 1}: selecione o perfil.`);
                return;
            }
        }

        setSaving(true);
        try {
            const [etapasRes, globalRes] = await Promise.all([
                apiFetch(`/api/etapas-config-aprovacao/${tipoFluxo}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(etapas),
                }),
                apiFetch(`/api/etapas-config-aprovacao/${tipoFluxo}/global`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ referenciaUnidade }),
                }),
            ]);
            if (!etapasRes.ok || !globalRes.ok) throw new Error("Falha ao salvar.");
            toast.success("Configuração salva com sucesso!");
            await load();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
            </div>
        );
    }

    const sequenceDefs = PROCESS_SEQUENCE_BY_FLOW[tipoFluxo] ?? [];
    const presentTipos = new Set(etapas.map((e) => e.tipoAprovador));

    return (
        <div className="space-y-3">
            {/* Process sequence indicator */}
            {sequenceDefs.length > 0 && (
                <div className="rounded-lg bg-muted/40 border border-border/40 px-4 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sequência do processo (obrigatória):</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {sequenceDefs.map((def, idx) => {
                            const present = presentTipos.has(def.tipoAprovador);
                            return (
                                <Fragment key={def.tipoAprovador}>
                                    {idx > 0 && (
                                        <span className="text-muted-foreground text-xs select-none">→</span>
                                    )}
                                    <span
                                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                                            present
                                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                                : def.optional
                                                    ? "bg-muted/60 text-muted-foreground border-border"
                                                    : "bg-red-500/10 text-red-700 border-red-200"
                                        }`}
                                    >
                                        {present ? (
                                            <CheckCircle2 className="size-3 flex-shrink-0" />
                                        ) : def.optional ? (
                                            <span className="size-3 inline-flex items-center justify-center text-[9px] opacity-60">○</span>
                                        ) : (
                                            <XCircle className="size-3 flex-shrink-0" />
                                        )}
                                        {def.label}
                                        {def.optional && (
                                            <span className="opacity-60 text-[9px] ml-0.5">(opcional)</span>
                                        )}
                                    </span>
                                </Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Column headers */}
            {etapas.length > 0 && (
                <div className="flex items-center gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="w-7 flex-shrink-0" />
                    <span className="flex-1">Nome da etapa</span>
                    <span className="w-72 flex-shrink-0">Tipo de aprovador</span>
                    <span className="w-60 flex-shrink-0">Pessoa / Perfil</span>
                    <span className="w-20 flex-shrink-0" />
                </div>
            )}

            {/* Live flow preview */}
            <FlowPreview etapas={etapas} />

            {etapas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-12 text-center text-muted-foreground text-sm">
                    Nenhuma etapa configurada. Clique em &quot;Adicionar etapa&quot; para definir o fluxo de aprovação.
                </div>
            ) : (
                <div className="space-y-2">
                    {etapas.map((etapa, index) => (
                        <EtapaRow
                            key={index}
                            etapa={etapa}
                            index={index}
                            total={etapas.length}
                            funcionarios={funcionarios}
                            roles={roles}
                            onChange={(updated) => updateEtapa(index, updated)}
                            onMoveUp={() => moveUp(index)}
                            onMoveDown={() => moveDown(index)}
                            onRemove={() => removeEtapa(index)}
                        />
                    ))}
                </div>
            )}

            {/* Global config */}
            <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 space-y-2.5">
                <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Parâmetros Globais do Fluxo</span>
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Referência de Lotação
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                        Define qual lotação o sistema usa ao resolver aprovadores do tipo <strong>Responsável da Unidade</strong>, <strong>Unidade Pai</strong> e <strong>Unidade Raiz</strong>.
                    </p>
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full max-w-sm"
                        value={referenciaUnidade}
                        onChange={(e) => setReferenciaUnidade(Number(e.target.value))}
                    >
                        <option value={0}>Lotação do solicitante (quem está registrando)</option>
                        <option value={1}>Lotação informada na solicitação</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" onClick={addEtapa}>
                    <Plus className="size-4 mr-1.5" />
                    Adicionar etapa
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                    <Save className="size-4 mr-1.5" />
                    {saving ? "Salvando…" : "Salvar configuração"}
                </Button>
            </div>
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function ConfiguracaoAprovacoesScreen() {
    const [activeTab, setActiveTab] = useState(1);
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);
    const [roles, setRoles] = useState<LookupItem[]>([]);
    const [lookupLoading, setLookupLoading] = useState(true);

    useEffect(() => {
        async function loadLookups() {
            setLookupLoading(true);
            try {
                const [funcsRes, rolesRes] = await Promise.all([
                    apiFetch("/api/lookup/funcionarios?pageSize=500").then((r) => r.json()),
                    apiFetch("/api/lookup/roles").then((r) => r.json()),
                ]);

                const funcs = Array.isArray(funcsRes)
                    ? funcsRes
                    : Array.isArray(funcsRes?.items)
                        ? (funcsRes.items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                        : [];
                setFuncionarios(funcs as LookupItem[]);

                const rolesData = Array.isArray(rolesRes) ? rolesRes as { id: string; name: string }[] : [];
                setRoles(rolesData.map((r) => ({ id: r.id, name: r.name })));
            } catch {
                toast.error("Falha ao carregar dados de suporte.");
            } finally {
                setLookupLoading(false);
            }
        }
        void loadLookups();
    }, []);

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Settings2 className="size-5 text-muted-foreground" />
                        Configuração de Aprovações
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Configure a cadeia de aprovação para cada tipo de solicitação. As etapas são executadas em ordem.
                    </p>
                </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-700 dark:text-blue-300">
                <Info className="size-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                    <p><strong>Aprovador resolvido</strong> — a pessoa é determinada automaticamente pela hierarquia de unidades. Apenas ela aprova.</p>
                    <p><strong>Fila de Perfil</strong> — todos os usuários do perfil veem a solicitação. O primeiro que aprovar assume a tarefa.</p>
                    <p><strong>Funcionário Fixo</strong> — sempre a mesma pessoa, independente da hierarquia.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="rounded-xl border border-border/40 bg-card">
                {/* Tab headers */}
                <div className="flex border-b border-border/40">
                    {TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.value
                                ? "border-b-2 border-primary text-foreground bg-muted/30"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="p-6">
                    {lookupLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                        </div>
                    ) : (
                        TABS.map((tab) =>
                            activeTab === tab.value ? (
                                <FluxoTab
                                    key={tab.value}
                                    tipoFluxo={tab.value}
                                    funcionarios={funcionarios}
                                    roles={roles}
                                />
                            ) : null
                        )
                    )}
                </div>
            </div>
        </section>
    );
}
