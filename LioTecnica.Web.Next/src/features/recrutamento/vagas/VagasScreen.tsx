"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Briefcase,
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    FolderOpen,
    MoreHorizontal,
    PenSquare,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
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
    const [status, setStatus] = useState("all");
    const [areas, setAreas] = useState<string[]>([]);

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
        const payload = await fetchJson<VagasPayload>(`${BASE}/api/vagas`);
        const list = mapVagasPayload(payload);
        setRows(list);
        setScreenCache("/vagas", list);
        const areaSet = new Set(list.map((v) => (v.area ?? "").trim()).filter(Boolean));
        setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
    }, []);

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
        const cached = getScreenCache<VagaListItem[]>("/vagas");
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
    const currentVagaCodigo = pickString(currentVagaDetail?.codigo, "—");
    const currentVagaModalidade = pickString(currentVagaDetail?.modalidade, "—");
    const currentVagaSenioridade = pickString(currentVagaDetail?.senioridade, "—");
    const currentVagaCidade = pickString(currentVagaDetail?.cidade, "").trim();
    const currentVagaUf = pickString(currentVagaDetail?.uf, "").trim();
    const currentVagaLocation = [currentVagaCidade, currentVagaUf].filter(Boolean).join(" / ") || "—";
    const currentVagaMatch = clamp(pickNumber(currentVagaDetail?.threshold ?? currentVagaDetail?.matchMinimoPercentual, 0), 0, 100);
    const currentVagaQtd = pickNumber(currentVagaDetail?.quantidadeVagas, 0);
    const currentVagaResumo = pickString(currentVagaDetail?.resumoPitch ?? currentVagaDetail?.descricaoInterna, "").trim();
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
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="all">Todos os status</option>
                        <option value="aberta">Aberta</option>
                        <option value="rascunho">Rascunho</option>
                        <option value="pausada">Pausada</option>
                        <option value="fechada">Fechada</option>
                    </select>
                    <div className="ml-auto text-xs text-muted-foreground">
                        {filtered.length} vaga(s)
                    </div>
                </div>

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
                                                        <Button variant="ghost" size="icon-sm">
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
                                                            Projetos / Rodadas
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
            </div>

            {showManagerSections && (
                <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-xl border border-border/50 bg-card shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                            <div>
                                <div className="text-sm font-semibold">Minhas solicitações</div>
                                <div className="text-xs text-muted-foreground">
                                    Rascunhos, pendências e histórico das vagas pedidas pela gestão.
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => void loadSolicitacoes()}>
                                    <RefreshCw className="mr-1 size-4" />
                                    Atualizar
                                </Button>
                                <Button size="sm" onClick={() => openSolicitacaoEditor()}>
                                    <Plus className="mr-1 size-4" />
                                    Nova Solicitação
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Título</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Urgência</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Data</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingSolic ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 5 }).map((__, j) => (
                                                    <TableCell key={j}>
                                                        <div className="h-4 animate-pulse rounded bg-muted" />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : solicitacoes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                                                Nenhuma solicitação cadastrada.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        solicitacoes.map((item) => {
                                            const urgencia = resolveUrgenciaMeta(item.urgencia);
                                            return (
                                                <TableRow
                                                    key={item.id}
                                                    className="cursor-pointer hover:bg-muted/40"
                                                    onClick={() => void openSolicitacaoDetail(item.id)}
                                                >
                                                    <TableCell>
                                                        <div className="text-sm font-medium">{item.titulo}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {item.areaName || "Área não informada"} · {item.qtdPosicoes} posição(ões)
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {resolveTipoLabel(item.tipoSolicitacao)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`text-xs font-medium ${urgencia.cls}`}>{urgencia.label}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <SolicStatusBadge status={item.status} />
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {formatDate(item.createdAtUtc)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-card shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                            <div>
                                <div className="text-sm font-semibold">Aprovações pendentes</div>
                                <div className="text-xs text-muted-foreground">
                                    Itens visíveis para análise no fluxo de abertura de vaga.
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => void loadApprovals()}>
                                <RefreshCw className="mr-1 size-4" />
                                Atualizar
                            </Button>
                        </div>

                        <div className="space-y-2 p-4">
                            {loadingApprovals ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                                ))
                            ) : approvals.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center">
                                    <div className="text-sm font-medium">Nenhuma aprovação pendente.</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Quando houver solicitações aguardando análise, elas aparecerão aqui.
                                    </div>
                                </div>
                            ) : (
                                approvals.map((item) => {
                                    const urgencia = resolveUrgenciaMeta(item.urgencia);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                                            onClick={() => void openSolicitacaoDetail(item.id)}
                                        >
                                            <div>
                                                <div className="text-sm font-medium">{item.titulo}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {item.solicitanteNome || "Solicitante não informado"} · {item.areaName || "Área não informada"}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-xs font-medium ${urgencia.cls}`}>{urgencia.label}</span>
                                                <SolicStatusBadge status={item.status} />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={vagaDetailOpen} onOpenChange={setVagaDetailOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{currentVagaTitle}</DialogTitle>
                        <DialogDescription>
                            Visão resumida da vaga antes de editar ou seguir para matching e projetos.
                        </DialogDescription>
                    </DialogHeader>

                    {vagaDetailLoading ? (
                        <div className="space-y-3 py-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
                                    <div className="mt-1"><VagaStatusBadge status={currentVagaStatus} /></div>
                                </div>
                                <DetailField label="Código" value={currentVagaCodigo} />
                                <DetailField label="Área" value={currentVagaArea} />
                                <DetailField label="Departamento" value={currentVagaDepartment} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Modalidade" value={currentVagaModalidade} />
                                <DetailField label="Senioridade" value={currentVagaSenioridade} />
                                <DetailField label="Localização" value={currentVagaLocation} />
                                <DetailField label="Quantidade" value={currentVagaQtd || "—"} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Match mínimo" value={`${currentVagaMatch}%`} />
                                <DetailField label="Data de início" value={formatDate(pickString(currentVagaDetail?.dataInicio, ""))} />
                                <DetailField label="Data de encerramento" value={formatDate(pickString(currentVagaDetail?.dataEncerramento, ""))} />
                                <DetailField label="Atualizada em" value={formatDateTime(pickString(currentVagaDetail?.updatedAt, ""))} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Resumo</div>
                                <div className="mt-2 text-sm leading-6 text-foreground">
                                    {currentVagaResumo || "Sem resumo cadastrado para esta vaga."}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Próximo passo</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">Matching IA</div>
                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Priorize candidatos da vaga e mova entre triagem, pendência, aprovação e reprovação.
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Depois do matching</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">Rodadas de seleção</div>
                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Organize aprovados em rodadas para avançar com a área e preparar o processo seletivo.
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Fechamento</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">Processo e admissão</div>
                                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                        Depois da rodada, acompanhe fases e conclua a contratação pela pré-admissão.
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {isRecrutador && currentVagaId && (
                                    <Button
                                        onClick={() => {
                                            setVagaDetailOpen(false);
                                            openEdit(currentVagaId);
                                        }}
                                    >
                                        <PenSquare className="mr-1 size-4" />
                                        Editar vaga
                                    </Button>
                                )}
                                {currentVagaId && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setVagaDetailOpen(false);
                                                persistMatchingContext(currentVagaId);
                                                router.push(`/matching?vagaId=${encodeURIComponent(currentVagaId)}`);
                                            }}
                                        >
                                            <ShieldCheck className="mr-1 size-4" />
                                            Abrir matching
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setVagaDetailOpen(false);
                                                router.push(`/gestao/projetos?vagaId=${encodeURIComponent(currentVagaId)}`);
                                            }}
                                        >
                                            <FolderOpen className="mr-1 size-4" />
                                            Ver projetos
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setVagaDetailOpen(false);
                                                router.push(`/candidatos?vagaId=${encodeURIComponent(currentVagaId)}`);
                                            }}
                                        >
                                            <Users className="mr-1 size-4" />
                                            Ver candidatos
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
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
