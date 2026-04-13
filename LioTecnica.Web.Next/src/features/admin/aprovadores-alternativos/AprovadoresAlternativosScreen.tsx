"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, UserCheck } from "lucide-react";

/* ──────────────────────────── types ──────────────────────────── */

interface AprovadorAlternativoResponse {
    id: string;
    gestorId: string;
    gestorNome: string;
    aprovadorId: string;
    aprovadorNome: string;
    dataInicio: string; // "YYYY-MM-DD"
    dataFim: string | null; // "YYYY-MM-DD" | null
    ativo: boolean;
    createdAtUtc: string;
}

interface PagedResult<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
}

interface FuncionarioLookup {
    id: string;
    nome: string;
}

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    value,
    onChange,
    placeholder,
}: {
    items: FuncionarioLookup[];
    value: string | null;
    onChange: (id: string | null, nome: string | null) => void;
    placeholder: string;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = items.find((i) => i.id === value) ?? null;
    const filtered = query.trim()
        ? items.filter((i) => i.nome.toLowerCase().includes(query.toLowerCase()))
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
                    value={open ? query : (selected?.nome ?? "")}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => { onChange(null, null); setQuery(""); }}
                        className="px-2 text-muted-foreground hover:text-foreground text-xs"
                        tabIndex={-1}
                    >
                        ✕
                    </button>
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
                                    onChange(item.id, item.nome);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.nome}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── helpers ──────────────────────────── */

function formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
}

function vigenciaLabel(item: AprovadorAlternativoResponse): string {
    return `${formatDate(item.dataInicio)} → ${item.dataFim ? formatDate(item.dataFim) : "Indefinido"}`;
}

/* ──────────────────────────── FormModal ──────────────────────────── */

interface FormState {
    gestorId: string | null;
    gestorNome: string | null;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    dataInicio: string;
    dataFim: string;
}

