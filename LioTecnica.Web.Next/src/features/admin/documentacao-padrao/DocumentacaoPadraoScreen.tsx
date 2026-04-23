"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, FileCheck, Layers, RotateCcw, History, ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocItem {
    tipoDocumento: number;
    label: string;
    /** 0 = Obrigatório | 1 = Opcional | 2 = Não será pedido */
    configuracao: number;
}

interface DocOverrideItem extends DocItem {
    overrideAtivo: boolean;
}

interface DocPorCargoItem extends DocItem {
    overrideCargoAtivo: boolean;
    overrideNivelCargoAtivo: boolean;
    /** "cargo" | "nivel" | "global" */
    origem: string;
}

interface NivelCargoLookup {
    id: string;
    cdnNivCargo: number;
    nomReduz: string;
    nomComplet: string;
    displayName: string;
}

interface CargoLookup {
    id: string;
    code: string;
    name: string;
    centroCustoId?: string;
    centroCustoName?: string;
    seniority?: string;
}

interface PorNivelResponse {
    nivelCargoId: string;
    nivelCargoNome: string;
    documentos: DocOverrideItem[];
}

interface PorCargoResponse {
    cargoId: string;
    cargoCode: string;
    cargoNome: string;
    nivelCargoId: string | null;
    nivelCargoNome: string | null;
    documentos: DocPorCargoItem[];
}

const CONFIG_OPTIONS = [
    { value: "0", label: "Obrigatório" },
    { value: "1", label: "Opcional" },
    { value: "2", label: "Não será pedido" },
];

// Tipos extras que sempre aparecem (independente do backend estar atualizado)
const TIPOS_EXTRAS: DocItem[] = [
    { tipoDocumento: 20, label: "CNPJ", configuracao: 2 },
    { tipoDocumento: 21, label: "Contrato Social/MEI", configuracao: 2 },
    { tipoDocumento: 22, label: "Conta Bancária PJ", configuracao: 2 },
    { tipoDocumento: 23, label: "Certidões Negativas", configuracao: 2 },
];

