"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Banknote,
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Clock,
    Columns3,
    Copy,
    Eye,
    FileText,
    FolderOpen,
    List,
    MapPin,
    MoreHorizontal,
    PenSquare,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Target,
    Users,
} from "lucide-react";

import type { VagaListItem } from "@/lib/schemas/recrutamento";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import VagaFormModal from "./VagaFormModal";
import SolicitacaoFormModal from "@/features/gestao/solicitacoes/SolicitacaoFormModal";

const BASE = "/app";
const MATCHING_LAST_VAGA_KEY = "renderrh.matching.lastVagaId";

type VagasPayload = unknown;

interface SolicitacaoRow {
    id: string;
    titulo: string;
    status: number | string;
    urgencia: number | string;
    tipoSolicitacao: number | string;
    areaName: string | null;
    solicitanteNome?: string | null;
    qtdPosicoes: number;
    createdAtUtc: string;
}

interface SolicitacaoDetail extends SolicitacaoRow {
    justificativa?: string | null;
    aprovadorNome?: string | null;
    unitName?: string | null;
    vagaId?: string | null;
    observacaoAprovador?: string | null;
    isConfidencial?: boolean;
    substituidoNome?: string | null;
    aprovador1Nome?: string | null;
    aprovador1Status?: number | string;
    aprovador1DataUtc?: string | null;
    aprovador2Nome?: string | null;
    aprovador2Status?: number | string | null;
    aprovador2DataUtc?: string | null;
    aprovador2Habilitado?: boolean;
    approvedAtUtc?: string | null;
    updatedAtUtc?: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickNumber(v: unknown, fb: number) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
}

