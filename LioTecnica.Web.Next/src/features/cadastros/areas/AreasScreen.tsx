"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Search,
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    Eye,
    ExternalLink,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ──────────────────────────── consts & types ──────────────────────────── */

const BASE = "/app";

interface AreaListItem {
    id: string;
    code: string;
    name: string;
    parentName: string | null;
    ownerName: string | null;
    status: string;
    description: string | null;
    vacanciesOpen: number;
    vacanciesTotal: number;
    parentId: string | null;
    ownerFuncionarioId: string | null;
}

interface AreaDraft {
    id?: string;
    code: string;
    name: string;
    parentId: string | null;
    ownerFuncionarioId: string | null;
    status: string;
    description: string;
}

interface AreaVaga {
    id: string;
    codigo: string;
    titulo: string;
    modalidade: string;
    status: string;
    cidade: string;
    uf: string;
    updatedAt: string;
}

interface LookupItem {
    id: string;
    name: string;
}

type AreaNode = AreaListItem & { children: AreaNode[] };

/* ──────────────────────────── helpers ──────────────────────────── */

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

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Ativo
            </span>
        );
    return (
        <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Inativo
        </span>
    );
}

const emptyDraft: AreaDraft = {
    code: "",
    name: "",
    parentId: null,
    ownerFuncionarioId: null,
    status: "ativo",
    description: "",
};

function keyOf(id: string | null | undefined) {
    const v = (id ?? "").trim().toLowerCase();
    return v ? v : null;
}

function buildAreaTree(areas: AreaListItem[]): AreaNode[] {
    const byId = new Map<string, AreaNode>();
    for (const a of areas) {
        const k = keyOf(a.id);
        if (!k) continue;
        byId.set(k, { ...a, children: [] });
    }

    const roots: AreaNode[] = [];
    for (const n of byId.values()) {
        const parentKey = keyOf(n.parentId);
        if (!parentKey || !byId.has(parentKey)) {
            roots.push(n);
        } else {
            byId.get(parentKey)!.children.push(n);
        }
    }

    const sortByName = (list: AreaNode[]) =>
        list.sort((x, y) => (x.name || "").localeCompare(y.name || ""));

    function sortAll(nodes: AreaNode[]) {
        sortByName(nodes);
        nodes.forEach((n) => {
            if (n.children.length) sortAll(n.children);
        });
    }

    sortAll(roots);
    return roots;
}

function collectNodeKeysWithChildren(roots: AreaNode[]) {
    const out: string[] = [];
    function walk(nodes: AreaNode[]) {
        for (const n of nodes) {
            if (n.children.length) {
                const k = keyOf(n.id);
                if (k) out.push(k);
                walk(n.children);
            }
        }
    }
    walk(roots);
    return out;
}

function walkTreeVisible(roots: AreaNode[], collapsedKeys: Set<string>) {
    const rows: Array<{
        area: AreaNode;
        depth: number;
        hasChildren: boolean;
        isCollapsed: boolean;
    }> = [];

    function walk(nodes: AreaNode[], depth: number, ancestorCollapsed: boolean) {
        for (const n of nodes) {
            if (ancestorCollapsed) continue;
            const hasChildren = n.children.length > 0;
            const isCollapsed = hasChildren && !!keyOf(n.id) && collapsedKeys.has(keyOf(n.id)!);
            rows.push({ area: n, depth, hasChildren, isCollapsed });
            if (hasChildren && !isCollapsed) walk(n.children, depth + 1, false);
        }
    }

    walk(roots, 0, false);
    return rows;
}

function getAreasSortedByHierarchy(areas: AreaListItem[]) {
    const byId = new Map<string, AreaListItem>();
    for (const a of areas) {
        const k = keyOf(a.id);
        if (k) byId.set(k, a);
    }

    const roots = areas.filter((a) => {
        const parentKey = keyOf(a.parentId);
        return !parentKey || !byId.has(parentKey);
    });

    const childrenByParent = new Map<string, AreaListItem[]>();
    for (const a of areas) {
        const parentKey = keyOf(a.parentId);
        if (!parentKey) continue;
        if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
        childrenByParent.get(parentKey)!.push(a);
    }
    for (const list of childrenByParent.values()) {
        list.sort((x, y) => (x.name || "").localeCompare(y.name || ""));
    }
    roots.sort((x, y) => (x.name || "").localeCompare(y.name || ""));

    const out: Array<{ area: AreaListItem; depth: number }> = [];
    function add(node: AreaListItem, depth: number) {
        out.push({ area: node, depth });
        const k = keyOf(node.id);
        if (!k) return;
        const children = childrenByParent.get(k) || [];
        children.forEach((c) => add(c, depth + 1));
    }
    roots.forEach((r) => add(r, 0));
    return out;
}