function FormModal({
    editingItem,
    funcionarios,
    onClose,
    onSaved,
}: {
    editingItem: AprovadorAlternativoResponse | null;
    funcionarios: FuncionarioLookup[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = editingItem !== null;

    const [form, setForm] = useState<FormState>({
        gestorId: editingItem?.gestorId ?? null,
        gestorNome: editingItem?.gestorNome ?? null,
        aprovadorId: editingItem?.aprovadorId ?? null,
        aprovadorNome: editingItem?.aprovadorNome ?? null,
        dataInicio: editingItem?.dataInicio ?? "",
        dataFim: editingItem?.dataFim ?? "",
    });
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!form.gestorId) { toast.error("Selecione o gestor."); return; }
        if (!form.aprovadorId) { toast.error("Selecione o aprovador alternativo."); return; }
        if (!form.dataInicio) { toast.error("Informe a data de início."); return; }
        if (form.gestorId === form.aprovadorId) {
            toast.error("O gestor e o aprovador alternativo não podem ser a mesma pessoa.");
            return;
        }

        setSaving(true);
        try {
            const body = {
                gestorId: form.gestorId,
                aprovadorId: form.aprovadorId,
                dataInicio: form.dataInicio,
                dataFim: form.dataFim || null,
            };
            const url = isEdit
                ? `/api/admin/aprovadores-alternativos/${editingItem!.id}`
                : "/api/admin/aprovadores-alternativos";
            const res = await apiFetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success(isEdit ? "Atualizado com sucesso!" : "Criado com sucesso!");
            onSaved();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-background border border-border shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-base font-semibold">
                        {isEdit ? "Editar Aprovador Alternativo" : "Novo Aprovador Alternativo"}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Gestor <span className="text-red-500">*</span></label>
                        <AutocompleteSelect
                            items={funcionarios}
                            value={form.gestorId}
                            onChange={(id, nome) => setForm((f) => ({ ...f, gestorId: id, gestorNome: nome }))}
                            placeholder="gestor"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Quem será substituído durante a vigência.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5">Aprovador Alternativo <span className="text-red-500">*</span></label>
                        <AutocompleteSelect
                            items={funcionarios}
                            value={form.aprovadorId}
                            onChange={(id, nome) => setForm((f) => ({ ...f, aprovadorId: id, aprovadorNome: nome }))}
                            placeholder="aprovador alternativo"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Quem aprovará no lugar do gestor.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Data Início <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className="h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                                value={form.dataInicio}
                                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Data Fim <span className="text-muted-foreground font-normal">(opcional)</span></label>
                            <input
                                type="date"
                                className="h-9 w-full rounded-md border border-input px-3 text-sm bg-background"
                                value={form.dataFim}
                                onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void handleSave()} disabled={saving}>
                        {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function AprovadoresAlternativosScreen() {
    const [items, setItems] = useState<AprovadorAlternativoResponse[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [apenasAtivos, setApenasAtivos] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const [funcionarios, setFuncionarios] = useState<FuncionarioLookup[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AprovadorAlternativoResponse | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Load funcionarios lookup once
    useEffect(() => {
        apiFetch("/api/lookup/funcionarios?pageSize=500")
            .then((r) => r.json())
            .then((data: unknown) => {
                const arr = Array.isArray(data)
                    ? data
                    : Array.isArray((data as { items?: unknown[] })?.items)
                        ? (data as { items: { id: string; nome: string }[] }).items
                        : [];
                setFuncionarios(arr as FuncionarioLookup[]);
            })
            .catch(() => toast.error("Falha ao carregar funcionários."));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (apenasAtivos) params.set("apenasAtivos", "true");
            params.set("page", String(page));
            params.set("pageSize", String(pageSize));
            const res = await apiFetch(`/api/admin/aprovadores-alternativos?${params.toString()}`);
            const data = await res.json() as PagedResult<AprovadorAlternativoResponse>;
            setItems(data.items ?? []);
            setTotalCount(data.totalCount ?? 0);
        } catch {
            toast.error("Falha ao carregar aprovadores alternativos.");
        } finally {
            setLoading(false);
        }
    }, [q, apenasAtivos, page]);

    useEffect(() => { void load(); }, [load]);

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            const res = await apiFetch(`/api/admin/aprovadores-alternativos/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success("Removido com sucesso.");
            void load();
        } catch {
            toast.error("Falha ao remover.");
        } finally {
            setDeletingId(null);
        }
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <UserCheck className="size-5 text-muted-foreground" />
                        Aprovadores Alternativos
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Registre substitutos para gestores durante períodos de ausência. O workflow substitui automaticamente o aprovador quando uma vigência ativa é encontrada.
                    </p>
                </div>
                <Button onClick={() => { setEditingItem(null); setModalOpen(true); }}>
                    <Plus className="size-4 mr-1.5" />
                    Novo
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <input
                    className="h-9 w-64 rounded-md border border-input px-3 text-sm bg-background"
                    placeholder="Buscar por gestor ou aprovador…"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(1); }}
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={apenasAtivos}
                        onChange={(e) => { setApenasAtivos(e.target.checked); setPage(1); }}
                        className="rounded"
                    />
                    Apenas ativos
                </label>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Gestor</TableHead>
                            <TableHead>Aprovador Alternativo</TableHead>
                            <TableHead>Vigência</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center">
                                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                                    Nenhum aprovador alternativo encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.gestorNome}</TableCell>
                                    <TableCell>{item.aprovadorNome}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {vigenciaLabel(item)}
                                    </TableCell>
                                    <TableCell>
                                        {item.ativo ? (
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 border border-green-200">
                                                Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
                                                Inativo
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => { setEditingItem(item); setModalOpen(true); }}
                                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                title="Editar"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(item.id)}
                                                disabled={deletingId === item.id}
                                                className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 text-muted-foreground disabled:opacity-50"
                                                title="Excluir"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{totalCount} registro{totalCount !== 1 ? "s" : ""}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Anterior
                        </Button>
                        <span className="flex items-center px-2">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <FormModal
                    editingItem={editingItem}
                    funcionarios={funcionarios}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); void load(); }}
                />
            )}
        </section>
    );
}
