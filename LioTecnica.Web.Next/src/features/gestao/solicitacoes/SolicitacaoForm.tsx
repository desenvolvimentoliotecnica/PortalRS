"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    normalizeSolicitacaoStatusOrdinal,
    SolicitacaoVagaOrdinal,
} from "@/features/gestao/shared/solicitacaoVagaStatusUi";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HorarioEditor } from "@/components/gestao/HorarioEditor";

/* ──────────────────────────── types ──────────────────────────── */

interface LookupItem {
    id: string;
    name: string;
    code?: string;
}

interface RmParecerItem {
    idParecer: number;
    dataParecer: string | null;
    codStatus: number | string | null;
    status: string | null;
    solicitante: string | null;
    chapaSolicitante: string | null;
    parecer: string | null;
}

export interface SolicitacaoDraft {
    titulo: string;
    justificativa: string;
    qtdPosicoes: number;
    urgencia: number;
    jobPositionId: string | null;
    /** Nome do cargo vindo do GET (quando não está na lista lookup). */
    jobPositionName: string | null;
    /** Faixa proposta — máscara moeda BRL (ex.: R$ 3.500,00); convertida para decimal no submit. */
    faixaSalarialMin: string;
    faixaSalarialMax: string;
    /** Fluxo único de nova posição (sem escolha “do quadro de vagas”). */
    origemVaga: "nova";
    unitId: string | null;
    aprovadorId: string | null;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoFuncionarioId: string | null;
    tipoContrato: number;
    prazoDias: number | null;
    /** FK do motivo parametrizável (tabela MotivosRequisicaoVagaConfig). */
    motivoRequisicaoId: string | null;
    cnhObrigatoria: boolean;
    disponibilidadeViagens: boolean;
    /** Turno do cadastro TOTVS (preferencial). */
    turnoId: string | null;
    /** Texto/JSON legado quando não há turno vinculado. */
    escalaTrabalho: string;
    empresaId: string | null;
    centroCustoId: string | null;
    /** Vaga pré-vinculada quando solicitação é criada a partir do painel de vagas */
    vagaId: string | null;
    /** Função RM (PFUNCAO) — lista filtrada pelo centro de custo da solicitação. */
    codFuncaoRm: string | null;
    funcaoNomeRm: string | null;
    // Dados do desligamento (só preenchem quando motivoRequisicao ∈ {1, 2})
    dataDesligamento: string | null; // yyyy-MM-dd
    tipoAvisoPrevioDesligamento: number | null; // 0=Indenizado, 1=Trabalhado, 2=Dispensado
    diasAvisoPrevioDesligamento: number | null;
    possuiEstabilidadeDesligamento: boolean | null;
    motivoDesligamentoTexto: string;
    // Decisão de headcount (escolhida pelo gestor; obrigatória para VagaNova antes de submeter)
    decisaoRH: number | null; // 1=SubstituicaoProvisoria, 2=AumentoDefinitivo, 3=ConsumirHeadcountExistente
    decisaoRHPrazoMeses: number | null;
    decisaoRHPrazoDataAlvo: string | null; // ISO datetime
}

export interface SolicitacaoFormProps {
    /** When false, effects and loads are skipped (e.g. dialog closed). */
    active: boolean;
    editId: string | null;
    onCancel: () => void;
    onSuccess: () => void;
    viewOnly?: boolean;
    hideFooter?: boolean;
    resubmitAfterSave?: boolean;
    copySourceId?: string | null;
    initialData?: Partial<SolicitacaoDraft> | null;
    /** Bump when re-opening the same id to force refetch (avoids stale draft). */
    reloadNonce?: number;
}

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-vaga";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const emptyDraft: SolicitacaoDraft = {
    titulo: "",
    justificativa: "",
    qtdPosicoes: 1,
    urgencia: 1,
    jobPositionId: null,
    jobPositionName: null,
    faixaSalarialMin: "",
    faixaSalarialMax: "",
    origemVaga: "nova",
    unitId: null,
    aprovadorId: null,
    tipoSolicitacao: 0,
    isConfidencial: false,
    substituidoFuncionarioId: null,
    tipoContrato: 0,
    prazoDias: null,
    motivoRequisicaoId: null,
    cnhObrigatoria: false,
    disponibilidadeViagens: false,
    turnoId: null,
    escalaTrabalho: "",
    empresaId: null,
    centroCustoId: null,
    vagaId: null,
    codFuncaoRm: null,
    funcaoNomeRm: null,
    dataDesligamento: null,
    tipoAvisoPrevioDesligamento: null,
    diasAvisoPrevioDesligamento: 30,
    possuiEstabilidadeDesligamento: null,
    motivoDesligamentoTexto: "",
    decisaoRH: null,
    decisaoRHPrazoMeses: 3,
    decisaoRHPrazoDataAlvo: null,
};

const MAX_BRL_CENT_DIGITS = 15;

/** Exibe valor a partir de string só com dígitos (centavos implícitos: últimos 2 = decimais). */
function formatBrlCurrencyFromDigits(digits: string): string {
    const d = digits.replace(/\D/g, "").slice(0, MAX_BRL_CENT_DIGITS);
    if (!d) return "";
    const cents = parseInt(d, 10);
    if (!Number.isFinite(cents)) return "";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(cents / 100);
}

/** Converte campo mascarado (R$ … ou só dígitos) em decimal. */
function parseBrlCurrencyInput(masked: string): number | null {
    const digits = (masked || "").replace(/\D/g, "");
    if (!digits) return null;
    const cents = parseInt(digits, 10);
    return Number.isFinite(cents) ? cents / 100 : null;
}

