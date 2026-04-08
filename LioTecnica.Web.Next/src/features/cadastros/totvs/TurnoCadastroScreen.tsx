"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface ImportRow {
    code: string;
    description: string;
    startTime: string;
    endTime: string;
    notes: string;
    isActive: boolean;
}

interface Item {
    id: string;
    code: string;
    description: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
}

interface Draft {
    id?: string;
    code: string;
    description: string;
    startTime: string;
    endTime: string;
    notes: string;
    isActive: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function statusBadge(active: boolean) {
    return active ? (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>
    ) : (
        <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>
    );
}

const emptyDraft: Draft = { code: "", description: "", startTime: "", endTime: "", notes: "", isActive: true };

export default function TurnoCadastroScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Item[]>([]);
    const [search, setSearch] = useState("");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importRows, setImportRows] = useState<ImportRow[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(rows.length, {
        initialPageSize: 20,
        resetDeps: [search],
    });

    const syncList = useCallback(async () => {
        try {
            setLoading(true);
            const items = await fetchJson<Item[]>("/api/turnos");
            setRows(Array.isArray(items) ? items : []);
        } catch (err) {
            console.error("Erro ao carregar turnos:", err);
            toast.error("Erro ao carregar turnos");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        syncList();
    }, [syncList]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((x) => x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
    }, [search, rows]);

    const paginated = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

    const save = async () => {
        if (!draft.code.trim() || !draft.description.trim()) {
            toast.error("Código e descrição são obrigatórios");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                code: draft.code.trim(),
                description: draft.description.trim(),
                startTime: draft.startTime?.trim() || null,
                endTime: draft.endTime?.trim() || null,
                notes: draft.notes?.trim() || null,
                isActive: draft.isActive,
            };

            if (draft.id) {
                await fetchJson(`/api/turnos/${draft.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Turno atualizado com sucesso");
            } else {
                await fetchJson("/api/turnos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                toast.success("Turno criado com sucesso");
            }

            setEditOpen(false);
            await syncList();
        } catch (err) {
            console.error("Erro ao salvar:", err);
            toast.error("Erro ao salvar turno");
        } finally {
            setSaving(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

                if (raw.length === 0) {
                    toast.error("Planilha vazia ou sem dados reconhecidos.");
                    return;
                }

                const norm = (s: string) =>
                    String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                const parsed: ImportRow[] = raw.map((r) => {
                    const key = (variants: string[]) => {
                        const found = Object.keys(r).find((k) => variants.some((v) => norm(k) === norm(v)));
                        return found ? String(r[found] ?? "").trim() : "";
                    };
                    const statusStr = key(["status", "ativo", "ativa"]).toLowerCase();
                    const isActive = statusStr === "" || statusStr === "ativo" || statusStr === "ativa" || statusStr === "true" || statusStr === "1";
                    return {
                        code: key(["codigo", "code"]),
                        description: key(["descricao", "description"]),
                        startTime: key(["inicio", "start", "starttime", "hora inicio"]),
                        endTime: key(["fim", "end", "endtime", "hora fim"]),
                        notes: key(["observacoes", "observacao", "notes", "obs"]),
                        isActive,
                    };
                }).filter((r) => r.code && r.description);

                if (parsed.length === 0) {
                    toast.error("Nenhuma linha válida. Inclua colunas Código e Descrição.");
                    return;
                }

                setImportRows(parsed);
                setImportResult(null);
                setImportOpen(true);
            } catch (err) {
                console.error("Erro ao ler planilha:", err);
                toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const runImport = async () => {
        if (importRows.length === 0) return;
        setImporting(true);

        const existingMap = new Map(rows.map((r) => [r.code.toLowerCase(), r.id]));

        let created = 0, updated = 0, errors = 0;

        for (const row of importRows) {
            const payload = {
                code: row.code,
                description: row.description,
                startTime: row.startTime?.trim() || null,
                endTime: row.endTime?.trim() || null,
                notes: row.notes?.trim() || null,
                isActive: row.isActive,
            };
            try {
                const existingId = existingMap.get(row.code.toLowerCase());
                if (existingId) {
                    await fetchJson(`/api/turnos/${existingId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    updated++;
                } else {
                    await fetchJson("/api/turnos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    created++;
                }
            } catch {
                errors++;
            }
        }

        setImportResult({ created, updated, errors });
        setImporting(false);
        await syncList();
    };

    const exportToExcel = () => {
        const header = ["Código", "Descrição", "Início", "Fim", "Observações", "Status"];
        const data = rows.map((x) => [
            x.code,
            x.description,
            x.startTime || "",
            x.endTime || "",
            x.notes || "",
            x.isActive ? "Ativo" : "Inativo",
        ]);
        const csv = [header.join("\t"), ...data.map((row) => row.join("\t"))].join("\n");
        const blob = new Blob([csv], { type: "text/plain;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "turnos.tsv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Turnos (TOTVS)</h1>
                <p className="text-muted-foreground mt-2">Gerencie os turnos de trabalho para integração com TOTVS</p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por código ou descrição..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={syncList} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Início</TableHead>
                            <TableHead>Fim</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    Nenhum turno encontrado
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell>{item.startTime || "-"}</TableCell>
                                    <TableCell>{item.endTime || "-"}</TableCell>
                                    <TableCell>{statusBadge(item.isActive)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => { setDraft({ ...item, startTime: item.startTime || "", endTime: item.endTime || "", notes: item.notes || "" }); setEditOpen(true); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filtered.length > 0 && (
                <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
            )}

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar Turno" : "Novo Turno"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Código *</label>
                            <Input placeholder="Ex: T1, T2..." value={draft.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, code: e.target.value })} maxLength={30} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Descrição *</label>
                            <Input placeholder="Ex: Manhã" value={draft.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, description: e.target.value })} maxLength={120} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Início (HH:mm)</label>
                                <Input placeholder="08:00" value={draft.startTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, startTime: e.target.value })} maxLength={5} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Fim (HH:mm)</label>
                                <Input placeholder="17:00" value={draft.endTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, endTime: e.target.value })} maxLength={5} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Observações</label>
                            <textarea className="w-full px-3 py-2 border border-input rounded-md text-sm" placeholder="..." value={draft.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, notes: e.target.value })} maxLength={500} rows={3} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isActive" checked={draft.isActive} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, isActive: e.target.checked })} />
                            <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Ativo</label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) { setImportOpen(open); if (!open) setImportRows([]); } }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Importar Turnos</DialogTitle>
                        <DialogDescription>
                            {importResult
                                ? `Importação concluída: ${importResult.created} criados, ${importResult.updated} atualizados${importResult.errors > 0 ? `, ${importResult.errors} erros` : ""}.`
                                : `${importRows.length} registro(s). Códigos já existentes serão atualizados.`}
                        </DialogDescription>
                    </DialogHeader>

                    {!importResult && (
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Código</th>
                                        <th className="px-3 py-2 text-left font-medium">Descrição</th>
                                        <th className="px-3 py-2 text-left font-medium">Início</th>
                                        <th className="px-3 py-2 text-left font-medium">Fim</th>
                                        <th className="px-3 py-2 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importRows.slice(0, 50).map((r, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="px-3 py-1.5 font-mono">{r.code}</td>
                                            <td className="px-3 py-1.5">{r.description}</td>
                                            <td className="px-3 py-1.5 text-muted-foreground">{r.startTime || "—"}</td>
                                            <td className="px-3 py-1.5 text-muted-foreground">{r.endTime || "—"}</td>
                                            <td className="px-3 py-1.5">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>
                                                    {r.isActive ? "Ativo" : "Inativo"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {importRows.length > 50 && (
                                        <tr className="border-t">
                                            <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground text-xs">
                                                … e mais {importRows.length - 50} registro(s)
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null); }} disabled={importing}>
                            {importResult ? "Fechar" : "Cancelar"}
                        </Button>
                        {!importResult && (
                            <Button onClick={runImport} disabled={importing}>
                                {importing ? "Importando..." : `Importar ${importRows.length} registro(s)`}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>Tem certeza que deseja remover "{deleteTarget?.code}"? Esta ação não pode ser desfeita.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => { if (!deleteTarget) return; try { await fetchJson(`/api/turnos/${deleteTarget.id}`, { method: "DELETE" }); toast.success("Turno removido com sucesso"); setDeleteTarget(null); await syncList(); } catch (err) { toast.error("Erro ao remover turno"); } }}>Remover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