const CONFIG_BADGE: Record<number, { text: string; className: string }> = {
    0: { text: "Obrigatório", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    1: { text: "Opcional", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    2: { text: "Não será pedido", className: "bg-muted text-muted-foreground" },
};

type Tab = "global" | "por-nivel" | "por-cargo" | "historico";

type HistoricoEscopo = 0 | 1 | 2; // 0 = Global, 1 = PorNivelCargo, 2 = PorCargo
type HistoricoAcao = 0 | 1 | 2; // 0 = Criado, 1 = Alterado, 2 = Removido

interface HistoricoItem {
    id: string;
    escopo: HistoricoEscopo;
    nivelCargoId: string | null;
    nivelCargoNome: string | null;
    cargoId: string | null;
    cargoNome: string | null;
    tipoDocumento: number;
    tipoDocumentoLabel: string;
    configuracaoAnterior: number | null;
    configuracaoNova: number | null;
    acao: HistoricoAcao;
    userId: string | null;
    userNome: string | null;
    criadoEmUtc: string;
}

interface HistoricoResponse {
    items: HistoricoItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

const ACAO_BADGE: Record<HistoricoAcao, { text: string; className: string }> = {
    0: { text: "Criado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    1: { text: "Alterado", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    2: { text: "Removido", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
};

const ESCOPO_LABEL: Record<HistoricoEscopo, string> = {
    0: "Global",
    1: "Por nível",
    2: "Por cargo",
};

const ORIGEM_BADGE: Record<string, { text: string; className: string }> = {
    cargo: { text: "Cargo", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
    nivel: { text: "Nível", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    global: { text: "Global", className: "bg-muted text-muted-foreground" },
};

function formatConfig(v: number | null): string {
    if (v === null) return "—";
    return CONFIG_BADGE[v]?.text ?? String(v);
}

function formatDataHora(iso: string): string {
    try {
        return new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

export default function DocumentacaoPadraoScreen() {
    const [tab, setTab] = useState<Tab>("global");

    // ── Aba Global ─────────────────────────────────────────────────────────────
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [loadingGlobal, setLoadingGlobal] = useState(true);
    const [savingGlobal, setSavingGlobal] = useState(false);

    // ── Aba Por Nível de Cargo ─────────────────────────────────────────────────
    const [niveis, setNiveis] = useState<NivelCargoLookup[]>([]);
    const [loadingNiveis, setLoadingNiveis] = useState(false);
    const [selectedNivelId, setSelectedNivelId] = useState<string>("");
    const [selectedNivelNome, setSelectedNivelNome] = useState<string>("");
    const [loadingOverride, setLoadingOverride] = useState(false);
    const [savingOverride, setSavingOverride] = useState(false);
    const [docsOverride, setDocsOverride] = useState<DocOverrideItem[]>([]);

    // ── Aba Por Cargo ──────────────────────────────────────────────────────────
    const [cargos, setCargos] = useState<CargoLookup[]>([]);
    const [loadingCargos, setLoadingCargos] = useState(false);
    const [selectedCargoId, setSelectedCargoId] = useState<string>("");
    const [selectedCargoNome, setSelectedCargoNome] = useState<string>("");
    const [selectedCargoNivelNome, setSelectedCargoNivelNome] = useState<string | null>(null);
    const [loadingCargoOverride, setLoadingCargoOverride] = useState(false);
    const [savingCargoOverride, setSavingCargoOverride] = useState(false);
    const [docsCargoOverride, setDocsCargoOverride] = useState<DocPorCargoItem[]>([]);

    // ── Aba Histórico ──────────────────────────────────────────────────────────
    const [historicoItems, setHistoricoItems] = useState<HistoricoItem[]>([]);
    const [historicoTotal, setHistoricoTotal] = useState(0);
    const [historicoPage, setHistoricoPage] = useState(1);
    const [historicoTotalPages, setHistoricoTotalPages] = useState(1);
    const [historicoEscopoFilter, setHistoricoEscopoFilter] = useState<"" | "0" | "1" | "2">("");
    const [historicoNivelFilter, setHistoricoNivelFilter] = useState<string>("");
    const [historicoCargoFilter, setHistoricoCargoFilter] = useState<string>("");
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const historicoPageSize = 50;

    // ── Loaders ────────────────────────────────────────────────────────────────
    const loadGlobal = useCallback(async () => {
        setLoadingGlobal(true);
        try {
            const res = await apiFetch("/api/admin/documentacao-padrao");
            const data = await res.json() as DocItem[];
            const tiposNaLista = new Set(data.map((d) => d.tipoDocumento));
            const extras = TIPOS_EXTRAS.filter((t) => !tiposNaLista.has(t.tipoDocumento));
            setDocs([...data, ...extras]);
        } catch {
            toast.error("Erro ao carregar configuração global.");
        } finally {
            setLoadingGlobal(false);
        }
    }, []);

    const loadNiveis = useCallback(async () => {
        setLoadingNiveis(true);
        try {
            const res = await apiFetch("/api/nivel-cargo/lookup");
            const data = await res.json() as NivelCargoLookup[];
            setNiveis(data);
        } catch {
            toast.error("Falha ao carregar níveis de cargo.");
        } finally {
            setLoadingNiveis(false);
        }
    }, []);

    const loadOverride = useCallback(async (nivelCargoId: string) => {
        if (!nivelCargoId) {
            setDocsOverride([]);
            setSelectedNivelNome("");
            return;
        }
        setLoadingOverride(true);
        try {
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-nivel-cargo/${nivelCargoId}`);
            if (!res.ok) throw new Error();
            const data = await res.json() as PorNivelResponse;
            setSelectedNivelNome(data.nivelCargoNome ?? "");
            // Merge com TIPOS_EXTRAS quando ainda não vierem do backend
            const tiposNaLista = new Set(data.documentos.map((d) => d.tipoDocumento));
            const extras: DocOverrideItem[] = TIPOS_EXTRAS
                .filter((t) => !tiposNaLista.has(t.tipoDocumento))
                .map((t) => ({ ...t, overrideAtivo: false }));
            setDocsOverride([...data.documentos, ...extras]);
        } catch {
            toast.error("Falha ao carregar overrides do nível de cargo.");
            setDocsOverride([]);
        } finally {
            setLoadingOverride(false);
        }
    }, []);

    const loadCargos = useCallback(async () => {
        setLoadingCargos(true);
        try {
            const res = await apiFetch("/api/job-positions/lookup");
            const data = await res.json() as CargoLookup[];
            setCargos(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Falha ao carregar cargos.");
        } finally {
            setLoadingCargos(false);
        }
    }, []);

    const loadCargoOverride = useCallback(async (cargoId: string) => {
        if (!cargoId) {
            setDocsCargoOverride([]);
            setSelectedCargoNome("");
            setSelectedCargoNivelNome(null);
            return;
        }
        setLoadingCargoOverride(true);
        try {
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-cargo/${cargoId}`);
            if (!res.ok) throw new Error();
            const data = await res.json() as PorCargoResponse;
            setSelectedCargoNome(data.cargoNome ?? "");
            setSelectedCargoNivelNome(data.nivelCargoNome ?? null);
            const tiposNaLista = new Set(data.documentos.map((d) => d.tipoDocumento));
            const extras: DocPorCargoItem[] = TIPOS_EXTRAS
                .filter((t) => !tiposNaLista.has(t.tipoDocumento))
                .map((t) => ({ ...t, overrideCargoAtivo: false, overrideNivelCargoAtivo: false, origem: "global" }));
            setDocsCargoOverride([...data.documentos, ...extras]);
        } catch {
            toast.error("Falha ao carregar overrides do cargo.");
            setDocsCargoOverride([]);
        } finally {
            setLoadingCargoOverride(false);
        }
    }, []);

    const loadHistorico = useCallback(async (page: number, escopo: "" | "0" | "1" | "2", nivelId: string, cargoId: string) => {
        setLoadingHistorico(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(historicoPageSize));
            if (escopo !== "") params.set("escopo", escopo);
            if (nivelId) params.set("nivelCargoId", nivelId);
            if (cargoId) params.set("cargoId", cargoId);
            const res = await apiFetch(`/api/admin/documentacao-padrao/historico?${params.toString()}`);
            if (!res.ok) throw new Error();
            const data = await res.json() as HistoricoResponse;
            setHistoricoItems(data.items);
            setHistoricoTotal(data.total);
            setHistoricoPage(data.page);
            setHistoricoTotalPages(data.totalPages);
        } catch {
            toast.error("Falha ao carregar histórico.");
            setHistoricoItems([]);
        } finally {
            setLoadingHistorico(false);
        }
    }, []);

    useEffect(() => { void loadGlobal(); }, [loadGlobal]);
    useEffect(() => { if (tab === "por-nivel" && niveis.length === 0) void loadNiveis(); }, [tab, niveis.length, loadNiveis]);
    useEffect(() => { if (tab === "por-cargo" && cargos.length === 0) void loadCargos(); }, [tab, cargos.length, loadCargos]);
    useEffect(() => {
        if (tab === "historico") {
            if (niveis.length === 0) void loadNiveis();
            if (cargos.length === 0) void loadCargos();
        }
    }, [tab, niveis.length, cargos.length, loadNiveis, loadCargos]);
    useEffect(() => { if (selectedNivelId) void loadOverride(selectedNivelId); }, [selectedNivelId, loadOverride]);
    useEffect(() => { if (selectedCargoId) void loadCargoOverride(selectedCargoId); }, [selectedCargoId, loadCargoOverride]);
    useEffect(() => {
        if (tab === "historico") {
            void loadHistorico(1, historicoEscopoFilter, historicoNivelFilter, historicoCargoFilter);
        }
    }, [tab, historicoEscopoFilter, historicoNivelFilter, historicoCargoFilter, loadHistorico]);

    // ── Mutators ───────────────────────────────────────────────────────────────
    function setConfigGlobal(tipoDocumento: number, configuracao: number) {
        setDocs((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento ? { ...d, configuracao } : d)
        );
    }

    function setConfigOverride(tipoDocumento: number, configuracao: number) {
        setDocsOverride((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento
                ? { ...d, configuracao, overrideAtivo: true }
                : d)
        );
    }

    function herdarDoGlobal(tipoDocumento: number) {
        // Restaurar override: aplicar valor global atual + overrideAtivo=false
        const global = docs.find((d) => d.tipoDocumento === tipoDocumento);
        if (!global) return;
        setDocsOverride((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento
                ? { ...d, configuracao: global.configuracao, overrideAtivo: false }
                : d)
        );
    }

    function setConfigCargoOverride(tipoDocumento: number, configuracao: number) {
        setDocsCargoOverride((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento
                ? { ...d, configuracao, overrideCargoAtivo: true, origem: "cargo" }
                : d)
        );
    }

    function herdarCargoDoNivelOuGlobal(tipoDocumento: number) {
        // Remove o override por cargo: a UI não recalcula (o backend é fonte da verdade após save)
        // Marcamos o item como overrideCargoAtivo=false; após save → reload do backend resolve a hierarquia
        setDocsCargoOverride((prev) =>
            prev.map((d) => d.tipoDocumento === tipoDocumento
                ? { ...d, overrideCargoAtivo: false, origem: d.overrideNivelCargoAtivo ? "nivel" : "global" }
                : d)
        );
    }

    // ── Savers ─────────────────────────────────────────────────────────────────
    async function saveGlobal() {
        setSavingGlobal(true);
        try {
            const res = await apiFetch("/api/admin/documentacao-padrao", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentos: docs.map((d) => ({
                        tipoDocumento: d.tipoDocumento,
                        configuracao: d.configuracao,
                    })),
                }),
            });
            if (!res.ok) throw new Error();
            toast.success("Configuração global salva.");
        } catch {
            toast.error("Erro ao salvar configuração global.");
        } finally {
            setSavingGlobal(false);
        }
    }

    async function saveOverride() {
        if (!selectedNivelId) return;
        setSavingOverride(true);
        try {
            const somenteOverrides = docsOverride
                .filter((d) => d.overrideAtivo)
                .map((d) => ({ tipoDocumento: d.tipoDocumento, configuracao: d.configuracao }));
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-nivel-cargo/${selectedNivelId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentos: somenteOverrides }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Overrides salvos para ${selectedNivelNome}.`);
            await loadOverride(selectedNivelId); // refresh para sincronizar overrideAtivo
        } catch {
            toast.error("Erro ao salvar overrides.");
        } finally {
            setSavingOverride(false);
        }
    }

    async function limparTodosOverrides() {
        if (!selectedNivelId) return;
        if (!confirm(`Remover TODOS os overrides do nível ${selectedNivelNome}? Todos os tipos voltarão a herdar do padrão global.`)) return;
        setSavingOverride(true);
        try {
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-nivel-cargo/${selectedNivelId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentos: [] }),
            });
            if (!res.ok) throw new Error();
            toast.success("Overrides removidos — voltou para o padrão global.");
            await loadOverride(selectedNivelId);
        } catch {
            toast.error("Erro ao limpar overrides.");
        } finally {
            setSavingOverride(false);
        }
    }

    async function saveCargoOverride() {
        if (!selectedCargoId) return;
        setSavingCargoOverride(true);
        try {
            const somenteOverrides = docsCargoOverride
                .filter((d) => d.overrideCargoAtivo)
                .map((d) => ({ tipoDocumento: d.tipoDocumento, configuracao: d.configuracao }));
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-cargo/${selectedCargoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentos: somenteOverrides }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Overrides salvos para ${selectedCargoNome}.`);
            await loadCargoOverride(selectedCargoId);
        } catch {
            toast.error("Erro ao salvar overrides do cargo.");
        } finally {
            setSavingCargoOverride(false);
        }
    }

    async function limparTodosOverridesCargo() {
        if (!selectedCargoId) return;
        if (!confirm(`Remover TODOS os overrides específicos do cargo ${selectedCargoNome}? Todos os tipos voltarão a herdar do nível de cargo (ou padrão global).`)) return;
        setSavingCargoOverride(true);
        try {
            const res = await apiFetch(`/api/admin/documentacao-padrao/por-cargo/${selectedCargoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentos: [] }),
            });
            if (!res.ok) throw new Error();
            toast.success("Overrides do cargo removidos — herdando da hierarquia.");
            await loadCargoOverride(selectedCargoId);
        } catch {
            toast.error("Erro ao limpar overrides do cargo.");
        } finally {
            setSavingCargoOverride(false);
        }
    }

    const overridesCount = useMemo(
        () => docsOverride.filter((d) => d.overrideAtivo).length,
        [docsOverride],
    );

    const overridesCargoCount = useMemo(
        () => docsCargoOverride.filter((d) => d.overrideCargoAtivo).length,
        [docsCargoOverride],
    );

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <FileCheck className="size-5 text-lt-primary" />
                        Documentação Padrão
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Defina quais documentos serão solicitados na admissão. A hierarquia é
                        <strong> Cargo &gt; Nível de Cargo &gt; Global</strong> — o nível mais específico vence.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-border/60">
                <button
                    type="button"
                    onClick={() => setTab("global")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        tab === "global"
                            ? "border-lt-primary text-lt-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Padrão Global
                </button>
                <button
                    type="button"
                    onClick={() => setTab("por-nivel")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        tab === "por-nivel"
                            ? "border-lt-primary text-lt-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Layers className="size-4" />
                    Por Nível de Cargo
                </button>
                <button
                    type="button"
                    onClick={() => setTab("por-cargo")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        tab === "por-cargo"
                            ? "border-lt-primary text-lt-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Briefcase className="size-4" />
                    Por Cargo
                </button>
                <button
                    type="button"
                    onClick={() => setTab("historico")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        tab === "historico"
                            ? "border-lt-primary text-lt-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <History className="size-4" />
                    Histórico
                </button>
            </div>

            {tab === "global" && (
                <section className="flex flex-col gap-4">
                    <div className="flex justify-end">
                        <Button onClick={saveGlobal} disabled={savingGlobal || loadingGlobal}>
                            {savingGlobal
                                ? <><Loader2 className="size-4 mr-2 animate-spin" />Salvando...</>
                                : <><Save className="size-4 mr-2" />Salvar global</>}
                        </Button>
                    </div>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border/60">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">Configuração</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingGlobal ? (
                                    <tr>
                                        <td colSpan={2} className="text-center py-12 text-muted-foreground">
                                            <Loader2 className="size-5 animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : docs.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="text-center py-12 text-muted-foreground">
                                            Nenhum documento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    docs.map((doc, i) => {
                                        const badge = CONFIG_BADGE[doc.configuracao];
                                        return (
                                            <tr
                                                key={doc.tipoDocumento}
                                                className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{doc.label}</span>
                                                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                                                            {badge.text}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={doc.configuracao}
                                                        onChange={(e) => setConfigGlobal(doc.tipoDocumento, Number(e.target.value))}
                                                        className="w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                    >
                                                        {CONFIG_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {tab === "por-nivel" && (
                <section className="flex flex-col gap-4">
                    <div className="flex items-end gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Nível de Cargo</label>
                            <select
                                value={selectedNivelId}
                                onChange={(e) => setSelectedNivelId(e.target.value)}
                                disabled={loadingNiveis}
                                className="min-w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">— Selecione —</option>
                                {niveis.map((n) => (
                                    <option key={n.id} value={n.id}>{n.displayName}</option>
                                ))}
                            </select>
                        </div>
                        {selectedNivelId && (
                            <>
                                <div className="text-xs text-muted-foreground">
                                    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                        {overridesCount} override{overridesCount !== 1 ? "s" : ""} ativo{overridesCount !== 1 ? "s" : ""}
                                    </Badge>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={limparTodosOverrides} disabled={savingOverride || overridesCount === 0}>
                                        <RotateCcw className="size-4 mr-2" />
                                        Limpar todos
                                    </Button>
                                    <Button onClick={saveOverride} disabled={savingOverride || loadingOverride}>
                                        {savingOverride
                                            ? <><Loader2 className="size-4 mr-2 animate-spin" />Salvando...</>
                                            : <><Save className="size-4 mr-2" />Salvar overrides</>}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {!selectedNivelId ? (
                        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
                            Selecione um nível de cargo para configurar os overrides. Cada tipo de documento pode ser
                            <strong> ajustado</strong> (ex.: obrigatório no trainee, opcional no analista) ou
                            <strong> deixado em branco</strong> para herdar do padrão global.
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border/60 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border/60">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Global (fallback)</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">Configuração p/ {selectedNivelNome}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingOverride ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12 text-muted-foreground">
                                                <Loader2 className="size-5 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : (
                                        docsOverride.map((doc, i) => {
                                            const globalItem = docs.find((d) => d.tipoDocumento === doc.tipoDocumento);
                                            const globalBadge = globalItem ? CONFIG_BADGE[globalItem.configuracao] : CONFIG_BADGE[2];
                                            return (
                                                <tr
                                                    key={doc.tipoDocumento}
                                                    className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"} ${doc.overrideAtivo ? "bg-violet-50/30 dark:bg-violet-900/10" : ""}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <span className="font-medium">{doc.label}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${globalBadge.className}`}>
                                                            {globalBadge.text}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={doc.configuracao}
                                                                onChange={(e) => setConfigOverride(doc.tipoDocumento, Number(e.target.value))}
                                                                className="w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                            >
                                                                {CONFIG_OPTIONS.map((opt) => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                            {doc.overrideAtivo && (
                                                                <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-800 text-[10px]">
                                                                    Custom
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => herdarDoGlobal(doc.tipoDocumento)}
                                                            disabled={!doc.overrideAtivo}
                                                            title={doc.overrideAtivo ? "Herdar do padrão global" : "Já está herdando"}
                                                        >
                                                            <RotateCcw className="size-3 mr-1" />
                                                            Herdar
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {tab === "por-cargo" && (
                <section className="flex flex-col gap-4">
                    <div className="flex items-end gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Cargo</label>
                            <select
                                value={selectedCargoId}
                                onChange={(e) => setSelectedCargoId(e.target.value)}
                                disabled={loadingCargos}
                                className="min-w-[340px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">— Selecione —</option>
                                {cargos.map((c) => (
                                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedCargoId && (
                            <>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                        {overridesCargoCount} override{overridesCargoCount !== 1 ? "s" : ""} de cargo
                                    </Badge>
                                    {selectedCargoNivelNome && (
                                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                                            Nível: {selectedCargoNivelNome}
                                        </Badge>
                                    )}
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={limparTodosOverridesCargo} disabled={savingCargoOverride || overridesCargoCount === 0}>
                                        <RotateCcw className="size-4 mr-2" />
                                        Limpar todos
                                    </Button>
                                    <Button onClick={saveCargoOverride} disabled={savingCargoOverride || loadingCargoOverride}>
                                        {savingCargoOverride
                                            ? <><Loader2 className="size-4 mr-2 animate-spin" />Salvando...</>
                                            : <><Save className="size-4 mr-2" />Salvar overrides</>}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {!selectedCargoId ? (
                        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
                            Selecione um cargo para configurar overrides específicos. A hierarquia é
                            <strong> Cargo &gt; Nível &gt; Global</strong>: o override por cargo vence o nível, que vence o global.
                            Use isto quando um cargo (ex.: <em>Diretor Financeiro</em>) precisa de exceções
                            que não se aplicam ao nível inteiro.
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border/60 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border/60">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Origem atual</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">Configuração p/ {selectedCargoNome}</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingCargoOverride ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12 text-muted-foreground">
                                                <Loader2 className="size-5 animate-spin mx-auto" />
                                            </td>
                                        </tr>
                                    ) : (
                                        docsCargoOverride.map((doc, i) => {
                                            const origemBadge = ORIGEM_BADGE[doc.origem] ?? ORIGEM_BADGE.global;
                                            return (
                                                <tr
                                                    key={doc.tipoDocumento}
                                                    className={`border-b border-border/40 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"} ${doc.overrideCargoAtivo ? "bg-violet-50/30 dark:bg-violet-900/10" : ""}`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <span className="font-medium">{doc.label}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${origemBadge.className}`}>
                                                            {origemBadge.text}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={doc.configuracao}
                                                                onChange={(e) => setConfigCargoOverride(doc.tipoDocumento, Number(e.target.value))}
                                                                className="w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                            >
                                                                {CONFIG_OPTIONS.map((opt) => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                            {doc.overrideCargoAtivo && (
                                                                <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-800 text-[10px]">
                                                                    Custom (cargo)
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => herdarCargoDoNivelOuGlobal(doc.tipoDocumento)}
                                                            disabled={!doc.overrideCargoAtivo}
                                                            title={doc.overrideCargoAtivo ? "Herdar do nível ou global" : "Já está herdando da hierarquia"}
                                                        >
                                                            <RotateCcw className="size-3 mr-1" />
                                                            Herdar
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {tab === "historico" && (
                <section className="flex flex-col gap-4">
                    {/* Filtros */}
                    <div className="flex items-end gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Escopo</label>
                            <select
                                value={historicoEscopoFilter}
                                onChange={(e) => {
                                    const v = e.target.value as "" | "0" | "1" | "2";
                                    setHistoricoEscopoFilter(v);
                                    if (v !== "1") setHistoricoNivelFilter("");
                                    if (v !== "2") setHistoricoCargoFilter("");
                                }}
                                className="min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">Todos</option>
                                <option value="0">Global</option>
                                <option value="1">Por nível de cargo</option>
                                <option value="2">Por cargo</option>
                            </select>
                        </div>
                        {historicoEscopoFilter === "1" && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-muted-foreground">Nível de Cargo</label>
                                <select
                                    value={historicoNivelFilter}
                                    onChange={(e) => setHistoricoNivelFilter(e.target.value)}
                                    disabled={loadingNiveis}
                                    className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">— Todos —</option>
                                    {niveis.map((n) => (
                                        <option key={n.id} value={n.id}>{n.displayName}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {historicoEscopoFilter === "2" && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-muted-foreground">Cargo</label>
                                <select
                                    value={historicoCargoFilter}
                                    onChange={(e) => setHistoricoCargoFilter(e.target.value)}
                                    disabled={loadingCargos}
                                    className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">— Todos —</option>
                                    {cargos.map((c) => (
                                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="ml-auto text-xs text-muted-foreground">
                            {historicoTotal} registro{historicoTotal !== 1 ? "s" : ""}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/60 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border/60">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Quando</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Escopo</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Alvo</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Ação</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Antes → Depois</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingHistorico ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                            <Loader2 className="size-5 animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : historicoItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    historicoItems.map((h, i) => {
                                        const acaoBadge = ACAO_BADGE[h.acao];
                                        const alvo = h.cargoNome ?? h.nivelCargoNome ?? null;
                                        return (
                                            <tr
                                                key={h.id}
                                                className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                                    {formatDataHora(h.criadoEmUtc)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                                                        {ESCOPO_LABEL[h.escopo]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {alvo ?? <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-3 font-medium">
                                                    {h.tipoDocumentoLabel}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${acaoBadge.className}`}>
                                                        {acaoBadge.text}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <span className="text-muted-foreground">{formatConfig(h.configuracaoAnterior)}</span>
                                                    <span className="mx-2">→</span>
                                                    <span className="font-medium">{formatConfig(h.configuracaoNova)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {h.userNome ?? <span className="text-muted-foreground italic">sistema</span>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação */}
                    {historicoTotalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                                Página {historicoPage} de {historicoTotalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadHistorico(historicoPage - 1, historicoEscopoFilter, historicoNivelFilter, historicoCargoFilter)}
                                    disabled={loadingHistorico || historicoPage <= 1}
                                >
                                    <ChevronLeft className="size-4" />
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadHistorico(historicoPage + 1, historicoEscopoFilter, historicoNivelFilter, historicoCargoFilter)}
                                    disabled={loadingHistorico || historicoPage >= historicoTotalPages}
                                >
                                    Próxima
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