/** Converte texto legado (API / Excel) para decimal — aceita BR e invariante simples. */
function parseLegacyDecimalString(s: string): number | null {
    const t = s.trim().replace(/\s/g, "");
    if (!t) return null;
    if (/,/.test(t) && /\./.test(t)) {
        const normalized = t.replace(/\./g, "").replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
    }
    if (/,/.test(t)) {
        const n = Number(t.replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Parse valores monetários do GET (number ou string legada) para máscara BRL. */
function moneyFieldFromApi(raw: unknown): string {
    if (raw == null) return "";
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return formatBrlCurrencyFromDigits(String(Math.round(raw * 100)));
    }
    const s = String(raw).trim();
    if (!s) return "";
    if (/R\$/i.test(s)) {
        const d = s.replace(/\D/g, "");
        return d ? formatBrlCurrencyFromDigits(d) : "";
    }
    const legacyNum = parseLegacyDecimalString(s);
    if (legacyNum != null) {
        return formatBrlCurrencyFromDigits(String(Math.round(legacyNum * 100)));
    }
    const digitsOnly = s.replace(/\D/g, "");
    return digitsOnly ? formatBrlCurrencyFromDigits(digitsOnly) : "";
}

/** Alias semântico para submit (somente dígitos da máscara → decimal). */
function parseDecimalBrInput(s: string): number | null {
    return parseBrlCurrencyInput(s);
}

/** Proposta salarial obrigatória quando informada no fluxo de criação/edição. `null` = sem erro. */
function propostaSalarialMensagemErro(valueStr: string): string | null {
    const trimmed = (valueStr ?? "").trim();
    const value = parseDecimalBrInput(valueStr);
    if (!trimmed) return null;
    if (value == null) return "Informe a proposta salarial.";
    return null;
}

/** Colagem: aceita valor já mascarado, decimal BR/invariante, ou só dígitos como reais inteiros. */
function applyPastedMoneyToField(t: string): string | null {
    const trimmed = t.trim();
    if (!trimmed) return null;
    if (/R\$/i.test(trimmed)) {
        const d = trimmed.replace(/\D/g, "");
        return d ? formatBrlCurrencyFromDigits(d) : null;
    }
    const legacy = parseLegacyDecimalString(trimmed);
    if (legacy != null && legacy >= 0) {
        return formatBrlCurrencyFromDigits(String(Math.round(legacy * 100)));
    }
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return null;
    const intReais = parseInt(digits, 10);
    if (!Number.isFinite(intReais) || intReais < 0) return null;
    return formatBrlCurrencyFromDigits(String(intReais * 100));
}

/** Bloqueia teclas que não sejam dígito (atalhos Ctrl/Cmd + V/A/C/X etc. continuam liberados). */
function blockNonDigitMoneyKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const nav = [
        "Backspace", "Delete", "Tab", "Escape", "Enter",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
    ];
    if (nav.includes(e.key)) return;
    if (e.key.length === 1 && /\d/.test(e.key)) return;
    e.preventDefault();
}

/** Rótulos próximos ao RM (TOTVS) para mesma linguagem nas telas. */
const LB = {
    empresa: "Empresa *",
    filial: "Filial *",
    secao: "Seção *",
    funcao: "Função *",
    cargoOpcional: "Cargo",
    cargoObrig: "Cargo *",
    faixaMin: "Proposta Salarial *",
    tipoSolicitacao: "Tipo de solicitação",
    motivo: "Motivo *",
    justificativa: "Justificativa",
    justificativaObrig: "Justificativa *",
    secaoTituloReq: "Dados da requisição",
};

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    value,
    onChange,
    placeholder,
    required,
    disabled,
}: {
    items: LookupItem[];
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (disabled) return;
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [disabled]);

    const selected = items.find((i) => i.id === value) ?? null;
    const displayText = selected
        ? selected.code
            ? selected.name && selected.name !== selected.code
                ? `${selected.code} – ${selected.name}`
                : selected.code
            : selected.name
        : "";

    if (disabled) {
        return (
            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                {displayText || <span className="italic opacity-40">—</span>}
            </div>
        );
    }

    const filtered = query.trim()
        ? items.filter((i) => {
              const q = query.toLowerCase();
              return i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q));
          })
        : items;

    return (
        <div ref={containerRef} className="relative">
            <div className="flex gap-1">
                <input
                    className={`h-9 flex-1 rounded-md border px-3 text-sm bg-background ${required && !value ? "border-red-400" : "border-input"}`}
                    placeholder={`Buscar ${placeholder}...`}
                    value={open ? query : displayText}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button type="button" onClick={() => { onChange(null); setQuery(""); }} className="px-2 text-muted-foreground hover:text-foreground text-xs" tabIndex={-1}>✕</button>
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
                                onMouseDown={(e) => { e.preventDefault(); onChange(item.id); setOpen(false); setQuery(""); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.code && <span className="text-xs text-muted-foreground font-mono w-20 shrink-0 truncate">{item.code}</span>}
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/** Compõe id estável para AutocompleteSelect (codigo + nome da função RM). */
function funcaoRmOptionId(codigo: string, nome: string | null | undefined) {
    return `${codigo}\t${nome ?? ""}`;
}

/** Valor persistido em <c>Titulo</c> na API: nome da função RM, ou código se o nome vier vazio. */
function tituloFromFuncaoRm(cod: string | null | undefined, nome: string | null | undefined): string {
    const n = (nome ?? "").trim();
    const c = (cod ?? "").trim();
    const base = n || c;
    return base.length > 160 ? base.slice(0, 160) : base;
}

function formatDateTimeForDisplay(value?: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function parseFuncaoRmOptionId(id: string): { codigo: string; nome: string | null } {
    const tab = id.indexOf("\t");
    if (tab < 0) return { codigo: id, nome: null };
    return { codigo: id.slice(0, tab), nome: id.slice(tab + 1) || null };
}

function ensureLookupItem(items: LookupItem[], id: string | null, name: string | null, code?: string | null): LookupItem[] {
    if (!id || !name?.trim() || items.some((item) => item.id === id)) return items;
    return [{ id, name: name.trim(), code: code?.trim() || undefined }, ...items];
}

const FUNCIONARIO_SEARCH_MIN = 2;

/** Busca no servidor (`/api/lookup/funcionarios?q=`) — evita limite dos primeiros N da lista inteira. */
function FuncionarioAsyncSelect({
    value,
    onChange,
    placeholder,
    required,
    disabled,
    "data-testid": dataTestId,
}: {
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
    "data-testid"?: string;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<LookupItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolved, setResolved] = useState<LookupItem | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchGen = useRef(0);

    useEffect(() => {
        if (!value) {
            setResolved(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const d = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${value}`);
                if (cancelled) return;
                const name = String(d?.name ?? "");
                const codeRaw = d?.matriculaRm ?? d?.cdnFuncionario;
                const code = codeRaw != null && String(codeRaw).trim() !== "" ? String(codeRaw) : undefined;
                setResolved({ id: value, name, ...(code ? { code } : {}) });
            } catch {
                if (!cancelled) setResolved({ id: value, name: "—" });
            }
        })();
        return () => { cancelled = true; };
    }, [value]);

    useEffect(() => {
        if (disabled) return;
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [disabled]);

    useEffect(() => {
        if (disabled || !open) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = query.trim();
        if (q.length < FUNCIONARIO_SEARCH_MIN) {
            setItems([]);
            setLoading(false);
            return;
        }
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            const gen = ++searchGen.current;
            (async () => {
                setLoading(true);
                try {
                    const params = new URLSearchParams({
                        pageSize: "100",
                        onlyActive: "true",
                        q,
                    });
                    const res = await fetchJson<Record<string, unknown>>(`/api/lookup/funcionarios?${params.toString()}`);
                    if (gen !== searchGen.current) return;
                    const raw = Array.isArray((res as Record<string, unknown>)?.items)
                        ? ((res as Record<string, unknown>).items as Record<string, unknown>[])
                        : [];
                    const mapped: LookupItem[] = raw.map((f) => ({
                        id: String(f.id),
                        name: String(f.nome ?? ""),
                    }));
                    setItems(mapped);
                } catch {
                    if (gen === searchGen.current) setItems([]);
                } finally {
                    if (gen === searchGen.current) setLoading(false);
                }
            })();
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, open, disabled]);

    const selectedInList = value ? items.find((i) => i.id === value) ?? null : null;
    const selected = selectedInList ?? (resolved && resolved.id === value ? resolved : null);
    const displayText = selected ? (selected.code ? `${selected.code} – ${selected.name}` : selected.name) : "";

    if (disabled) {
        return (
            <div
                className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate"
                data-testid={dataTestId}
            >
                {displayText || <span className="italic opacity-40">—</span>}
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative" data-testid={dataTestId}>
            <div className="flex gap-1">
                <input
                    className={`h-9 flex-1 rounded-md border px-3 text-sm bg-background ${required && !value ? "border-red-400" : "border-input"}`}
                    placeholder={`Buscar ${placeholder} (nome ou e-mail)…`}
                    value={open ? query : displayText}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button type="button" onClick={() => { onChange(null); setQuery(""); setResolved(null); }} className="px-2 text-muted-foreground hover:text-foreground text-xs" tabIndex={-1}>✕</button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-52 overflow-y-auto">
                    {query.trim().length < FUNCIONARIO_SEARCH_MIN ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            Digite pelo menos {FUNCIONARIO_SEARCH_MIN} letras do nome ou do e-mail para buscar.
                        </div>
                    ) : loading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Buscando…</div>
                    ) : items.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum funcionário encontrado.</div>
                    ) : (
                        items.slice(0, 80).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setResolved({ id: item.id, name: item.name, code: item.code });
                                    onChange(item.id);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.code && <span className="text-xs text-muted-foreground font-mono w-20 shrink-0 truncate">{item.code}</span>}
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function SolicitacaoForm({ active, editId, onCancel, onSuccess, viewOnly, hideFooter, resubmitAfterSave, copySourceId, initialData, reloadNonce = 0 }: SolicitacaoFormProps) {
    const [draft, setDraft] = useState<SolicitacaoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("identificacao");
    const [observacaoAprovador, setObservacaoAprovador] = useState<string | null>(null);
    const [statusCarregado, setStatusCarregado] = useState<string | number | null>(null);
    const [rmMeta, setRmMeta] = useState<{
        requisicaoCodigo: string | null;
        idReq: string | null;
        empresaNome: string | null;
        unitName: string | null;
        centroCustoNome: string | null;
    } | null>(null);
    const [rmPareceres, setRmPareceres] = useState<RmParecerItem[]>([]);

    /** Salvar + POST /submit quando URL traz resubmit=1 ou quando a solicitação está em Ajustes necessários (devolução do aprovador). */
    const effectiveResubmitAfterSave = useMemo(
        () =>
            resubmitAfterSave
            || normalizeSolicitacaoStatusOrdinal(statusCarregado) === SolicitacaoVagaOrdinal.AjustesNecessarios,
        [resubmitAfterSave, statusCarregado],
    );

    /* ── lookups ── */
    const [unidades, setUnidades] = useState<LookupItem[]>([]);
    const [empresas, setEmpresas] = useState<LookupItem[]>([]);
    const [centrosCusto, setCentrosCusto] = useState<LookupItem[]>([]);
    const [gestorDiretoId, setGestorDiretoId] = useState<string | null>(null);
    const [requisitanteNomeExibicao, setRequisitanteNomeExibicao] = useState<string | null>(null);
    /** Campos vindos de GET /api/me — bloqueados para não divergir do vínculo do gestor. */
    const [estruturaLocks, setEstruturaLocks] = useState({
        empresa: false,
        unit: false,
        centroCusto: false,
    });

    /**
     * Motivos parametrizáveis carregados da tela de cadastro "Motivos de Requisição".
     * Cada item traz o efeito no headcount, que controla a exibição do bloco de desligamento.
     */
    type MotivoLookup = { id: string; codigo: string; nome: string; efeitoHeadcount: "Aumenta" | "Diminui" | "Ambos" };
    const [motivos, setMotivos] = useState<MotivoLookup[]>([]);
    const [cargosLookup, setCargosLookup] = useState<LookupItem[]>([]);

    type FuncaoRmRow = { codigo?: string | null; nome?: string | null };
    const [funcoesRmItems, setFuncoesRmItems] = useState<LookupItem[]>([]);
    const [funcoesRmLoading, setFuncoesRmLoading] = useState(false);
    const [turnoLookupItems, setTurnoLookupItems] = useState<LookupItem[]>([]);
    const [turnosLookupLoading, setTurnosLookupLoading] = useState(false);
    const [turnoDetalhe, setTurnoDetalhe] = useState<Record<string, unknown> | null>(null);
    /** Funcionário gestor da requisição: subordinados diretos (`GestorDiretoId`) definem a lista de funções RM. */
    const [requisitanteFuncionarioId, setRequisitanteFuncionarioId] = useState<string | null>(null);

    const motivoSelecionado = motivos.find((m) => m.id === draft.motivoRequisicaoId) ?? null;
    // "Diminui" e "Ambos" implicam desligamento vinculado (sai alguém do quadro).
    const isDesligamentoMotivo = motivoSelecionado
        ? motivoSelecionado.efeitoHeadcount === "Diminui" || motivoSelecionado.efeitoHeadcount === "Ambos"
        : false;
    const isRmViewOnly = !!viewOnly && !!(rmMeta?.requisicaoCodigo || rmMeta?.idReq);

    const loadLookups = useCallback(async (opts?: { setRequisitanteFromMe?: boolean }) => {
        // Lookup de funcionários NÃO é carregado aqui — é responsabilidade do useEffect abaixo,
        // que sabe se precisa aplicar filtros por vaga/cargo/lotação. Carregar aqui causava race
        // condition que podia sobrescrever a lista filtrada.
        type OptionRes = { id: string; name: string; code?: string };
        const [unidadesRes, empresasRes, ccRes, motivosRes, cargosRes] = await Promise.all([
            fetchJson<OptionRes[]>("/api/lookup/units").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/empresas").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/centros-custo").catch(() => []),
            fetchJson<MotivoLookup[]>("/api/motivos-requisicao-vaga/lookup").catch(() => []),
            fetchJson<OptionRes[]>("/api/lookup/job-positions").catch(() => []),
        ]);
        setUnidades(Array.isArray(unidadesRes) ? unidadesRes : []);
        setEmpresas(Array.isArray(empresasRes) ? empresasRes : []);
        setCentrosCusto(Array.isArray(ccRes) ? ccRes : []);
        setMotivos(Array.isArray(motivosRes) ? motivosRes : []);
        setCargosLookup(Array.isArray(cargosRes) ? cargosRes : []);

        try {
            const meRes = await fetchJson<Record<string, unknown>>("/api/me");
            const myFuncId = meRes?.funcionarioId as string | null;
            if (opts?.setRequisitanteFromMe && myFuncId)
                setRequisitanteFuncionarioId(myFuncId);
            if (myFuncId) {
                const funcRes = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${myFuncId}`);
                const gdId = funcRes?.gestorDiretoId as string | null;
                if (gdId) setGestorDiretoId(gdId);
            }
        } catch { /* ignore */ }
    }, []);

    function parseDraft(d: Record<string, unknown>, titleSuffix = ""): SolicitacaoDraft {
        const codFuncaoRm = d?.codFuncaoRm != null && String(d.codFuncaoRm).trim() !== "" ? String(d.codFuncaoRm) : null;
        const funcaoNomeRm = d?.funcaoNomeRm != null && String(d.funcaoNomeRm).trim() !== "" ? String(d.funcaoNomeRm) : null;
        const tituloRm = tituloFromFuncaoRm(codFuncaoRm, funcaoNomeRm);
        const tituloLegado = String(d?.titulo ?? "").trim();
        const titulo = `${tituloRm || tituloLegado}${titleSuffix}`.slice(0, 160);

        return {
            titulo,
            justificativa: String(d?.justificativa ?? ""),
            qtdPosicoes: Number(d?.qtdPosicoes ?? 1),
            urgencia: (() => { const map: Record<string, number> = { Baixa: 0, Media: 1, Alta: 2, Critica: 3 }; const v = d?.urgencia; return typeof v === "number" ? v : (map[v as string] ?? 1); })(),
            jobPositionId: d?.jobPositionId ? String(d.jobPositionId) : null,
            jobPositionName: d?.jobPositionName != null && String(d.jobPositionName).trim() !== "" ? String(d.jobPositionName).trim() : null,
            faixaSalarialMin: moneyFieldFromApi(d?.faixaSalarialMin ?? d?.FaixaSalarialMin ?? d?.faixaSalarialMax ?? d?.FaixaSalarialMax),
            faixaSalarialMax: moneyFieldFromApi(d?.faixaSalarialMax ?? d?.FaixaSalarialMax ?? d?.faixaSalarialMin ?? d?.FaixaSalarialMin),
            origemVaga: "nova",
            unitId: d?.unitId ? String(d.unitId) : null,
            aprovadorId: d?.aprovadorId ? String(d.aprovadorId) : null,
            tipoSolicitacao: (() => {
                const m: Record<string, number> = { VagaNova: 0, Substituicao: 1, AumentoQuadro: 2 };
                const v = d?.tipoSolicitacao;
                return typeof v === "number" ? v : (m[v as string] ?? 0);
            })(),
            isConfidencial: Boolean(d?.isConfidencial),
            substituidoFuncionarioId: d?.substituidoFuncionarioId ? String(d.substituidoFuncionarioId) : null,
            tipoContrato: (() => { const m: Record<string, number> = { CLT: 0, Estagio: 1, Aprendiz: 2, Temporario: 3 }; const v = d?.tipoContrato; return typeof v === "number" ? v : (m[v as string] ?? 0); })(),
            prazoDias: d?.prazoDias != null ? Number(d.prazoDias) : null,
            motivoRequisicaoId: d?.motivoRequisicaoId ? String(d.motivoRequisicaoId) : null,
            cnhObrigatoria: Boolean(d?.cnhObrigatoria),
            disponibilidadeViagens: Boolean(d?.disponibilidadeViagens),
            turnoId: (() => {
                const r = d?.turnoId ?? d?.TurnoId;
                return r != null && String(r).trim() !== "" ? String(r) : null;
            })(),
            escalaTrabalho: String(d?.escalaTrabalho ?? ""),
            empresaId: d?.empresaId ? String(d.empresaId) : null,
            centroCustoId: d?.centroCustoId ? String(d.centroCustoId) : null,
            vagaId: d?.vagaId ? String(d.vagaId) : null,
            codFuncaoRm,
            funcaoNomeRm,
            dataDesligamento: d?.dataDesligamento ? String(d.dataDesligamento).slice(0, 10) : null,
            tipoAvisoPrevioDesligamento: (() => { const m: Record<string, number> = { Indenizado: 0, Trabalhado: 1, Dispensado: 2 }; const v = d?.tipoAvisoPrevioDesligamento; return v == null ? null : typeof v === "number" ? v : (m[v as string] ?? null); })(),
            diasAvisoPrevioDesligamento: d?.diasAvisoPrevioDesligamento != null ? Number(d.diasAvisoPrevioDesligamento) : 30,
            possuiEstabilidadeDesligamento: d?.possuiEstabilidadeDesligamento == null ? null : Boolean(d.possuiEstabilidadeDesligamento),
            motivoDesligamentoTexto: String(d?.motivoDesligamentoTexto ?? ""),
            decisaoRH: (() => {
                const m: Record<string, number> = { SubstituicaoProvisoria: 1, AumentoDefinitivo: 2, ConsumirHeadcountExistente: 3 };
                const v = d?.decisaoRH;
                return v == null ? null : typeof v === "number" ? v : (m[v as string] ?? null);
            })(),
            decisaoRHPrazoMeses: d?.decisaoRHPrazoMeses != null ? Number(d.decisaoRHPrazoMeses) : 3,
            decisaoRHPrazoDataAlvo: d?.decisaoRHPrazoDataAlvo ? String(d.decisaoRHPrazoDataAlvo) : null,
        };
    }

    useEffect(() => {
        if (!active) return;
        setActiveTab("identificacao");
        setRmPareceres([]);
        setRequisitanteFuncionarioId(null);
        setRequisitanteNomeExibicao(null);
        setGestorDiretoId(null);
        loadLookups({ setRequisitanteFromMe: !editId && !copySourceId });

        setObservacaoAprovador(null);
        setStatusCarregado(null);
        setRmMeta(null);
        const sourceId = editId ?? copySourceId ?? null;
        if (sourceId) {
            setLoadingEdit(true);
            fetchJson<Record<string, unknown>>(`${API}/${sourceId}`)
                .then((d) => {
                    setDraft(parseDraft(d, copySourceId ? " (cópia)" : ""));
                    const empresaId = d?.empresaId != null ? String(d.empresaId) : null;
                    const empresaNome = d?.empresaNome != null ? String(d.empresaNome) : null;
                    const unitId = d?.unitId != null ? String(d.unitId) : null;
                    const unitName = d?.unitName != null ? String(d.unitName) : null;
                    const centroCustoId = d?.centroCustoId != null ? String(d.centroCustoId) : null;
                    const centroCustoNome = d?.centroCustoNome != null ? String(d.centroCustoNome) : null;
                    setEmpresas((items) => ensureLookupItem(items, empresaId, empresaNome));
                    setUnidades((items) => ensureLookupItem(items, unitId, unitName));
                    setCentrosCusto((items) => ensureLookupItem(items, centroCustoId, centroCustoNome));
                    setRmMeta({
                        requisicaoCodigo: d?.rmRequisicaoCodigo != null ? String(d.rmRequisicaoCodigo).trim() || null : null,
                        idReq: d?.rmIdReq != null ? String(d.rmIdReq).trim() || null : null,
                        empresaNome: empresaNome?.trim() || null,
                        unitName: unitName?.trim() || null,
                        centroCustoNome: centroCustoNome?.trim() || null,
                    });
                    setRmPareceres(Array.isArray(d?.rmPareceres)
                        ? d.rmPareceres.map((p) => {
                            const item = p as Record<string, unknown>;
                            return {
                                idParecer: Number(item.idParecer ?? 0),
                                dataParecer: item.dataParecer != null ? String(item.dataParecer) : null,
                                codStatus: item.codStatus != null ? String(item.codStatus) : null,
                                status: item.status != null ? String(item.status) : null,
                                solicitante: item.solicitante != null ? String(item.solicitante) : null,
                                chapaSolicitante: item.chapaSolicitante != null ? String(item.chapaSolicitante) : null,
                                parecer: item.parecer != null ? String(item.parecer) : null,
                            };
                        })
                        : []);
                    if (d?.solicitanteId)
                        setRequisitanteFuncionarioId(String(d.solicitanteId));
                    const sn = d?.solicitanteNome != null ? String(d.solicitanteNome).trim() : "";
                    if (sn) {
                        setRequisitanteNomeExibicao(sn);
                    } else if (d?.solicitanteId) {
                        void fetchJson<Record<string, unknown>>(`/api/funcionarios/${String(d.solicitanteId)}`)
                            .then((f) => {
                                const n = f?.name != null ? String(f.name).trim() : "";
                                if (n) setRequisitanteNomeExibicao(n);
                            })
                            .catch(() => { /* ignore */ });
                    }
                    setObservacaoAprovador(d?.observacaoAprovador ? String(d.observacaoAprovador) : null);
                    const s = d?.status;
                    setStatusCarregado(typeof s === "string" || typeof s === "number" ? s : null);
                })
                .catch(() => toast.error("Falha ao carregar solicitação."))
                .finally(() => setLoadingEdit(false));
        } else if (initialData) {
            const merged: SolicitacaoDraft = { ...emptyDraft, ...initialData, origemVaga: "nova" };
            const propostaSalarial = moneyFieldFromApi(merged.faixaSalarialMin || merged.faixaSalarialMax || "");
            merged.faixaSalarialMin = propostaSalarial;
            merged.faixaSalarialMax = moneyFieldFromApi(merged.faixaSalarialMax || merged.faixaSalarialMin || "");
            setDraft(merged);
            setRmMeta(null);
        } else {
            setDraft({ ...emptyDraft });
            setRmMeta(null);
        }
    }, [active, editId, copySourceId, initialData, loadLookups, reloadNonce]);

    useEffect(() => {
        if (!active || viewOnly || editId || copySourceId) {
            setEstruturaLocks({ empresa: false, unit: false, centroCusto: false });
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const me = await fetchJson<Record<string, unknown>>("/api/me");
                const empresaId = me.empresaId != null ? String(me.empresaId) : null;
                const unitId = me.unitId != null ? String(me.unitId) : null;
                const centroCustoId = me.centroCustoId != null ? String(me.centroCustoId) : null;
                if (cancelled) return;
                setEstruturaLocks({
                    empresa: !!empresaId,
                    unit: !!unitId,
                    centroCusto: !!centroCustoId,
                });
                setDraft((d) => ({
                    ...d,
                    ...(!d.empresaId && empresaId ? { empresaId } : {}),
                    ...(!d.unitId && unitId ? { unitId } : {}),
                    ...(!d.centroCustoId && centroCustoId ? { centroCustoId } : {}),
                }));
            } catch {
                if (!cancelled) {
                    setEstruturaLocks({ empresa: false, unit: false, centroCusto: false });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [active, viewOnly, editId, copySourceId, reloadNonce]);

    useEffect(() => {
        if (gestorDiretoId && !editId && !draft.aprovadorId) {
            setDraft((d) => ({ ...d, aprovadorId: gestorDiretoId }));
        }
    }, [gestorDiretoId, editId, draft.aprovadorId]);

    useEffect(() => {
        if (!active || !requisitanteFuncionarioId?.trim()) {
            return;
        }
        let cancelled = false;
        void fetchJson<Record<string, unknown>>(`/api/funcionarios/${requisitanteFuncionarioId.trim()}`)
            .then((f) => {
                if (cancelled) return;
                const gdId = f?.gestorDiretoId != null ? String(f.gestorDiretoId).trim() : "";
                if (gdId) {
                    setGestorDiretoId(gdId);
                    setDraft((d) => d.aprovadorId ? d : { ...d, aprovadorId: gdId });
                }
            })
            .catch(() => { /* ignore */ });
        return () => {
            cancelled = true;
        };
    }, [active, requisitanteFuncionarioId]);

    useEffect(() => {
        if (!active) {
            setTurnoDetalhe(null);
            return;
        }
        const id = draft.turnoId?.trim();
        if (!id) {
            setTurnoDetalhe(null);
            return;
        }
        let cancelled = false;
        void fetchJson<Record<string, unknown>>(`/api/turnos/${encodeURIComponent(id)}`)
            .then((d) => {
                if (!cancelled) setTurnoDetalhe(d);
            })
            .catch(() => {
                if (!cancelled) setTurnoDetalhe(null);
            });
        return () => {
            cancelled = true;
        };
    }, [active, draft.turnoId]);

    useEffect(() => {
        if (!active) {
            setTurnoLookupItems([]);
            return;
        }
        let cancelled = false;
        setTurnosLookupLoading(true);
        const q = "/api/turnos/lookup?includeGlobals=true&globalsOnly=true";
        void fetchJson<Record<string, unknown>[]>(q)
            .then((rows) => {
                if (cancelled) return;
                const arr = Array.isArray(rows) ? rows : [];
                setTurnoLookupItems(
                    arr
                        .map((x) => ({
                            id: String(x.id ?? x.Id ?? ""),
                            code: String(x.code ?? x.Code ?? ""),
                            name:
                                String(
                                    x.displayLabel
                                    ?? x.DisplayLabel
                                    ?? `${String(x.code ?? x.Code ?? "")} – ${String(x.description ?? x.Description ?? "")}`,
                                ).trim() || "—",
                        }))
                        .filter((x) => x.id.length > 0),
                );
            })
            .catch(() => {
                if (!cancelled) setTurnoLookupItems([]);
            })
            .finally(() => {
                if (!cancelled) setTurnosLookupLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [active]);

    useEffect(() => {
        if (!active || !requisitanteFuncionarioId) {
            setFuncoesRmItems([]);
            setFuncoesRmLoading(false);
            return;
        }
        const gestorId = requisitanteFuncionarioId;
        let cancelled = false;
        const t = setTimeout(() => {
            (async () => {
                setFuncoesRmLoading(true);
                try {
                    const rows = await fetchJson<FuncaoRmRow[]>(
                        `/api/funcoes?gestorFuncionarioId=${encodeURIComponent(gestorId)}`,
                    );
                    if (cancelled) return;
                    const mapped: LookupItem[] = (Array.isArray(rows) ? rows : []).map((r) => {
                        const code = String(r.codigo ?? "");
                        const name = String(r.nome ?? "");
                        return {
                            id: funcaoRmOptionId(code, name),
                            code,
                            name: name || code,
                        };
                    });
                    setFuncoesRmItems(mapped);
                } catch {
                    if (!cancelled) setFuncoesRmItems([]);
                } finally {
                    if (!cancelled) setFuncoesRmLoading(false);
                }
            })();
        }, 280);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [active, requisitanteFuncionarioId]);

    const funcoesRmSelectItems = useMemo(() => {
        const cod = draft.codFuncaoRm;
        if (!cod) return funcoesRmItems;
        const nome = draft.funcaoNomeRm ?? "";
        const id = funcaoRmOptionId(cod, nome);
        if (funcoesRmItems.some((i) => i.id === id)) return funcoesRmItems;
        return [{ id, code: cod, name: nome || cod }, ...funcoesRmItems];
    }, [funcoesRmItems, draft.codFuncaoRm, draft.funcaoNomeRm]);

    const funcaoRmSelectValue = draft.codFuncaoRm
        ? funcaoRmOptionId(draft.codFuncaoRm, draft.funcaoNomeRm)
        : null;

    const turnoSelectItems = useMemo(() => {
        const id = draft.turnoId?.trim();
        if (!id) return turnoLookupItems;
        if (turnoLookupItems.some((i) => i.id === id)) return turnoLookupItems;
        const code = String(turnoDetalhe?.code ?? turnoDetalhe?.Code ?? "").trim();
        const name = String(turnoDetalhe?.description ?? turnoDetalhe?.Description ?? "").trim();
        return [{ id, code: code || "—", name: name || "Turno" }, ...turnoLookupItems];
    }, [turnoLookupItems, draft.turnoId, turnoDetalhe]);

    const jobPositionSelectItems = useMemo(() => {
        const id = draft.jobPositionId?.trim();
        if (!id) return cargosLookup;
        if (cargosLookup.some((i) => i.id === id)) return cargosLookup;
        const name = draft.jobPositionName?.trim() || "Cargo";
        return [{ id, code: undefined, name }, ...cargosLookup];
    }, [cargosLookup, draft.jobPositionId, draft.jobPositionName]);

    const exigeDecisaoHeadcountGestor = draft.tipoSolicitacao === 0 || draft.tipoSolicitacao === 2;

    const faixaSalarialErroInline = useMemo(
        () => (viewOnly ? null : propostaSalarialMensagemErro(draft.faixaSalarialMin)),
        [draft.faixaSalarialMin, viewOnly],
    );

    async function save() {
        if (viewOnly) return;
        const errors: string[] = [];
        if (!draft.codFuncaoRm?.trim()) errors.push("Função");
        if (!draft.empresaId) errors.push("Empresa");
        if (!draft.unitId) errors.push("Filial");
        if (!draft.centroCustoId) errors.push("Seção");
        if (!draft.motivoRequisicaoId) errors.push("Motivo");
        if (draft.tipoSolicitacao === 2 && !draft.jobPositionId?.trim()) errors.push("Cargo");
        // isDesligamentoMotivo é derivado do efeito do motivo selecionado (fora deste escopo, no render).
        // Recalcula localmente para usar sem depender da referência externa.
        const saveMotivoSelecionado = motivos.find((m) => m.id === draft.motivoRequisicaoId) ?? null;
        const saveIsDesligamentoMotivo = saveMotivoSelecionado
            ? saveMotivoSelecionado.efeitoHeadcount === "Diminui" || saveMotivoSelecionado.efeitoHeadcount === "Ambos"
            : false;
        if (saveIsDesligamentoMotivo) {
            if (!draft.substituidoFuncionarioId) errors.push("Funcionário a desligar");
            if (!draft.dataDesligamento) errors.push("Data de desligamento");
        }
        // Vaga nova e aumento de quadro exigem decisão de headcount antes de submeter.
        // Substituição pura (sem desligamento vinculado) não exige — provisório é default.
        const fluxoDecisaoHcGestor = draft.tipoSolicitacao === 0 || draft.tipoSolicitacao === 2;
        if (fluxoDecisaoHcGestor && !draft.decisaoRH) errors.push("Decisão de headcount");
        if (draft.decisaoRH === 1) {
            // Substituição provisória: exige prazo
            if (!draft.decisaoRHPrazoMeses || draft.decisaoRHPrazoMeses < 1) errors.push("Prazo da substituição provisória (meses)");
        }
        if (draft.tipoSolicitacao === 2 && !draft.justificativa.trim()) {
            errors.push("Justificativa (obrigatória no aumento de quadro)");
            setActiveTab("identificacao");
        }
        if (draft.tipoSolicitacao !== 2 && fluxoDecisaoHcGestor && draft.decisaoRH === 2 && !draft.justificativa.trim()) {
            errors.push("Justificativa (obrigatória para aumento definitivo de headcount)");
            setActiveTab("identificacao");
        }
        const temTurno = !!draft.turnoId?.trim();
        const temEscalaLegada = !!(draft.escalaTrabalho || "").trim();
        if (!temTurno && !temEscalaLegada) {
            errors.push("Turno ou horário legado");
            setActiveTab("horario");
        }
        const propostaSalarialNum = parseDecimalBrInput(draft.faixaSalarialMin);
        const msgFaixa = propostaSalarialMensagemErro(draft.faixaSalarialMin);
        if (propostaSalarialNum == null) {
            errors.push(msgFaixa ?? "Proposta Salarial");
            setActiveTab("identificacao");
        }
        if (errors.length > 0) {
            toast.error(`Campos obrigatórios: ${errors.join(", ")}.`);
            return;
        }

        setSaving(true);
        const tipoSolicitacaoStr = (["VagaNova", "Substituicao", "AumentoQuadro"][draft.tipoSolicitacao] ?? "VagaNova") as
            | "VagaNova"
            | "Substituicao"
            | "AumentoQuadro";
        const payload = {
            titulo: tituloFromFuncaoRm(draft.codFuncaoRm, draft.funcaoNomeRm),
            codFuncaoRm: draft.codFuncaoRm?.trim() || null,
            funcaoNomeRm: draft.funcaoNomeRm?.trim() || null,
            justificativa: draft.justificativa.trim() || null,
            qtdPosicoes: Math.max(draft.qtdPosicoes, 1),
            urgencia: (["Baixa", "Media", "Alta", "Critica"][draft.urgencia] ?? "Media"),
            jobPositionId: draft.jobPositionId || null,
            unitId: draft.unitId,
            aprovadorId: draft.aprovadorId || null,
            tipoSolicitacao: tipoSolicitacaoStr,
            isConfidencial: draft.isConfidencial,
            substituidoFuncionarioId: draft.tipoSolicitacao === 1 ? (draft.substituidoFuncionarioId || null) : null,
            tipoContrato: (["CLT", "Estagio", "Aprendiz", "Temporario"][draft.tipoContrato] ?? "CLT"),
            prazoDias: draft.tipoContrato !== 0 ? draft.prazoDias : null,
            motivoRequisicaoId: draft.motivoRequisicaoId,
            cnhObrigatoria: draft.cnhObrigatoria,
            disponibilidadeViagens: draft.disponibilidadeViagens,
            turnoId: draft.turnoId || null,
            escalaTrabalho: draft.turnoId ? null : (draft.escalaTrabalho?.trim() || null),
            empresaId: draft.empresaId,
            centroCustoId: draft.centroCustoId,
            unidadeLotacaoId: null,
            vagaId: draft.vagaId || null,
            dataDesligamento: saveIsDesligamentoMotivo ? draft.dataDesligamento : null,
            tipoAvisoPrevioDesligamento: saveIsDesligamentoMotivo && draft.tipoAvisoPrevioDesligamento !== null
                ? (["Indenizado", "Trabalhado", "Dispensado"][draft.tipoAvisoPrevioDesligamento] ?? null)
                : null,
            diasAvisoPrevioDesligamento: saveIsDesligamentoMotivo ? draft.diasAvisoPrevioDesligamento : null,
            possuiEstabilidadeDesligamento: saveIsDesligamentoMotivo ? draft.possuiEstabilidadeDesligamento : null,
            motivoDesligamentoTexto: saveIsDesligamentoMotivo ? (draft.motivoDesligamentoTexto.trim() || null) : null,
            decisaoRH: draft.decisaoRH !== null
                ? (["SubstituicaoProvisoria", "AumentoDefinitivo", "ConsumirHeadcountExistente"][draft.decisaoRH - 1] ?? null)
                : null,
            decisaoRHPrazoMeses: draft.decisaoRH === 1 ? draft.decisaoRHPrazoMeses : null,
            decisaoRHPrazoDataAlvo: draft.decisaoRH === 1 ? draft.decisaoRHPrazoDataAlvo : null,
            faixaSalarialMin: propostaSalarialNum,
            faixaSalarialMax: propostaSalarialNum,
        };

        function hintTabFromMvcKeys(body: Record<string, unknown>): "identificacao" | "horario" | "aprovacao" | null {
            const errs = body.errors && typeof body.errors === "object"
                ? (body.errors as Record<string, unknown>)
                : null;
            const blob = (errs ? Object.keys(errs) : Object.keys(body)).join("|").toLowerCase();
            if (/escala|horario|horário|turno/i.test(blob)) return "horario";
            if (/aprovador/i.test(blob)) return "aprovacao";
            if (/titulo|empresa|unidade|filial|motivo|justificativa|cargo|quadro|substituid|headcount|decisao|funcao|codfuncao|lotacao|requisitos|json/i.test(blob)) return "identificacao";
            return null;
        }

        try {
            if (editId) {
                const putRes = await apiFetch(`${API}/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload),
                    cache: "no-store",
                });
                if (!putRes.ok) {
                    try {
                        const j = await putRes.clone().json() as Record<string, unknown>;
                        const tab = hintTabFromMvcKeys(j);
                        const errs = j.errors && typeof j.errors === "object" ? j.errors as Record<string, unknown> : null;
                        const flattened = errs
                            ? Object.values(errs).flatMap((x) => (Array.isArray(x) ? x : [String(x)]))
                            : [];
                        const firstDetail =
                            flattened[0] as string | undefined
                            ?? (j.detail as string)
                            ?? (j.title as string)
                            ?? (j.message as string);
                        toast.error(firstDetail ?? `Erro ao salvar (HTTP ${putRes.status})`);
                        if (tab) setActiveTab(tab);
                    } catch {
                        toast.error(`Falha ao salvar (HTTP ${putRes.status})`);
                    }
                    return;
                }
                if (effectiveResubmitAfterSave) {
                    await fetchJson(`${API}/${editId}/submit`, { method: "POST" });
                    setStatusCarregado(SolicitacaoVagaOrdinal.PendenteAprovacao);
                    toast.success(
                        draft.tipoSolicitacao === 2
                            ? "Solicitação atualizada e reenviada para aprovação!"
                            : "Solicitação atualizada e reenviada para aprovação!",
                    );
                } else {
                    toast.success("Solicitação atualizada.");
                }
            } else {
                const res = await apiFetch(API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload),
                    cache: "no-store",
                });
                if (!res.ok) {
                    let msg = `HTTP ${res.status}`;
                    try {
                        const j = await res.json() as Record<string, unknown> & { errors?: Record<string, string[]> };
                        const tab = hintTabFromMvcKeys(j as Record<string, unknown>);
                        if (tab) setActiveTab(tab);
                        const m = j.message;
                        msg =
                            (typeof j.detail === "string" ? j.detail : null)
                            ?? (typeof j.title === "string" ? j.title : null)
                            ?? (typeof m === "string" ? m : null)
                            ?? msg;
                        if (j.errors && typeof j.errors === "object") {
                            const first = Object.values(j.errors as Record<string, string[]>)[0];
                            const v = Array.isArray(first) ? first[0] : undefined;
                            if (typeof v === "string") msg = v;
                        }
                    } catch { /* ignore */ }
                    throw new Error(msg);
                }
                const created = await res.json() as { id?: string };
                if (created?.id) {
                    const submitRes = await apiFetch(`${API}/${created.id}/submit`, { method: "POST" });
                    if (submitRes.ok || submitRes.status === 204) {
                        toast.success(
                            tipoSolicitacaoStr === "AumentoQuadro"
                                ? "Solicitação criada e enviada para aprovação!"
                                : "Solicitação criada e enviada para aprovação!",
                        );
                    } else {
                        toast.success("Solicitação criada (envie manualmente para aprovação).");
                    }
                } else {
                    toast.success("Solicitação criada.");
                }
            }
            onSuccess();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    const L = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1";
    const S = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

    const Section = ({ title }: { title: string }) => (
        <div className="col-span-full">
            <div className="flex items-center gap-2 my-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
                <div className="flex-1 border-t border-border" />
            </div>
        </div>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                {/* Banner de motivo de reprovação / observação do aprovador */}
                {!loadingEdit && observacaoAprovador && (
                    <div className={`shrink-0 rounded-md border px-3 py-2 text-sm ${
                        statusCarregado === "Reprovada" || statusCarregado === 3
                            ? "bg-red-500/10 border-red-400/40 text-red-800 dark:text-red-300"
                            : "bg-amber-500/10 border-amber-400/40 text-amber-800 dark:text-amber-300"
                    }`}>
                        <span className="font-semibold mr-1">
                            {statusCarregado === "Reprovada" || statusCarregado === 3 ? "Motivo da recusa:" : "Observação:"}
                        </span>
                        {observacaoAprovador}
                    </div>
                )}

                {loadingEdit ? (
                    <div className="flex min-h-[10rem] flex-1 flex-col items-center justify-center">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                        <TabsList className="mb-2 shrink-0 border-b border-border/60 pb-2">
                            <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                            <TabsTrigger value="horario">Horário</TabsTrigger>
                            <TabsTrigger value="aprovacao">Aprovações</TabsTrigger>
                        </TabsList>

                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-4 pb-1 [scrollbar-gutter:stable]">
                        {/* ══════════════ TAB 1 — Identificação + Dados da Vaga ══════════════ */}
                        <TabsContent value="identificacao" className="mt-0">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">

                                <Section title="Identificação" />

                                {isRmViewOnly && (
                                    <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                        <div>
                                            <label className={L}>Requisitante</label>
                                            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                                                {requisitanteNomeExibicao || <span className="italic opacity-40">—</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={L}>ID requisição RM</label>
                                            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                                                {rmMeta?.idReq || rmMeta?.requisicaoCodigo || <span className="italic opacity-40">—</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isRmViewOnly ? (
                                    <>
                                        <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                            <div>
                                                <label className={L}>{LB.empresa}</label>
                                                <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                                                    {rmMeta?.empresaNome || <span className="italic opacity-40">—</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <label className={L}>{LB.filial}</label>
                                                <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                                                    {rmMeta?.unitName || <span className="italic opacity-40">—</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <label className={L}>{LB.secao}</label>
                                            <div className="h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center text-muted-foreground truncate">
                                                {rmMeta?.centroCustoNome || <span className="italic opacity-40">—</span>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                            <div>
                                                <label className={L}>{LB.empresa}</label>
                                                <AutocompleteSelect items={empresas} value={draft.empresaId} onChange={(v) => setDraft((d) => ({ ...d, empresaId: v }))} placeholder="empresa" required disabled={viewOnly || estruturaLocks.empresa} />
                                            </div>
                                            <div>
                                                <label className={L}>{LB.filial}</label>
                                                <AutocompleteSelect items={unidades} value={draft.unitId} onChange={(v) => setDraft((d) => ({ ...d, unitId: v }))} placeholder="filial" required disabled={viewOnly || estruturaLocks.unit} />
                                            </div>
                                        </div>

                                        <div className="col-span-3">
                                            <label className={L}>{LB.secao}</label>
                                            <AutocompleteSelect
                                                items={centrosCusto}
                                                value={draft.centroCustoId}
                                                onChange={(v) => setDraft((d) => ({ ...d, centroCustoId: v }))}
                                                placeholder="seção"
                                                required
                                                disabled={viewOnly || estruturaLocks.centroCusto}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <label className={L}>Qtd. Posições</label>
                                        <Input type="number" min={1} value={draft.qtdPosicoes} onChange={(e) => setDraft((d) => ({ ...d, qtdPosicoes: Math.max(1, Number(e.target.value)) }))} disabled={viewOnly} />
                                    </div>
                                    {!isRmViewOnly && (
                                    <div>
                                        <label className={L}>Urgência</label>
                                        <select className={S} value={draft.urgencia} onChange={(e) => setDraft((d) => ({ ...d, urgencia: Number(e.target.value) }))} disabled={viewOnly}>
                                            <option value={0}>Baixa</option>
                                            <option value={1}>Média</option>
                                            <option value={2}>Alta</option>
                                            <option value={3}>Crítica</option>
                                        </select>
                                    </div>
                                    )}
                                </div>

                                <Section title={LB.secaoTituloReq} />

                                <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3 items-start">
                                    <div>
                                        <label className={L}>{LB.funcao}</label>
                                        <AutocompleteSelect
                                            items={funcoesRmSelectItems}
                                            value={funcaoRmSelectValue}
                                            onChange={(id) => {
                                                if (!id) {
                                                    setDraft((d) => ({ ...d, codFuncaoRm: null, funcaoNomeRm: null, titulo: "" }));
                                                    return;
                                                }
                                                const { codigo, nome } = parseFuncaoRmOptionId(id);
                                                setDraft((d) => ({
                                                    ...d,
                                                    codFuncaoRm: codigo || null,
                                                    funcaoNomeRm: nome,
                                                    titulo: tituloFromFuncaoRm(codigo || null, nome),
                                                }));
                                            }}
                                            placeholder="função RM"
                                            required={!viewOnly}
                                            disabled={viewOnly || !requisitanteFuncionarioId}
                                        />
                                        {funcoesRmLoading && requisitanteFuncionarioId && (
                                            <p className="text-xs text-muted-foreground mt-1">Carregando funções da equipe…</p>
                                        )}
                                        {!funcoesRmLoading && requisitanteFuncionarioId && funcoesRmItems.length === 0 && !draft.codFuncaoRm && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Nenhuma função RM entre colaboradores que se reportam diretamente ao requisitante (confira vínculo de gestor e import/sync RM).
                                            </p>
                                        )}
                                        {!requisitanteFuncionarioId && !loadingEdit && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Lista funções RM dos colaboradores ativos que têm o requisitante como gestor direto (cadastro + import/sync RM).
                                            </p>
                                        )}
                                    </div>
                                    {!isRmViewOnly && (
                                    <div>
                                        <label className={L}>{draft.tipoSolicitacao === 2 ? LB.cargoObrig : LB.cargoOpcional}</label>
                                        <AutocompleteSelect
                                            items={jobPositionSelectItems}
                                            value={draft.jobPositionId}
                                            onChange={(v) => setDraft((d) => ({ ...d, jobPositionId: v, jobPositionName: null }))}
                                            placeholder="cargo"
                                            required={draft.tipoSolicitacao === 2}
                                            disabled={viewOnly}
                                        />
                                    </div>
                                    )}
                                </div>

                                <div
                                    className={
                                        draft.tipoContrato !== 0
                                            ? "col-span-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3"
                                            : "col-span-3 grid grid-cols-2 gap-x-4 gap-y-3"
                                    }
                                >
                                    <div>
                                        <label className={L}>{LB.faixaMin}</label>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            placeholder="R$ 0,00"
                                            title="Digite apenas números; o valor é montado em reais com centavos (ex.: para R$ 5.000,00 digite 500000)."
                                            className={`tabular-nums${faixaSalarialErroInline ? " border-destructive" : ""}`}
                                            aria-invalid={faixaSalarialErroInline ? true : undefined}
                                            value={draft.faixaSalarialMin}
                                            onKeyDown={blockNonDigitMoneyKeys}
                                            onChange={(e) =>
                                                setDraft((d) => ({
                                                    ...d,
                                                    faixaSalarialMin: formatBrlCurrencyFromDigits(e.target.value.replace(/\D/g, "")),
                                                    faixaSalarialMax: formatBrlCurrencyFromDigits(e.target.value.replace(/\D/g, "")),
                                                }))
                                            }
                                            onCompositionEnd={(e) => {
                                                const v = formatBrlCurrencyFromDigits(e.currentTarget.value.replace(/\D/g, ""));
                                                setDraft((d) => ({ ...d, faixaSalarialMin: v, faixaSalarialMax: v }));
                                            }}
                                            onPaste={(e) => {
                                                const formatted = applyPastedMoneyToField(e.clipboardData.getData("text"));
                                                if (formatted != null) {
                                                    e.preventDefault();
                                                    setDraft((d) => ({ ...d, faixaSalarialMin: formatted, faixaSalarialMax: formatted }));
                                                }
                                            }}
                                            onDrop={(e) => {
                                                const formatted = applyPastedMoneyToField(e.dataTransfer.getData("text/plain"));
                                                if (formatted != null) {
                                                    e.preventDefault();
                                                    setDraft((d) => ({ ...d, faixaSalarialMin: formatted, faixaSalarialMax: formatted }));
                                                }
                                            }}
                                            disabled={viewOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className={L}>Tipo de Contrato</label>
                                        <select className={S} value={draft.tipoContrato} onChange={(e) => setDraft((d) => ({ ...d, tipoContrato: Number(e.target.value), prazoDias: null }))} disabled={viewOnly}>
                                            <option value={0}>CLT</option>
                                            <option value={1}>Estágio</option>
                                            <option value={2}>Aprendiz</option>
                                            <option value={3}>Temporário</option>
                                        </select>
                                    </div>
                                    {draft.tipoContrato !== 0 && (
                                        <div>
                                            <label className={L}>Prazo (dias)</label>
                                            <Input type="number" min={1} value={draft.prazoDias ?? ""} onChange={(e) => setDraft((d) => ({ ...d, prazoDias: e.target.value ? Number(e.target.value) : null }))} placeholder="Ex: 180" disabled={viewOnly} />
                                        </div>
                                    )}
                                    {faixaSalarialErroInline && !viewOnly && (
                                        <p className="col-span-full text-xs text-destructive font-medium pt-0.5">{faixaSalarialErroInline}</p>
                                    )}
                                </div>

                                <div className="col-span-3 grid grid-cols-2 gap-x-4 gap-y-3 items-start">
                                    <div>
                                        <label className={L}>{LB.tipoSolicitacao}</label>
                                        <select
                                            className={S}
                                            value={draft.tipoSolicitacao}
                                            onChange={(e) => {
                                                const v = Number(e.target.value);
                                                setDraft((d) => ({
                                                    ...d,
                                                    tipoSolicitacao: v,
                                                    substituidoFuncionarioId: v === 2 ? null : d.substituidoFuncionarioId,
                                                }));
                                            }}
                                            disabled={viewOnly}
                                        >
                                            <option value={0}>Vaga nova</option>
                                            <option value={1}>Substituição</option>
                                            <option value={2}>Aumento de quadro</option>
                                        </select>
                                        {draft.tipoSolicitacao === 2 && !isRmViewOnly && (
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                Esta opção segue para aprovação do gestor direto antes da distribuição ao RH.
                                            </p>
                                        )}
                                    </div>
                                    {!isRmViewOnly && (
                                    <div>
                                        <label className={L}>{LB.motivo}</label>
                                        <select
                                            className={S}
                                            value={draft.motivoRequisicaoId ?? ""}
                                            onChange={(e) => {
                                                const id = e.target.value || null;
                                                const efeito = motivos.find((m) => m.id === id)?.efeitoHeadcount ?? null;
                                                const isDesl = efeito === "Diminui" || efeito === "Ambos";
                                                setDraft((d) => ({
                                                    ...d,
                                                    motivoRequisicaoId: id,
                                                    // Desligamento (Diminui/Ambos) implica Substituicao (RM).
                                                    tipoSolicitacao: isDesl ? 1 : d.tipoSolicitacao,
                                                }));
                                            }}
                                            disabled={viewOnly || motivos.length === 0}
                                            data-testid="select-motivo-requisicao"
                                        >
                                            <option value="">
                                                {motivos.length === 0 ? "Carregando motivos..." : "Selecione..."}
                                            </option>
                                            {motivos.map((m) => (
                                                <option key={m.id} value={m.id}>{m.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    )}
                                </div>

                                {draft.tipoSolicitacao === 1 && !isDesligamentoMotivo && (
                                    <div className="col-span-3">
                                        <label className={L}>Funcionário Substituído</label>
                                        <FuncionarioAsyncSelect
                                            value={draft.substituidoFuncionarioId}
                                            onChange={(v) => setDraft((d) => ({ ...d, substituidoFuncionarioId: v }))}
                                            placeholder="funcionário substituído"
                                            required
                                            disabled={viewOnly}
                                        />
                                    </div>
                                )}

                                {isDesligamentoMotivo && (
                                    <div className="col-span-3 rounded-md border border-dashed border-amber-400/70 bg-amber-50/40 p-3" data-testid="bloco-desligamento">
                                        <div className="mb-2 text-xs font-semibold text-amber-800">
                                            Dados do desligamento
                                            <span className="ml-2 font-normal text-[11px] text-amber-700/80">
                                                Esta requisição irá gerar uma solicitação de desligamento automaticamente.
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                                            <div className="col-span-3">
                                                <label className={L}>Funcionário a desligar *</label>
                                                <FuncionarioAsyncSelect
                                                    value={draft.substituidoFuncionarioId}
                                                    onChange={(v) => setDraft((d) => ({ ...d, substituidoFuncionarioId: v }))}
                                                    placeholder="funcionário"
                                                    required
                                                    disabled={viewOnly}
                                                    data-testid="select-funcionario-desligamento"
                                                />
                                            </div>
                                            <div>
                                                <label className={L}>Data de desligamento *</label>
                                                <Input
                                                    type="date"
                                                    value={draft.dataDesligamento ?? ""}
                                                    onChange={(e) => setDraft((d) => ({ ...d, dataDesligamento: e.target.value || null }))}
                                                    disabled={viewOnly}
                                                    data-testid="input-data-desligamento"
                                                />
                                            </div>
                                            <div>
                                                <label className={L}>Tipo aviso prévio</label>
                                                <select
                                                    className={S}
                                                    value={draft.tipoAvisoPrevioDesligamento ?? ""}
                                                    onChange={(e) => setDraft((d) => ({ ...d, tipoAvisoPrevioDesligamento: e.target.value !== "" ? Number(e.target.value) : null }))}
                                                    disabled={viewOnly}
                                                    data-testid="select-tipo-aviso"
                                                >
                                                    <option value="">Selecione...</option>
                                                    <option value={0}>Indenizado</option>
                                                    <option value={1}>Trabalhado</option>
                                                    <option value={2}>Dispensado</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={L}>Dias aviso prévio</label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={90}
                                                    value={draft.diasAvisoPrevioDesligamento ?? ""}
                                                    onChange={(e) => setDraft((d) => ({ ...d, diasAvisoPrevioDesligamento: e.target.value === "" ? null : Number(e.target.value) }))}
                                                    disabled={viewOnly}
                                                />
                                            </div>
                                            <div className="col-span-3 flex items-center gap-2">
                                                <input
                                                    id="chk-estabilidade"
                                                    type="checkbox"
                                                    checked={draft.possuiEstabilidadeDesligamento === true}
                                                    onChange={(e) => setDraft((d) => ({ ...d, possuiEstabilidadeDesligamento: e.target.checked }))}
                                                    className="rounded border-input"
                                                    disabled={viewOnly}
                                                />
                                                <label htmlFor="chk-estabilidade" className={`text-sm ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                                    Funcionário possui estabilidade
                                                </label>
                                            </div>
                                            <div className="col-span-3">
                                                <label className={L}>Motivo do desligamento</label>
                                                <textarea
                                                    className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                                    rows={2}
                                                    value={draft.motivoDesligamentoTexto}
                                                    onChange={(e) => setDraft((d) => ({ ...d, motivoDesligamentoTexto: e.target.value }))}
                                                    placeholder="Contexto/observações do desligamento (diferente da justificativa da vaga nova)"
                                                    maxLength={2000}
                                                    disabled={viewOnly}
                                                    data-testid="textarea-motivo-desligamento"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Decisão de headcount — VagaNova e AumentoQuadro (substituição usa provisório por default) */}
                                {exigeDecisaoHeadcountGestor && !isRmViewOnly && (
                                    <div className="col-span-3 rounded-md border border-dashed border-sky-400/70 bg-sky-50/40 p-3" data-testid="bloco-decisao-hc">
                                        <div className="mb-2 text-xs font-semibold text-sky-800">
                                            Decisão de headcount *
                                            <span className="ml-2 font-normal text-[11px] text-sky-700/80">
                                                {draft.tipoSolicitacao === 2
                                                    ? "Como esta vaga afeta o quadro? Defina antes de enviar para aprovação."
                                                    : "Como esta vaga afeta o quadro? Escolha antes de enviar para aprovação."}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`flex items-start gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                                <input
                                                    type="radio" name="decisaoRH"
                                                    checked={draft.decisaoRH === 3}
                                                    onChange={() => setDraft((d) => ({ ...d, decisaoRH: 3 }))}
                                                    disabled={viewOnly}
                                                    data-testid="radio-decisao-consumir"
                                                    className="mt-0.5"
                                                />
                                                <span className="text-sm">
                                                    <strong>Consumir headcount existente</strong>
                                                    <span className="text-muted-foreground"> — já há slot aprovado em aberto; a vaga utiliza posição existente sem aumentar HC.</span>
                                                </span>
                                            </label>
                                            <label className={`flex items-start gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                                <input
                                                    type="radio" name="decisaoRH"
                                                    checked={draft.decisaoRH === 1}
                                                    onChange={() => setDraft((d) => ({ ...d, decisaoRH: 1 }))}
                                                    disabled={viewOnly}
                                                    data-testid="radio-decisao-provisoria"
                                                    className="mt-0.5"
                                                />
                                                <span className="text-sm">
                                                    <strong>Substituição provisória</strong>
                                                    <span className="text-muted-foreground"> — headcount temporário com prazo de revisão.</span>
                                                </span>
                                            </label>
                                            {draft.decisaoRH === 1 && (
                                                <div className="ml-6 grid grid-cols-2 gap-x-3 gap-y-2">
                                                    <div>
                                                        <label className={L}>Prazo (meses) *</label>
                                                        <Input
                                                            type="number" min={1} max={36}
                                                            value={draft.decisaoRHPrazoMeses ?? ""}
                                                            onChange={(e) => setDraft((d) => ({ ...d, decisaoRHPrazoMeses: e.target.value === "" ? null : Math.max(1, Number(e.target.value)) }))}
                                                            disabled={viewOnly}
                                                            data-testid="input-decisao-prazo-meses"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={L}>Data alvo (opcional)</label>
                                                        <Input
                                                            type="datetime-local"
                                                            value={draft.decisaoRHPrazoDataAlvo ? draft.decisaoRHPrazoDataAlvo.slice(0, 16) : ""}
                                                            onChange={(e) => setDraft((d) => ({ ...d, decisaoRHPrazoDataAlvo: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                                                            disabled={viewOnly}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <label className={`flex items-start gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                                <input
                                                    type="radio" name="decisaoRH"
                                                    checked={draft.decisaoRH === 2}
                                                    onChange={() => setDraft((d) => ({ ...d, decisaoRH: 2 }))}
                                                    disabled={viewOnly}
                                                    data-testid="radio-decisao-aumento"
                                                    className="mt-0.5"
                                                />
                                                <span className="text-sm">
                                                    <strong>Aumento definitivo de headcount</strong>
                                                    <span className="text-muted-foreground"> — aumenta o quadro permanentemente; vai para aprovação da Diretoria antes de abrir.</span>
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {!isRmViewOnly && (
                                <div className="col-span-3 flex items-center gap-6 py-1">
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.cnhObrigatoria} onChange={(e) => setDraft((d) => ({ ...d, cnhObrigatoria: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">CNH obrigatória</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.disponibilidadeViagens} onChange={(e) => setDraft((d) => ({ ...d, disponibilidadeViagens: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Disponível para viagens</span>
                                    </label>
                                    <label className={`flex items-center gap-2 ${viewOnly ? "cursor-default" : "cursor-pointer"}`}>
                                        <input type="checkbox" checked={draft.isConfidencial} onChange={(e) => setDraft((d) => ({ ...d, isConfidencial: e.target.checked }))} className="rounded border-input" disabled={viewOnly} />
                                        <span className="text-sm">Confidencial</span>
                                    </label>
                                </div>
                                )}

                                <div className="col-span-3">
                                    <label className={L}>
                                        {draft.tipoSolicitacao === 2 ? LB.justificativaObrig : LB.justificativa}
                                    </label>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground resize-none disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-default"
                                        rows={3}
                                        value={draft.justificativa}
                                        onChange={(e) => setDraft((d) => ({ ...d, justificativa: e.target.value }))}
                                        placeholder="Justifique a necessidade da contratação..."
                                        maxLength={2000}
                                        disabled={viewOnly}
                                    />
                                </div>

                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 3 — Horário ══════════════ */}
                        <TabsContent value="horario" className="mt-0">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Turno</label>
                                    <AutocompleteSelect
                                        items={turnoSelectItems}
                                        value={draft.turnoId}
                                        onChange={(id) =>
                                            setDraft((d) => ({
                                                ...d,
                                                turnoId: id,
                                                escalaTrabalho: id ? "" : d.escalaTrabalho,
                                            }))}
                                        placeholder={turnosLookupLoading ? "Carregando turnos…" : "turno"}
                                        disabled={viewOnly || turnosLookupLoading}
                                    />
                                </div>

                                {draft.turnoId && turnoDetalhe && (
                                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                                        <p className="font-medium text-foreground">
                                            {String(turnoDetalhe.code ?? turnoDetalhe.Code ?? "")} — {String(turnoDetalhe.description ?? turnoDetalhe.Description ?? "")}
                                        </p>
                                        {(turnoDetalhe.startTime != null || turnoDetalhe.StartTime != null
                                            || turnoDetalhe.endTime != null || turnoDetalhe.EndTime != null) && (
                                            <p className="text-muted-foreground">
                                                {String(turnoDetalhe.startTime ?? turnoDetalhe.StartTime ?? "—")}
                                                {" "}
                                                às
                                                {" "}
                                                {String(turnoDetalhe.endTime ?? turnoDetalhe.EndTime ?? "—")}
                                            </p>
                                        )}
                                        {(turnoDetalhe.unidadeLotacaoNome != null || turnoDetalhe.UnidadeLotacaoNome != null) && (
                                            <p className="text-muted-foreground">
                                                Lotação do turno:{" "}
                                                {String(turnoDetalhe.unidadeLotacaoNome ?? turnoDetalhe.UnidadeLotacaoNome ?? "")}
                                            </p>
                                        )}
                                        {(turnoDetalhe.notes != null || turnoDetalhe.Notes != null) && String(turnoDetalhe.notes ?? turnoDetalhe.Notes ?? "").trim() !== "" && (
                                            <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                                                {String(turnoDetalhe.notes ?? turnoDetalhe.Notes ?? "")}
                                            </p>
                                        )}
                                        {(() => {
                                            const gj = String(turnoDetalhe.gradeHorarioJson ?? turnoDetalhe.GradeHorarioJson ?? "").trim();
                                            return gj ? (
                                                <div className="pt-2 space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">Grade semanal (cadastro)</p>
                                                    <HorarioEditor value={gj} readonly />
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                )}

                                {!draft.turnoId && !viewOnly && (
                                    <div>
                                        <label className="text-sm font-medium">Horário legado (texto livre / JSON antigo)</label>
                                        <textarea
                                            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs font-mono placeholder:text-muted-foreground resize-y min-h-[100px]"
                                            value={draft.escalaTrabalho}
                                            onChange={(e) => setDraft((d) => ({ ...d, escalaTrabalho: e.target.value }))}
                                            placeholder="Use apenas se ainda não existir turno cadastrado para esta posição. Prefira selecionar um turno."
                                            maxLength={8000}
                                        />
                                    </div>
                                )}

                                {!draft.turnoId && viewOnly && (draft.escalaTrabalho || "").trim() !== "" && (
                                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                                            Horário legado (formato antigo)
                                        </p>
                                        <pre className="text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-background/80 rounded p-2 border border-border">
                                            {draft.escalaTrabalho}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ══════════════ TAB 4 — Aprovações RM ══════════════ */}
                        <TabsContent value="aprovacao" className="mt-0">
                            {rmPareceres.length > 0 ? (
                                <div className="mx-auto mb-4 max-w-2xl rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                                    <div className="mb-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Histórico RM
                                        </p>
                                        <h4 className="text-sm font-semibold text-foreground">Pareceres e aprovações da requisição</h4>
                                    </div>
                                    <ol className="relative space-y-4 pl-7">
                                        <span className="absolute bottom-0 left-2 top-0 w-px bg-border" aria-hidden />
                                        {rmPareceres.map((parecer) => (
                                            <li key={parecer.idParecer} className="relative grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-3">
                                                <span className="z-10 flex size-4 items-center justify-center rounded-full border border-primary/30 bg-background">
                                                    <span className="size-2 rounded-full bg-primary" />
                                                </span>
                                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {parecer.solicitante || "Solicitante RM"}
                                                            </p>
                                                            {!!parecer.chapaSolicitante?.trim() && (
                                                                <p className="font-mono text-xs text-muted-foreground">{parecer.chapaSolicitante}</p>
                                                            )}
                                                        </div>
                                                        <div className="text-right text-xs text-muted-foreground">
                                                            <div>{formatDateTimeForDisplay(parecer.dataParecer)}</div>
                                                            <div>Parecer #{parecer.idParecer}</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                        {parecer.codStatus != null && (
                                                            <span className="rounded-full border bg-background px-2 py-0.5">CODSTATUS {parecer.codStatus}</span>
                                                        )}
                                                        {parecer.status && (
                                                            <span className="rounded-full border bg-background px-2 py-0.5">{parecer.status}</span>
                                                        )}
                                                    </div>
                                                    {parecer.parecer?.trim() && (
                                                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{parecer.parecer}</p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ) : (
                                <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                                    <p className="text-sm font-medium text-foreground">Nenhuma aprovação RM importada ainda.</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Reimporte as requisições aprovadas para carregar o histórico de pareceres do RM.
                                    </p>
                                </div>
                            )}

                            {!gestorDiretoId && !viewOnly && (
                                <div className="mx-auto mt-2 max-w-lg border-t border-border pt-6 pb-2">
                                    <label className={L}>Definir aprovador</label>
                                    <FuncionarioAsyncSelect
                                        value={draft.aprovadorId}
                                        onChange={(v) => setDraft((d) => ({ ...d, aprovadorId: v }))}
                                        placeholder="aprovador"
                                        disabled={viewOnly}
                                    />
                                    <p className="text-xs text-amber-600 mt-2">
                                        Sem gestor direto cadastrado no seu perfil. Escolha quem deve receber esta solicitação.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                        </div>
                    </Tabs>
                )}

                {!hideFooter && (
                    <div className="mt-0 flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-background pt-3">
                        {viewOnly ? (
                            <Button variant="outline" type="button" onClick={onCancel}>Fechar</Button>
                        ) : (
                            <>
                                <Button variant="outline" type="button" onClick={onCancel} disabled={saving}>Cancelar</Button>
                                <Button type="button" onClick={() => void save()} disabled={saving || loadingEdit}>
                                    {saving ? "Enviando…" : effectiveResubmitAfterSave ? "Salvar e reenviar para aprovação" : editId ? "Salvar alterações" : "Solicitar aprovação"}
                                </Button>
                            </>
                        )}
                    </div>
                )}
        </div>
    );
}
