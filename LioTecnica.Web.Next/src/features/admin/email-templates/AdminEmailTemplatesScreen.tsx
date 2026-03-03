"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Power, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface TemplateListItem {
    id: string;
    name: string;
    subject: string | null;
    version?: number;
    isActive: boolean;
    lastModified: string | null;
}

interface TemplateDetail {
    id: string;
    name: string;
    subject: string;
    body: string;
    isActive: boolean;
}

interface FormData {
    name: string;
    subject: string;
    body: string;
    isActive: boolean;
}

const EMPTY_FORM: FormData = { name: "", subject: "", body: "", isActive: true };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminEmailTemplatesScreen() {
    const [templates, setTemplates] = useState<TemplateListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);

    // Form
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<any[]>(`/api/email-templates?includeInactive=${includeInactive}`);
            setTemplates(
                (Array.isArray(list) ? list : []).map((x) => ({
                    id: String(x.id),
                    name: String(x.name ?? ""),
                    subject: x.subjectTemplate ?? null,
                    version: typeof x.version === "number" ? x.version : undefined,
                    isActive: Boolean(x.isActive),
                    lastModified: String(x.updatedAtUtc ?? x.createdAtUtc ?? ""),
                })),
            );
        } catch {
            toast.error("Falha ao carregar templates.");
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => { void loadTemplates(); }, [loadTemplates]);

    const filtered = useMemo(() => {
        if (!q.trim()) return templates;
        const lower = q.toLowerCase();
        return templates.filter(t => t.name.toLowerCase().includes(lower) || (t.subject ?? "").toLowerCase().includes(lower));
    }, [templates, q]);

    function startCreate() { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }

    async function startEdit(id: string) {
        try {
            const raw = await fetchJson<any>(`/api/email-templates/${id}`);
            const detail: TemplateDetail = {
                id: String(raw?.id ?? id),
                name: String(raw?.name ?? ""),
                subject: String(raw?.subjectTemplate ?? ""),
                body: String(raw?.bodyHtml ?? ""),
                isActive: Boolean(raw?.isActive),
            };
            setEditId(id);
            setForm({ name: detail.name, subject: detail.subject, body: detail.body, isActive: detail.isActive });
            setShowForm(true);
        } catch {
            toast.error("Falha ao carregar template.");
        }
    }

    async function handleSave() {
        if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            if (editId) {
                await fetchJson(`/api/email-templates/${editId}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subjectTemplate: form.subject, bodyHtml: form.body }),
                });
                toast.success("Template atualizado!");
            } else {
                await fetchJson("/api/email-templates", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: form.name, subjectTemplate: form.subject, bodyHtml: form.body }),
                });
                toast.success("Template criado!");
            }
            setShowForm(false);
            void loadTemplates();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function handleSetActive(id: string) {
        try {
            await fetchJson(`/api/email-templates/${id}/set-active`, { method: "POST" });
            toast.success("Template ativado!");
            void loadTemplates();
        } catch {
            toast.error("Falha ao ativar template.");
        }
    }

    const upd = (key: keyof FormData, val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Templates de Email</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os modelos de email do sistema.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void loadTemplates()} disabled={loading}><RefreshCw className="size-4" /></Button>
                    <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" />Novo template</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{templates.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativos</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{templates.filter(t => t.isActive).length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Inativos</div>
                    <div className="mt-1 text-2xl font-bold text-zinc-500">{templates.filter(t => !t.isActive).length}</div>
                </div>
            </div>

            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar template" : "Novo template"}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Nome *</label><Input value={form.name} onChange={e => upd("name", e.target.value)} /></div>
                        <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Assunto</label><Input value={form.subject} onChange={e => upd("subject", e.target.value)} /></div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Corpo HTML</label>
                        <textarea className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono" value={form.body} onChange={e => upd("body", e.target.value)} />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => upd("isActive", e.target.checked)} className="rounded border-input" /> Ativo</label>
                    </div>
                    <div className="flex gap-2"><Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
                </div>
            )}

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Templates</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={e => setQ(e.target.value)} /></div>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="rounded border-input" /> Incluir inativos</label>
                    </div>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Assunto</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum template encontrado.</TableCell></TableRow>
                        ) : (filtered.map(t => (
                            <TableRow key={t.id}>
                                <TableCell className="font-medium"><div className="flex items-center gap-2"><Mail className="size-4 text-primary" />{t.name}</div></TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">{t.subject || "—"}</TableCell>
                                <TableCell className="text-center">{t.isActive ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativo</span> : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativo</span>}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => void startEdit(t.id)} title="Editar"><Pencil className="size-4" /></Button>
                                        {!t.isActive && <Button variant="ghost" size="sm" onClick={() => void handleSetActive(t.id)} title="Ativar"><Power className="size-4 text-emerald-600" /></Button>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )))}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