/* ──────────────────────────── component ──────────────────────────── */

export default function AreasScreen() {
    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<AreaListItem[]>([]);
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);
    const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    /* ── edit dialog ── */
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<AreaDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailArea, setDetailArea] = useState<AreaListItem | null>(null);
    const [detailVagas, setDetailVagas] = useState<AreaVaga[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<AreaListItem | null>(null);

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: AreaListItem[] }>(
            `${BASE}/Areas/_api`,
        );
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRows(items);
        setCollapsedKeys(new Set(collectNodeKeysWithChildren(buildAreaTree(items))));
    }, []);

    const loadFuncionarios = useCallback(async () => {
        try {
            const res = await fetchJson<LookupItem[]>(
                `${BASE}/api/lookup/funcionarios`,
            );
            setFuncionarios(Array.isArray(res) ? res : []);
        } catch {
            /* optional lookup, ignore errors */
        }
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.all([syncList(), loadFuncionarios()])
            .catch(() => toast.error("Falha ao carregar áreas."))
            .finally(() => {
                if (!alive) return;
                setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [syncList, loadFuncionarios]);

    const rowsById = useMemo(() => {
        const m = new Map<string, AreaListItem>();
        rows.forEach((a) => {
            const k = keyOf(a.id);
            if (k) m.set(k, a);
        });
        return m;
    }, [rows]);

    const getParentDisplay = useCallback(
        (a: AreaListItem) => {
            const parentKey = keyOf(a.parentId);
            if (parentKey) {
                const p = rowsById.get(parentKey);
                if (p) return p.name || p.code || "—";
            }
            return a.parentName || "—";
        },
        [rowsById],
    );

    /* ── filtering ── */
    const matchFiltered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((a) => {
            const st = (a.status ?? "").toLowerCase();
            if (
                statusFilter !== "all" &&
                !(
                    (statusFilter === "ativo" &&
                        (st === "ativo" || st === "active")) ||
                    (statusFilter === "inativo" &&
                        (st === "inativo" || st === "inactive"))
                )
            )
                return false;
            if (!qq) return true;
            const blob = [a.code, a.name, getParentDisplay(a), a.ownerName, a.description]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return blob.includes(qq);
        });
    }, [getParentDisplay, q, rows, statusFilter]);

    const visibleTreeRows = useMemo(() => {
        const byId = new Map<string, AreaListItem>();
        rows.forEach((a) => {
            const k = keyOf(a.id);
            if (k) byId.set(k, a);
        });

        const visibleKeys = new Set<string>();
        matchFiltered.forEach((a) => {
            const k = keyOf(a.id);
            if (k) visibleKeys.add(k);
            let parentKey = keyOf(a.parentId);
            while (parentKey) {
                const p = byId.get(parentKey);
                if (!p) break;
                visibleKeys.add(parentKey);
                parentKey = keyOf(p.parentId);
            }
        });

        const tree = buildAreaTree(rows);
        const walked = walkTreeVisible(tree, collapsedKeys);
        return walked.filter((r) => {
            const k = keyOf(r.area.id);
            return !!k && visibleKeys.has(k);
        });
    }, [collapsedKeys, matchFiltered, rows]);

    const hintText = useMemo(() => {
        if (loading) return "Carregando…";
        return visibleTreeRows.length
            ? `${visibleTreeRows.length} áreas encontradas.`
            : "Nenhuma área encontrada.";
    }, [loading, visibleTreeRows.length]);

    /* ── KPIs ── */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter(
            (a) =>
                (a.status ?? "").toLowerCase() === "ativo" ||
                (a.status ?? "").toLowerCase() === "active",
        ).length;
        const openVagas = rows.reduce((s, a) => s + (a.vacanciesOpen ?? 0), 0);
        const totalVagas = rows.reduce((s, a) => s + (a.vacanciesTotal ?? 0), 0);
        return { total, active, openVagas, totalVagas };
    }, [rows]);

    const parentOptions = useMemo(() => getAreasSortedByHierarchy(rows), [rows]);

    /* ── CRUD actions ── */
    function openNew() {
        setDraft({ ...emptyDraft });
        setEditOpen(true);
    }

    async function openEdit(area: AreaListItem) {
        try {
            const detail = await fetchJson<Record<string, unknown>>(
                `${BASE}/Areas/_api/${area.id}`,
            );
            setDraft({
                id: area.id,
                code: String(detail?.code ?? detail?.Code ?? area.code ?? ""),
                name: String(detail?.name ?? detail?.Name ?? area.name ?? ""),
                parentId:
                    String(detail?.parentId ?? detail?.ParentId ?? area.parentId ?? "") ||
                    null,
                ownerFuncionarioId:
                    String(
                        detail?.ownerFuncionarioId ??
                        detail?.OwnerFuncionarioId ??
                        area.ownerFuncionarioId ??
                        "",
                    ) || null,
                status: String(detail?.status ?? detail?.Status ?? area.status ?? "ativo"),
                description: String(
                    detail?.description ?? detail?.Description ?? area.description ?? "",
                ),
            });
            setEditOpen(true);
        } catch {
            toast.error("Falha ao carregar dados da área.");
        }
    }

    async function saveDraft() {
        if (!draft.name.trim()) {
            toast.error("O nome da área é obrigatório.");
            return;
        }
        setSaving(true);
        const apiStatus =
            draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active";
        const payload: Record<string, unknown> = {
            code: draft.code.trim() || null,
            name: draft.name.trim(),
            parentId: draft.parentId || null,
            ownerFuncionarioId: draft.ownerFuncionarioId || null,
            status: apiStatus,
            description: draft.description.trim() || null,
        };

        try {
            if (draft.id) {
                await fetchJson(`${BASE}/Areas/_api/${draft.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Área atualizada.");
            } else {
                await fetchJson(`${BASE}/Areas/_api`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Área criada.");
            }
            setEditOpen(false);
            await syncList();
        } catch {
            toast.error("Falha ao salvar área.");
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`${BASE}/Areas/_api/${deleteTarget.id}`, {
                method: "DELETE",
            });
            toast.success("Área excluída.");
            setDeleteTarget(null);
            await syncList();
        } catch {
            toast.error("Falha ao excluir área.");
        }
    }

    async function openDetail(area: AreaListItem) {
        setDetailArea(area);
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const detail = await fetchJson<Record<string, unknown>>(
                `${BASE}/Areas/_api/${area.id}`,
            );
            const vagas = Array.isArray(detail?.vagas ?? detail?.Vagas)
                ? ((detail?.vagas ?? detail?.Vagas) as AreaVaga[])
                : [];
            setDetailVagas(vagas);
        } catch {
            setDetailVagas([]);
        } finally {
            setDetailLoading(false);
        }
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Áreas</h4>
                    <div className="text-muted-foreground text-sm">
                        Gerencie as áreas da organização
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setLoading(true);
                            syncList()
                                .catch(() => toast.error("Falha ao atualizar."))
                                .finally(() => setLoading(false));
                        }}
                    >
                        <RefreshCw className="size-4" />
                        <span className="hidden sm:inline">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}>
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Nova área</span>
                    </Button>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Áreas", value: kpis.total, color: "text-primary" },
                    { label: "Ativas", value: kpis.active, color: "text-emerald-600" },
                    {
                        label: "Vagas abertas",
                        value: kpis.openVagas,
                        color: "text-amber-600",
                    },
                    {
                        label: "Vagas total",
                        value: kpis.totalVagas,
                        color: "text-primary",
                    },
                ].map((k) => (
                    <div
                        key={k.label}
                        className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"
                    >
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            {k.label}
                        </div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>
                            {k.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Lista de áreas</div>
                        <div className="text-muted-foreground text-sm">
                            Clique em uma área para ver vagas relacionadas.
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[240px] pl-8"
                                placeholder="Buscar nome, código..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-select h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Área</TableHead>
                            <TableHead>Área pai</TableHead>
                            <TableHead>Dono</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Vagas</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center text-muted-foreground py-8"
                                >
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : visibleTreeRows.length ? (
                            visibleTreeRows.map(({ area: a, depth, hasChildren, isCollapsed }) => (
                                <TableRow key={a.id}>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Expandir/colapsar"
                                                aria-label="Expandir/colapsar"
                                                className={cn(
                                                    "mr-1",
                                                    !hasChildren && "invisible pointer-events-none",
                                                )}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const k = keyOf(a.id);
                                                    if (!k) return;
                                                    setCollapsedKeys((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(k)) next.delete(k);
                                                        else next.add(k);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {hasChildren ? (
                                                    isCollapsed ? (
                                                        <ChevronRight />
                                                    ) : (
                                                        <ChevronDown />
                                                    )
                                                ) : null}
                                            </Button>

                                            <div
                                                className="min-w-0"
                                                style={{ paddingLeft: `${(depth || 0) * 2}rem` }}
                                            >
                                                <div className="font-semibold">{a.name}</div>
                                                <div className="text-muted-foreground text-xs font-mono">
                                                    {a.code || "—"}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {getParentDisplay(a)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {a.ownerName || "—"}
                                    </TableCell>
                                    <TableCell>{statusBadge(a.status)}</TableCell>
                                    <TableCell>
                                        <span className="font-mono text-sm">
                                            {a.vacanciesOpen ?? 0}/{a.vacanciesTotal ?? 0}
                                        </span>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                        {a.description || "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Detalhes"
                                                onClick={() => void openDetail(a)}
                                            >
                                                <Eye />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                title="Editar"
                                                onClick={() => void openEdit(a)}
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                className="text-destructive"
                                                title="Excluir"
                                                onClick={() => setDeleteTarget(a)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="text-center text-muted-foreground py-8"
                                >
                                    Nenhuma área encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <div>{hintText}</div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs">
                        <span className="font-semibold">{visibleTreeRows.length}</span>
                        <span>exibidas</span>
                    </div>
                </div>
            </div>

            {/* ═══════════ Edit / New Dialog ═══════════ */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar área" : "Nova área"}</DialogTitle>
                        <DialogDescription>
                            Cadastre os dados principais da área.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Código *
                            </label>
                            <Input
                                placeholder="AREA-XXX"
                                value={draft.code}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, code: e.target.value }))
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Nome *
                            </label>
                            <Input
                                placeholder="Ex.: Produção"
                                value={draft.name}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, name: e.target.value }))
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Área pai
                            </label>
                            <select
                                className="form-select h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={draft.parentId ?? ""}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        parentId: e.target.value || null,
                                    }))
                                }
                            >
                                <option value="">Nenhuma (raiz)</option>
                                {parentOptions
                                    .filter(({ area }) => area.id !== draft.id)
                                    .map(({ area, depth }) => (
                                        <option key={area.id} value={area.id}>
                                            {(depth ? "\u00A0\u00A0".repeat(depth) + "└ " : "") +
                                                area.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Dono (funcionário)
                            </label>
                            <select
                                className="form-select h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={draft.ownerFuncionarioId ?? ""}
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        ownerFuncionarioId: e.target.value || null,
                                    }))
                                }
                            >
                                <option value="">Nenhum</option>
                                {funcionarios.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Status
                            </label>
                            <select
                                className="form-select h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                value={draft.status}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, status: e.target.value }))
                                }
                            >
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                Descrição
                            </label>
                            <Input
                                placeholder="Resumo do escopo da área"
                                value={draft.description}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, description: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditOpen(false)}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={() => void saveDraft()} disabled={saving}>
                            {saving ? "Salvando…" : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══════════ Detail Dialog ═══════════ */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes da área</DialogTitle>
                        <DialogDescription>
                            Vagas relacionadas e dados da área.
                        </DialogDescription>
                    </DialogHeader>

                    {detailArea && (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-lg font-bold">{detailArea.name}</div>
                                    <div className="text-muted-foreground text-xs font-mono">
                                        {detailArea.code || "—"}
                                    </div>
                                </div>
                                {statusBadge(detailArea.status)}
                            </div>

                            {detailArea.description && (
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground">
                                        Descrição
                                    </div>
                                    <div className="text-sm">{detailArea.description}</div>
                                </div>
                            )}

                            <hr className="border-border/40" />

                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-sm">Vagas da área</div>
                                <span className="text-xs text-muted-foreground">
                                    {detailVagas.length} vagas
                                </span>
                            </div>

                            {detailLoading ? (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                    Carregando vagas…
                                </div>
                            ) : detailVagas.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Vaga</TableHead>
                                            <TableHead>Modalidade</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Local</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detailVagas.map((v) => (
                                            <TableRow key={v.id}>
                                                <TableCell className="font-mono text-xs">
                                                    {v.codigo || "—"}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {v.titulo || "—"}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {v.modalidade || "—"}
                                                </TableCell>
                                                <TableCell>{statusBadge(v.status)}</TableCell>
                                                <TableCell className="text-sm">
                                                    {[v.cidade, v.uf].filter(Boolean).join(" - ") || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        title="Abrir vaga"
                                                        onClick={() =>
                                                            window.open(`/app/vagas?id=${v.id}`, "_blank")
                                                        }
                                                    >
                                                        <ExternalLink />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                    Nenhuma vaga vinculada.
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══════════ Delete Confirm Dialog ═══════════ */}
            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Deseja realmente excluir a área{" "}
                            <strong>&quot;{deleteTarget?.name}&quot;</strong>? Esta ação não
                            pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