function pickString(v: unknown, fb = "") {
    return typeof v === "string" ? v : v == null ? fb : String(v);
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function formatDate(value: string | null | undefined) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString("pt-BR");
    } catch {
        return "—";
    }
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("pt-BR");
    } catch {
        return "—";
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP_${res.status}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function mapVagaItem(raw: unknown): VagaListItem {
    const r = asRecord(raw) ?? {};
    return { ...(r as unknown as VagaListItem), area: pickString(r.areaName ?? r.area, "") };
}

function mapVagasPayload(payload: VagasPayload): VagaListItem[] {
    if (Array.isArray(payload)) return (payload as unknown[]).map(mapVagaItem);
    const r = asRecord(payload);
    const items = r?.items;
    if (Array.isArray(items)) return (items as unknown[]).map(mapVagaItem);
    return [];
}

function calcReqTotals(v: VagaListItem) {
    const reqs = Array.isArray(v.requisitos) ? v.requisitos : [];
    const total = typeof v.requisitosTotal === "number" ? v.requisitosTotal
        : Number.isFinite(Number(v.requisitosTotal)) ? Number(v.requisitosTotal) : reqs.length;
    const obrig = typeof v.requisitosObrigatorios === "number" ? v.requisitosObrigatorios
        : Number.isFinite(Number(v.requisitosObrigatorios)) ? Number(v.requisitosObrigatorios)
        : reqs.filter((x) => !!asRecord(x)?.obrigatorio).length;
    return { total: Number(total) || 0, obrig: Number(obrig) || 0 };
}

function isVagaDeleteRestrictedByCandidates(message: string) {
    const m = (message || "").toLowerCase();
    return m.includes("fk_candidatos_vagas_vagaid") || (m.includes("violates restrict") && m.includes("candidatos"));
}

function mapCandidatosList(payload: unknown): Array<{ id: string; nome: string }> {
    const arr = Array.isArray(payload) ? payload
        : Array.isArray(asRecord(payload)?.items) ? (asRecord(payload)?.items as unknown[]) : [];
    return arr.map((x) => {
        const r = asRecord(x) ?? {};
        const id = pickString(r.id, "").trim();
        if (!id) return null;
        return { id, nome: pickString(r.nome, "Candidato").trim() || "Candidato" };
    }).filter(Boolean) as Array<{ id: string; nome: string }>;
}

const VAGA_STATUS: Record<string, { label: string; cls: string }> = {
    aberta: { label: "Aberta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    ativa: { label: "Aberta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    pausada: { label: "Pausada", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    fechada: { label: "Fechada", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    encerrada: { label: "Encerrada", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

const SOLIC_STATUS: Record<number, { label: string; cls: string }> = {
    0: { label: "Rascunho", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300" },
    1: { label: "Pendente Aprovação", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    2: { label: "Aprovada", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    3: { label: "Reprovada", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    4: { label: "Ajustes Necessários", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
};

const SOLIC_URGENCIA: Record<number, { label: string; cls: string }> = {
    0: { label: "Baixa", cls: "text-zinc-500" },
    1: { label: "Média", cls: "text-amber-600" },
    2: { label: "Alta", cls: "text-orange-600" },
    3: { label: "Crítica", cls: "text-red-600 font-semibold" },
};

const SOLIC_TIPO: Record<number, string> = {
    0: "Vaga Nova",
    1: "Substituição",
};

const APROVACAO_STATUS: Record<number, string> = {
    0: "Pendente",
    1: "Aprovado",
    2: "Reprovado",
};

function normalizeEnumKey(value: unknown) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function resolveSolicStatusMeta(status: unknown) {
    const key = normalizeEnumKey(status);
    if (key === "1" || key === "pendenteaprovacao") return SOLIC_STATUS[1];
    if (key === "2" || key === "aprovada") return SOLIC_STATUS[2];
    if (key === "3" || key === "reprovada") return SOLIC_STATUS[3];
    if (key === "4" || key === "ajustesnecessarios") return SOLIC_STATUS[4];
    return SOLIC_STATUS[0];
}

function resolveUrgenciaMeta(urgencia: unknown) {
    const key = normalizeEnumKey(urgencia);
    if (key === "0" || key === "baixa") return SOLIC_URGENCIA[0];
    if (key === "2" || key === "alta") return SOLIC_URGENCIA[2];
    if (key === "3" || key === "critica") return SOLIC_URGENCIA[3];
    return SOLIC_URGENCIA[1];
}

function resolveTipoLabel(tipo: unknown) {
    const key = normalizeEnumKey(tipo);
    if (key === "1" || key === "substituicao") return SOLIC_TIPO[1];
    return SOLIC_TIPO[0];
}

function resolveApprovalStatusLabel(status: unknown) {
    const key = normalizeEnumKey(status);
    if (key === "1" || key === "aprovado") return APROVACAO_STATUS[1];
    if (key === "2" || key === "reprovado") return APROVACAO_STATUS[2];
    return APROVACAO_STATUS[0];
}

function isSolicStatus(status: unknown, expected: "rascunho" | "pendenteaprovacao" | "aprovada" | "reprovada" | "ajustesnecessarios") {
    return normalizeEnumKey(status) === expected;
}

function VagaStatusBadge({ status }: { status: string | null | undefined }) {
    const s = (status ?? "").trim().toLowerCase();
    const meta = VAGA_STATUS[s];
    if (!meta) return <span className="text-xs text-muted-foreground">{status || "—"}</span>;
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

function SolicStatusBadge({ status }: { status: number | string }) {
    const meta = resolveSolicStatusMeta(status);
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

function KpiCard({
    icon: Icon,
    label,
    value,
    tone = "default",
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number | string;
    tone?: "default" | "success" | "warning";
}) {
    const toneMap = {
        default: "bg-muted/50 text-foreground",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    };

    return (
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                </div>
                <div className={`rounded-xl p-2.5 ${toneMap[tone]}`}>
                    <Icon className="size-5" />
                </div>
            </div>
        </div>
    );
}

function FlowStepCard({
    step,
    title,
    description,
    icon: Icon,
}: {
    step: string;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                    <Icon className="size-4 text-foreground" />
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Etapa {step}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
                </div>
            </div>
        </div>
    );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-medium text-foreground">{value || "—"}</div>
        </div>
    );
}

export default function VagasScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { me } = useAuth();
    const deeplinkHandled = useRef(false);
    const pendenciasMode = searchParams.get("pendencias") === "1" || searchParams.get("mode") === "pendencias";

    const roleSet = useMemo(
        () => new Set((me?.roles ?? []).map((role) => role.toLowerCase())),
        [me?.roles],
    );

    const isAdmin = me?.isAdmin ?? false;
    const isRecrutador = isAdmin || roleSet.has("recrutador");
    const isGestor = roleSet.has("gestor");
    const showManagerSections = isGestor || isAdmin;

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<VagaListItem[]>([]);
    const [q, setQ] = useState("");
    const [area, setArea] = useState("all");
    const [status, setStatus] = useState(() => (pendenciasMode ? "rascunho" : "all"));
    const [viewMode, setViewModeRaw] = useState<"list" | "kanban">(() => {
        if (typeof window === "undefined") return "list";
        return (localStorage.getItem("renderrh.vagas.viewMode") as "list" | "kanban") || "list";
    });
    const setViewMode = (m: "list" | "kanban") => { setViewModeRaw(m); localStorage.setItem("renderrh.vagas.viewMode", m); };
    const [areas, setAreas] = useState<string[]>([]);

    useEffect(() => {
        if (!pendenciasMode) return;
        // Pendências sempre parte de rascunho (vagas aprovadas pelos superiores e liberadas para RH preencher).
        setStatus("rascunho");
        setArea("all");
        setQ("");
    }, [pendenciasMode]);

    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRow[]>([]);
    const [approvals, setApprovals] = useState<SolicitacaoRow[]>([]);
    const [loadingSolic, setLoadingSolic] = useState(false);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
    const [solicitacaoEditId, setSolicitacaoEditId] = useState<string | null>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    const [vagaDetailOpen, setVagaDetailOpen] = useState(false);
    const [vagaDetailLoading, setVagaDetailLoading] = useState(false);
    const [vagaDetail, setVagaDetail] = useState<Record<string, unknown> | null>(null);

    const [solicDetailOpen, setSolicDetailOpen] = useState(false);
    const [solicDetailLoading, setSolicDetailLoading] = useState(false);
    const [solicDetail, setSolicDetail] = useState<SolicitacaoDetail | null>(null);
    const [approvalObs, setApprovalObs] = useState("");
    const [approvalActing, setApprovalActing] = useState(false);

    const syncList = useCallback(async () => {
        const endpoint = pendenciasMode ? `${BASE}/api/vagas/pendencias-rh` : `${BASE}/api/vagas`;
        const payload = await fetchJson<VagasPayload>(endpoint);
        const list = mapVagasPayload(payload);
        setRows(list);
        setScreenCache(pendenciasMode ? "/vagas?pendencias=1" : "/vagas", list);
        const areaSet = new Set(list.map((v) => (v.area ?? "").trim()).filter(Boolean));
        setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
    }, [pendenciasMode]);

    const loadSolicitacoes = useCallback(async () => {
        if (!showManagerSections) {
            setSolicitacoes([]);
            return;
        }

        setLoadingSolic(true);
        try {
            const data = await fetchJson<SolicitacaoRow[]>("/api/solicitacoes-vaga");
            setSolicitacoes(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar solicitações.");
        } finally {
            setLoadingSolic(false);
        }
    }, [showManagerSections]);

    const loadApprovals = useCallback(async () => {
        if (!showManagerSections) {
            setApprovals([]);
            return;
        }

        setLoadingApprovals(true);
        try {
            const data = await fetchJson<SolicitacaoRow[]>("/api/solicitacoes-vaga?status=1");
            setApprovals(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar aprovações.");
        } finally {
            setLoadingApprovals(false);
        }
    }, [showManagerSections]);

    useEffect(() => {
        let alive = true;
        const cacheKey = pendenciasMode ? "/vagas?pendencias=1" : "/vagas";
        const cached = getScreenCache<VagaListItem[]>(cacheKey);
        if (cached) {
            setRows(cached);
            const areaSet = new Set(cached.map((v) => (v.area ?? "").trim()).filter(Boolean));
            setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
        } else {
            setLoading(true);
        }

        syncList()
            .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar vagas."))
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, [syncList]);

    useEffect(() => {
        void loadSolicitacoes();
        void loadApprovals();
    }, [loadSolicitacoes, loadApprovals]);

    useEffect(() => {
        if (deeplinkHandled.current) return;
        const open = searchParams.get("open");
        const vagaId = searchParams.get("vagaId");

        if ((open === "create" || open === "new") && !vagaId && isRecrutador) {
            setEditId(null);
            setEditOpen(true);
            deeplinkHandled.current = true;
            return;
        }

        if (open === "detail" && vagaId) {
            deeplinkHandled.current = true;
            void openVagaDetail(vagaId);
        }
    }, [isRecrutador, searchParams]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((v) => {
            if (status !== "all" && (v.status ?? "").toLowerCase() !== status) return false;
            if (area !== "all" && (v.area ?? "").trim() !== area) return false;
            if (!qq) return true;
            return [v.codigo, v.titulo, v.area, v.modalidade, v.cidade, v.uf]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(qq);
        });
    }, [rows, q, area, status]);

    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, area, status],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice]);

    const vagaCounts = useMemo(() => {
        const openStatuses = new Set(["aberta", "ativa"]);
        const prepStatuses = new Set(["rascunho", "pausada"]);
        return {
            total: rows.length,
            open: rows.filter((row) => openStatuses.has((row.status ?? "").toLowerCase())).length,
            preparation: rows.filter((row) => prepStatuses.has((row.status ?? "").toLowerCase())).length,
            closed: rows.filter((row) => ["fechada", "encerrada"].includes((row.status ?? "").toLowerCase())).length,
        };
    }, [rows]);

    function persistMatchingContext(vagaId: string) {
        try {
            sessionStorage.setItem(MATCHING_LAST_VAGA_KEY, vagaId);
            localStorage.setItem(MATCHING_LAST_VAGA_KEY, vagaId);
        } catch {
            // ignore
        }
    }

    function openNew() {
        setEditId(null);
        setEditOpen(true);
    }

    function openEdit(id: string) {
        setEditId(id);
        setEditOpen(true);
    }

    function openSolicitacaoEditor(id?: string | null) {
        setSolicitacaoEditId(id ?? null);
        setSolicitacaoOpen(true);
    }

    async function openVagaDetail(id: string) {
        setVagaDetailOpen(true);
        setVagaDetailLoading(true);
        try {
            const data = await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
            setVagaDetail(asRecord(data));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar detalhes da vaga.");
            setVagaDetailOpen(false);
        } finally {
            setVagaDetailLoading(false);
        }
    }

    async function openSolicitacaoDetail(id: string) {
        setSolicDetailOpen(true);
        setSolicDetailLoading(true);
        setApprovalObs("");
        try {
            const data = await fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${encodeURIComponent(id)}`);
            setSolicDetail(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar detalhes da solicitação.");
            setSolicDetailOpen(false);
        } finally {
            setSolicDetailLoading(false);
        }
    }

    async function executeApproval(action: "approve" | "reject" | "request-changes") {
        if (!solicDetail?.id) return;
        setApprovalActing(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${encodeURIComponent(solicDetail.id)}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs.trim() || null }),
            });
            toast.success(
                action === "approve"
                    ? "Solicitação aprovada."
                    : action === "reject"
                        ? "Solicitação reprovada."
                        : "Solicitação devolvida para ajustes.",
            );
            setSolicDetailOpen(false);
            setSolicDetail(null);
            await Promise.all([syncList(), loadSolicitacoes(), loadApprovals()]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao processar aprovação.");
        } finally {
            setApprovalActing(false);
        }
    }

    function exportJson() {
        const blob = new Blob(
            [JSON.stringify({ exportedAt: new Date().toISOString(), vagas: rows }, null, 2)],
            { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vagas-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Exportação iniciada.");
    }

    async function duplicateVaga(id: string) {
        const v = rows.find((x) => x.id === id);
        const ok = await confirmDialog({
            title: "Duplicar vaga",
            description: `Duplicar "${v?.titulo ?? ""}"?`,
            confirmText: "Duplicar",
        });
        if (!ok) return;

        try {
            const d = await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
            const r = asRecord(d) ?? {};
            const baseCode = pickString(r.codigo, "").trim();
            const baseTitle = pickString(r.titulo, "").trim();
            r.codigo = baseCode ? `${baseCode}-COPY`.slice(0, 40) : null;
            r.titulo = baseTitle ? `${baseTitle} (Cópia)`.slice(0, 160) : "Cópia";
            await fetchJson(`${BASE}/api/vagas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(r),
            });
            toast.success("Vaga duplicada.");
            await syncList();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao duplicar.");
        }
    }

    async function deleteVaga(id: string) {
        const v = rows.find((x) => x.id === id);
        const nome = (v?.titulo ?? "").trim();

        if (nome) {
            const typed = prompt(`Para confirmar, digite o nome exato da vaga:\n\n${nome}`, "");
            if (typed == null) return;
            if (typed.trim() !== nome) {
                toast.error("Nome não confere. Exclusão cancelada.");
                return;
            }
        } else {
            const confirmed = await confirmDialog({
                title: "Excluir vaga",
                description: `Excluir vaga sem título (ID: ${id})?`,
                confirmText: "Excluir",
                destructive: true,
            });
            if (!confirmed) return;
        }

        try {
            await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
            setRows((prev) => prev.filter((x) => x.id !== id));
            toast.success("Vaga excluída.");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (isVagaDeleteRestrictedByCandidates(msg)) {
                const payload = await fetchJson<unknown>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&pageSize=1000`).catch(() => null);
                const vinculados = mapCandidatosList(payload);
                const confirmed = await confirmDialog({
                    title: "Excluir vaga e candidatos",
                    description: `Existem ${vinculados.length || "vários"} candidatos vinculados. Deseja excluir tudo?`,
                    confirmText: "Excluir tudo",
                    destructive: true,
                });
                if (!confirmed) return;

                let failed = 0;
                for (const candidato of vinculados) {
                    try {
                        await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(candidato.id)}`, { method: "DELETE" });
                    } catch {
                        failed++;
                    }
                }

                if (failed > 0) {
                    toast.error(`Falha ao excluir ${failed} candidato(s).`);
                    return;
                }

                await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
                setRows((prev) => prev.filter((x) => x.id !== id));
                toast.success("Vaga e candidatos excluídos.");
                return;
            }

            toast.error(msg || "Falha ao excluir vaga.");
        }
    }

    const currentVagaDetail = vagaDetail;
    const currentVagaId = pickString(currentVagaDetail?.id, "");
    const currentVagaTitle = pickString(currentVagaDetail?.titulo, "Vaga");
    const currentVagaArea = pickString(currentVagaDetail?.areaName ?? currentVagaDetail?.area, "—");
    const currentVagaDepartment = pickString(currentVagaDetail?.departmentName ?? currentVagaDetail?.department, "—");
    const currentVagaStatus = pickString(currentVagaDetail?.status, "");
    const currentVagaVisibilidade = pickString(currentVagaDetail?.visibilidade, "");
    const visibilidadePermitePortal = ["Externa", "InternaEExterna"].includes(currentVagaVisibilidade);
    const vagaAberta = currentVagaStatus.toLowerCase() === "aberta";
    const currentVagaCodigo = pickString(currentVagaDetail?.codigo, "—");
    const currentVagaModalidade = pickString(currentVagaDetail?.modalidade, "—");
    const currentVagaSenioridade = pickString(currentVagaDetail?.senioridade, "—");
    const currentVagaCidade = pickString(currentVagaDetail?.cidade, "").trim();
    const currentVagaUf = pickString(currentVagaDetail?.uf, "").trim();
    const currentVagaLocation = [currentVagaCidade, currentVagaUf].filter(Boolean).join(" / ") || "—";
    const currentVagaMatch = clamp(pickNumber(currentVagaDetail?.threshold ?? currentVagaDetail?.matchMinimoPercentual, 0), 0, 100);
    const currentVagaQtd = pickNumber(currentVagaDetail?.quantidadeVagas, 0);
    const currentVagaResumo = pickString(currentVagaDetail?.resumoPitch ?? currentVagaDetail?.descricaoInterna, "").trim();
    const currentVagaTipoContratacao = pickString(currentVagaDetail?.tipoContratacao, "");
    const currentVagaPrioridade = pickString(currentVagaDetail?.prioridade, "");
    const currentVagaSalMin = pickString(currentVagaDetail?.salarioMinimo, "");
    const currentVagaSalMax = pickString(currentVagaDetail?.salarioMaximo, "");
    const currentVagaMoeda = pickString(currentVagaDetail?.moeda, "").toUpperCase();
    const currentVagaRecrutador = pickString(currentVagaDetail?.recrutadorResponsavel ?? currentVagaDetail?.recrutadorResponsavelNome, "");
    const currentVagaGestor = pickString(currentVagaDetail?.gestorRequisitante ?? currentVagaDetail?.gestorRequisitanteNome, "");
    const currentVagaDescPublica = pickString(currentVagaDetail?.descricaoPublica, "").trim();
    const currentVagaTags = pickString(currentVagaDetail?.tagsKeywords ?? currentVagaDetail?.tagsResponsabilidades, "").trim();
    const fmtSalary = () => {
        if (!currentVagaSalMin && !currentVagaSalMax) return "—";
        const fmt = (v: string) => { const n = parseFloat(v); return isNaN(n) ? v : n.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); };
        const prefix = currentVagaMoeda && currentVagaMoeda !== "BRL" ? `${currentVagaMoeda} ` : "R$ ";
        if (currentVagaSalMin && currentVagaSalMax) return `${prefix}${fmt(currentVagaSalMin)} – ${fmt(currentVagaSalMax)}`;
        return `${prefix}${fmt(currentVagaSalMin || currentVagaSalMax)}`;
    };
    const prioridadeMeta: Record<string, { label: string; cls: string }> = {
        baixa: { label: "Baixa", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        normal: { label: "Normal", cls: "text-sky-700 bg-sky-50 border-sky-200" },
        alta: { label: "Alta", cls: "text-amber-700 bg-amber-50 border-amber-200" },
        urgente: { label: "Urgente", cls: "text-red-700 bg-red-50 border-red-200" },
        critica: { label: "Crítica", cls: "text-red-800 bg-red-100 border-red-300" },
    };
    const priMeta = prioridadeMeta[currentVagaPrioridade.toLowerCase()] ?? { label: currentVagaPrioridade || "—", cls: "text-muted-foreground bg-muted/30 border-border/50" };
    const flowSteps = showManagerSections ? [
        {
            step: "1",
            title: "Solicite ou acompanhe a abertura",
            description: "Use o mesmo painel para criar solicitações, revisar pendências e enxergar quando a vaga estiver liberada.",
            icon: Plus,
        },
        {
            step: "2",
            title: "Valide aprovações",
            description: "As solicitações que ainda dependem de análise ficam visíveis ao lado, sem trocar de tela.",
            icon: ShieldCheck,
        },
        {
            step: "3",
            title: "Consulte as vagas abertas",
            description: "Assim que aprovadas, as vagas entram na lista principal para o RH tocar a seleção.",
            icon: Briefcase,
        },
    ] : [
        {
            step: "1",
            title: "Configure a vaga",
            description: "Ajuste dados, requisitos e corte mínimo antes de seguir para análise de candidatos.",
            icon: PenSquare,
        },
        {
            step: "2",
            title: "Rode o matching",
            description: "Abra o matching da vaga para priorizar candidatos, aprovar, reprovar ou manter em análise.",
            icon: ShieldCheck,
        },
        {
            step: "3",
            title: "Envie para rodadas",
            description: "Os aprovados seguem para rodadas de seleção e depois para o processo seletivo estruturado.",
            icon: FolderOpen,
        },
        {
            step: "4",
            title: "Feche com admissão",
            description: "Depois da etapa seletiva, o candidato aprovado segue para pré-admissão e contratação.",
            icon: CheckCircle2,
        },
    ];

    return (
        <section className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Badge variant="secondary" className="mb-2">
                        {showManagerSections ? "Hub do gestor" : "Hub do recrutamento"}
                    </Badge>
                    <h1 className="text-2xl font-semibold tracking-tight">Vagas</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {showManagerSections
                            ? "Solicite, acompanhe aprovações e consulte a abertura de vagas sem pular entre telas soltas."
                            : "Centralize configuração da vaga, matching, rodadas e avanço para admissão a partir do mesmo ponto."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void syncList()}>
                        <RefreshCw className="mr-1 size-4" />
                        Atualizar vagas
                    </Button>
                    {isAdmin && (
                        <>
                            <Button variant="outline" size="sm" onClick={exportJson}>
                                Exportar
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <label className="cursor-pointer">
                                    Importar
                                    <input
                                        className="hidden"
                                        type="file"
                                        accept="application/json"
                                        onChange={(e) => {
                                            const file = e.currentTarget.files?.[0];
                                            if (!file) return;
                                            file.text()
                                                .then((text) => {
                                                    const parsed = JSON.parse(text) as { vagas?: unknown[] };
                                                    if (!Array.isArray(parsed?.vagas)) {
                                                        toast.error("JSON inválido.");
                                                        return;
                                                    }
                                                    Promise.all(parsed.vagas.map((vaga) => fetchJson(`${BASE}/api/vagas`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify(vaga),
                                                    })))
                                                        .then(() => {
                                                            toast.success("Importação concluída.");
                                                            void syncList();
                                                        })
                                                        .catch(() => toast.error("Falha ao importar vagas."));
                                                })
                                                .catch(() => toast.error("Falha ao ler arquivo."));
                                            e.currentTarget.value = "";
                                        }}
                                    />
                                </label>
                            </Button>
                        </>
                    )}
                    {isRecrutador && (
                        <Button size="sm" onClick={openNew}>
                            <Plus className="mr-1 size-4" />
                            Nova Vaga
                        </Button>
                    )}
                </div>
            </div>

            <div className={`grid gap-3 ${showManagerSections ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
                {flowSteps.map((step) => (
                    <FlowStepCard
                        key={step.step}
                        step={step.step}
                        title={step.title}
                        description={step.description}
                        icon={step.icon}
                    />
                ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={Briefcase} label="Total de vagas" value={vagaCounts.total} />
                <KpiCard icon={CheckCircle2} label="Vagas abertas" value={vagaCounts.open} tone="success" />
                <KpiCard icon={Clock} label="Em preparação" value={vagaCounts.preparation} tone="warning" />
                <KpiCard
                    icon={showManagerSections ? ShieldCheck : Users}
                    label={showManagerSections ? "Aprovações pendentes" : "Vagas encerradas"}
                    value={showManagerSections ? approvals.length : vagaCounts.closed}
                />
            </div>

            <div className="rounded-xl border border-border/50 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                    <div>
                        <div className="text-sm font-semibold">Painel de vagas</div>
                        <div className="text-xs text-muted-foreground">
                            Abra uma vaga para seguir com matching, candidatos e rodadas sem sair do fluxo principal.
                        </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                        {showManagerSections ? "Gestor + acompanhamento" : "RH + seleção"}
                    </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-4">
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Buscar título, código, área ou localização..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                    >
                        <option value="all">Todas as áreas</option>
                        {areas.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {isRecrutador && (
                        <Button
                            size="sm"
                            variant={pendenciasMode ? "default" : "outline"}
                            onClick={() => void router.push(pendenciasMode ? `/vagas` : `/vagas?pendencias=1`)}
                        >
                            Pendências
                        </Button>
                    )}
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={pendenciasMode}
                    >
                        <option value="all">Todos os status</option>
                        <option value="aberta">Aberta</option>
                        <option value="rascunho">Rascunho</option>
                        <option value="pausada">Pausada</option>
                        <option value="fechada">Fechada</option>
                    </select>
                    <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                        <button
                            type="button"
                            className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setViewMode("list")}
                            title="Exibir como lista"
                        >
                            <List className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setViewMode("kanban")}
                            title="Exibir como kanban"
                        >
                            <Columns3 className="size-3.5" />
                        </button>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                        {filtered.length} vaga(s)
                    </div>
                </div>

                {viewMode === "list" ? (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="min-w-[260px]">Vaga</TableHead>
                                        <TableHead>Área</TableHead>
                                        <TableHead>Requisitos</TableHead>
                                        <TableHead>Match mín.</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-12" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 6 }).map((__, j) => (
                                                    <TableCell key={j}>
                                                        <div className="h-4 animate-pulse rounded bg-muted" />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : paged.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                                                Nenhuma vaga encontrada com os filtros atuais.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paged.map((vaga) => {
                                            const { total, obrig } = calcReqTotals(vaga);
                                            const threshold = clamp(pickNumber(vaga.threshold ?? vaga.matchMinimoPercentual, 0), 0, 100);
                                            const location = [vaga.cidade, vaga.uf].filter(Boolean).join(" / ");

                                            return (
                                                <TableRow
                                                    key={vaga.id}
                                                    className="cursor-pointer hover:bg-muted/40"
                                                    onClick={() => void openVagaDetail(vaga.id)}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-sm font-medium">{vaga.titulo ?? "—"}</div>
                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                                    {vaga.codigo && <span className="font-mono">{vaga.codigo}</span>}
                                                                    {vaga.codigo && <span>·</span>}
                                                                    <span>{vaga.modalidade ?? "Modalidade não definida"}</span>
                                                                    {location && <><span>·</span><span>{location}</span></>}
                                                                </div>
                                                            </div>
                                                            {typeof vaga.hasDetail === "boolean" && vaga.hasDetail && (
                                                                <Badge variant="secondary" className="shrink-0">Detalhes</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{vaga.area || "—"}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-muted-foreground">{total} requisito(s)</span>
                                                            {obrig > 0 && (
                                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                                    {obrig} obrigatório(s)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                                        {threshold}%
                                                    </TableCell>
                                                    <TableCell>
                                                        <VagaStatusBadge status={vaga.status} />
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" size="icon-sm">
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onClick={() => void openVagaDetail(vaga.id)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    Ver detalhes
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/gestao/projetos?vagaId=${encodeURIComponent(vaga.id)}`)}>
                                                                    <FolderOpen className="mr-2 size-4" />
                                                                    Rodadas
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    persistMatchingContext(vaga.id);
                                                                    router.push(`/matching?vagaId=${encodeURIComponent(vaga.id)}`);
                                                                }}>
                                                                    <ShieldCheck className="mr-2 size-4" />
                                                                    Matching IA
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vaga.id)}`)}>
                                                                    <Users className="mr-2 size-4" />
                                                                    Candidatos
                                                                </DropdownMenuItem>
                                                                {isRecrutador && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => openEdit(vaga.id)}>
                                                                            <PenSquare className="mr-2 size-4" />
                                                                            Editar
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {isAdmin && (
                                                                    <DropdownMenuItem onClick={() => void duplicateVaga(vaga.id)}>
                                                                        <FileText className="mr-2 size-4" />
                                                                        Duplicar
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {isRecrutador && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            className="text-destructive focus:text-destructive"
                                                                            onClick={() => void deleteVaga(vaga.id)}
                                                                        >
                                                                            Excluir
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="border-t border-border/40 px-4 py-3">
                            <PaginationBar
                                page={page}
                                pageSize={pageSize}
                                totalItems={filtered.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                    />
                </div>
                    </>
                ) : (
                    /* ── Kanban View ── */
                    <div className="p-4 overflow-x-auto">
                        {loading ? (
                            <div className="flex gap-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="w-72 shrink-0 space-y-3">
                                        <div className="h-8 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-4 items-start">
                                {(["rascunho", "aberta", "pausada", "fechada"] as const).map((col) => {
                                    const meta = VAGA_STATUS[col];
                                    const colVagas = filtered.filter((v) => {
                                        const s = (v.status ?? "").toLowerCase();
                                        if (col === "aberta") return s === "aberta" || s === "ativa";
                                        if (col === "fechada") return s === "fechada" || s === "encerrada";
                                        return s === col;
                                    });
                                    return (
                                        <div key={col} className="w-72 shrink-0 flex flex-col rounded-xl border border-border/50 bg-muted/10">
                                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">{colVagas.length}</span>
                                            </div>
                                            <div className="flex-1 space-y-2 p-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                                                {colVagas.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
                                                        Nenhuma vaga
                                                    </div>
                                                ) : colVagas.map((vaga) => {
                                                    const location = [vaga.cidade, vaga.uf].filter(Boolean).join(" / ");
                                                    const threshold = clamp(pickNumber(vaga.threshold ?? vaga.matchMinimoPercentual, 0), 0, 100);
                                                    return (
                                                        <div
                                                            key={vaga.id}
                                                            className="rounded-lg border border-border/50 bg-card p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                                                            onClick={() => void openVagaDetail(vaga.id)}
                                                        >
                                                            <div className="text-sm font-medium leading-tight truncate">{vaga.titulo ?? "—"}</div>
                                                            {vaga.codigo && <div className="mt-1 text-[11px] font-mono text-muted-foreground">{vaga.codigo}</div>}
                                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                                {vaga.area && <span>{vaga.area}</span>}
                                                                {vaga.modalidade && <span>{vaga.modalidade}</span>}
                                                                {location && (
                                                                    <span className="inline-flex items-center gap-0.5">
                                                                        <MapPin className="size-3" />
                                                                        {location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 flex items-center justify-between">
                                                                <span className="text-[11px] text-muted-foreground">Match {threshold}%</span>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                                                                            <MoreHorizontal className="size-3.5 text-muted-foreground" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-44">
                                                                        <DropdownMenuItem onClick={() => void openVagaDetail(vaga.id)}>
                                                                            <Eye className="mr-2 size-3.5" />Detalhes
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => { persistMatchingContext(vaga.id); router.push(`/matching?vagaId=${encodeURIComponent(vaga.id)}`); }}>
                                                                            <ShieldCheck className="mr-2 size-3.5" />Matching
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vaga.id)}`)}>
                                                                            <Users className="mr-2 size-3.5" />Candidatos
                                                                        </DropdownMenuItem>
                                                                        {isRecrutador && (
                                                                            <>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem onClick={() => openEdit(vaga.id)}>
                                                                                    <PenSquare className="mr-2 size-3.5" />Editar
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={vagaDetailOpen} onOpenChange={setVagaDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="sr-only"><DialogTitle>{currentVagaTitle}</DialogTitle><DialogDescription>Detalhes da vaga</DialogDescription></DialogHeader>
                    {vagaDetailLoading ? (
                        <div className="space-y-3 p-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* ── Header ── */}
                            <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold tracking-tight truncate">{currentVagaTitle}</h2>
                                            <VagaStatusBadge status={currentVagaStatus} />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                            {currentVagaCodigo !== "—" && <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">{currentVagaCodigo}</span>}
                                            <span>{currentVagaArea}</span>
                                            <span className="text-border">|</span>
                                            <span>{currentVagaDepartment}</span>
                                        </div>
                                    </div>
                                    {currentVagaPrioridade && (
                                        <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${priMeta.cls}`}>
                                            {priMeta.label}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 pb-6 space-y-5">
                                {/* ── Info Grid ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm pt-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Modalidade</div><div className="font-medium">{currentVagaModalidade}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Target className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Senioridade</div><div className="font-medium">{currentVagaSenioridade}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Local</div><div className="font-medium">{currentVagaLocation}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Banknote className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faixa salarial</div><div className="font-medium">{fmtSalary()}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Contratação</div><div className="font-medium">{currentVagaTipoContratacao || "—"}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Vagas</div><div className="font-medium">{currentVagaQtd || "—"}</div></div>
                                    </div>
                                </div>

                                {/* ── Datas & Match ── */}
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
                                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Início: {formatDate(pickString(currentVagaDetail?.dataInicio, "")) || "—"}</span>
                                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Encerramento: {formatDate(pickString(currentVagaDetail?.dataEncerramento, "")) || "—"}</span>
                                    <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Match min: <strong className="text-foreground">{currentVagaMatch}%</strong></span>
                                    <span className="inline-flex items-center gap-1"><RefreshCw className="size-3.5" /> Atualizada: {formatDateTime(pickString(currentVagaDetail?.updatedAt, "")) || "—"}</span>
                                </div>

                                {/* ── Responsáveis ── */}
                                {(currentVagaRecrutador || currentVagaGestor) && (
                                    <div className="flex flex-wrap gap-6 text-sm">
                                        {currentVagaRecrutador && (
                                            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Recrutador</div><div className="font-medium">{currentVagaRecrutador}</div></div>
                                        )}
                                        {currentVagaGestor && (
                                            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Gestor requisitante</div><div className="font-medium">{currentVagaGestor}</div></div>
                                        )}
                                    </div>
                                )}

                                {/* ── Resumo ── */}
                                {currentVagaResumo && (
                                    <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Resumo</div>
                                        <div className="text-sm leading-relaxed whitespace-pre-line">{currentVagaResumo}</div>
                                    </div>
                                )}

                                {/* ── Descrição Pública ── */}
                                {currentVagaDescPublica && (
                                    <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Descrição pública</div>
                                        <div className="text-sm leading-relaxed whitespace-pre-line">{currentVagaDescPublica}</div>
                                    </div>
                                )}

                                {/* ── Tags ── */}
                                {currentVagaTags && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {currentVagaTags.split(/[;,]/).filter(Boolean).map((tag, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs font-normal">{tag.trim()}</Badge>
                                        ))}
                                    </div>
                                )}

                                {/* ── Actions ── */}
                                <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
                                    {isRecrutador && currentVagaId && (
                                        <Button size="sm" onClick={() => { setVagaDetailOpen(false); openEdit(currentVagaId); }}>
                                            <PenSquare className="mr-1.5 size-3.5" />
                                            Editar
                                        </Button>
                                    )}
                                    {currentVagaId && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); persistMatchingContext(currentVagaId); router.push(`/matching?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <ShieldCheck className="mr-1.5 size-3.5" />
                                                Matching
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); router.push(`/gestao/projetos?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <FolderOpen className="mr-1.5 size-3.5" />
                                                Projetos
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); router.push(`/candidatos?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <Users className="mr-1.5 size-3.5" />
                                                Candidatos
                                            </Button>
                                        </>
                                    )}
                                    {isRecrutador && currentVagaId && vagaAberta && visibilidadePermitePortal && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto text-muted-foreground"
                                            onClick={async () => {
                                                const tenantId = me?.tenantId;
                                                if (!tenantId) { toast.error("TenantId não encontrado."); return; }
                                                const url = `${window.location.origin}/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}&vagaId=${encodeURIComponent(currentVagaId)}`;
                                                try { await navigator.clipboard.writeText(url); toast.success("Link do Portal copiado."); }
                                                catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao copiar link."); }
                                            }}
                                        >
                                            <Copy className="mr-1.5 size-3.5" />
                                            Copiar link
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={solicDetailOpen} onOpenChange={setSolicDetailOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{solicDetail?.titulo || "Solicitação de vaga"}</DialogTitle>
                        <DialogDescription>
                            Acompanhe contexto, aprovação e eventuais ajustes da solicitação.
                        </DialogDescription>
                    </DialogHeader>

                    {solicDetailLoading ? (
                        <div className="space-y-3 py-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                            ))}
                        </div>
                    ) : solicDetail ? (
                        <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
                                    <div className="mt-1"><SolicStatusBadge status={solicDetail.status} /></div>
                                </div>
                                <DetailField label="Tipo" value={resolveTipoLabel(solicDetail.tipoSolicitacao)} />
                                <DetailField label="Urgência" value={resolveUrgenciaMeta(solicDetail.urgencia).label} />
                                <DetailField label="Posições" value={solicDetail.qtdPosicoes} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Solicitante" value={solicDetail.solicitanteNome || "—"} />
                                <DetailField label="Aprovador" value={solicDetail.aprovadorNome || "—"} />
                                <DetailField label="Área" value={solicDetail.areaName || "—"} />
                                <DetailField label="Unidade" value={solicDetail.unitName || "—"} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Criada em" value={formatDateTime(solicDetail.createdAtUtc)} />
                                <DetailField label="Atualizada em" value={formatDateTime(solicDetail.updatedAtUtc)} />
                                <DetailField label="Aprovada em" value={formatDateTime(solicDetail.approvedAtUtc)} />
                                <DetailField label="Confidencial" value={solicDetail.isConfidencial ? "Sim" : "Não"} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Justificativa</div>
                                <div className="mt-2 text-sm leading-6 text-foreground">
                                    {solicDetail.justificativa?.trim() || "Sem justificativa registrada."}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <DetailField label="Substituição de" value={solicDetail.substituidoNome || "—"} />
                                <DetailField label="Vaga gerada" value={solicDetail.vagaId || "Ainda não gerada"} />
                                <DetailField label="Aprovador 1" value={`${solicDetail.aprovador1Nome || "—"} · ${resolveApprovalStatusLabel(solicDetail.aprovador1Status)}`} />
                                <DetailField label="Aprovador 2" value={solicDetail.aprovador2Habilitado ? `${solicDetail.aprovador2Nome || "—"} · ${resolveApprovalStatusLabel(solicDetail.aprovador2Status)}` : "Não habilitado"} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Observação da aprovação</div>
                                <div className="mt-2 text-sm leading-6 text-foreground">
                                    {solicDetail.observacaoAprovador?.trim() || "Nenhuma observação registrada."}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/50 p-4">
                                <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground" htmlFor="approval-obs">
                                    Observação para ação
                                </label>
                                <textarea
                                    id="approval-obs"
                                    className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-ring"
                                    placeholder="Descreva o motivo da aprovação, reprovação ou ajustes solicitados..."
                                    value={approvalObs}
                                    onChange={(e) => setApprovalObs(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(isSolicStatus(solicDetail.status, "rascunho") || isSolicStatus(solicDetail.status, "ajustesnecessarios")) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSolicDetailOpen(false);
                                            openSolicitacaoEditor(solicDetail.id);
                                        }}
                                    >
                                        <PenSquare className="mr-1 size-4" />
                                        Editar solicitação
                                    </Button>
                                )}
                                {isSolicStatus(solicDetail.status, "pendenteaprovacao") && (
                                    <>
                                        <Button disabled={approvalActing} onClick={() => void executeApproval("approve")}>
                                            <CheckCircle2 className="mr-1 size-4" />
                                            Aprovar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={approvalActing}
                                            onClick={() => void executeApproval("request-changes")}
                                        >
                                            Solicitar ajustes
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            disabled={approvalActing}
                                            onClick={() => void executeApproval("reject")}
                                        >
                                            Reprovar
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <SolicitacaoFormModal
                open={solicitacaoOpen}
                editId={solicitacaoEditId}
                onClose={() => {
                    setSolicitacaoOpen(false);
                    setSolicitacaoEditId(null);
                }}
                onSaved={() => {
                    setSolicitacaoOpen(false);
                    setSolicitacaoEditId(null);
                    void Promise.all([loadSolicitacoes(), loadApprovals()]);
                }}
            />

            <VagaFormModal
                open={editOpen}
                editId={editId}
                onClose={() => {
                    setEditOpen(false);
                    setEditId(null);
                }}
                onSaved={() => {
                    setEditOpen(false);
                    setEditId(null);
                    void syncList();
                }}
            />
        </section>
    );
}
