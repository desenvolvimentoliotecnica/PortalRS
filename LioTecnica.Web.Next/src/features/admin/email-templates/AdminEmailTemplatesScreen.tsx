"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Mail, Check, Plus, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface EmailTemplateListItem {
    id: string;
    name: string;
    version: number;
    isActive: boolean;
    subjectTemplate: string;
    createdAtUtc: string;
    updatedAtUtc: string;
}

interface EmailTemplateDetail {
    id: string;
    name: string;
    version: number;
    isActive: boolean;
    subjectTemplate: string;
    bodyHtml: string;
    createdAtUtc: string;
    updatedAtUtc: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.message || `HTTP ${res.status}`);
    }
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function AdminEmailTemplatesScreen() {
    const [templates, setTemplates] = useState<EmailTemplateListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [includeInactive, setIncludeInactive] = useState(false);
    const [selected, setSelected] = useState<EmailTemplateDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<EmailTemplateListItem[]>(`/api/email-templates?includeInactive=${includeInactive}`);
            setTemplates(list);
        } catch (err) {
            console.error("Failed to load email templates", err);
            toast.error("Falha ao carregar templates de email.");
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => { void loadTemplates(); }, [loadTemplates]);

    async function viewDetail(id: string) {
        setLoadingDetail(true);
        try {
            const detail = await fetchJson<EmailTemplateDetail>(`/api/email-templates/${id}`);
            setSelected(detail);
        } catch {
            toast.error("Falha ao carregar detalhes do template.");
        } finally {
            setLoadingDetail(false);
        }
    }

    async function handleSetActive(id: string) {
        try {
            await apiFetch(`/api/email-templates/${id}/set-active`, { method: "POST" });
            toast.success("Template ativado!");
            void loadTemplates();
        } catch {
            toast.error("Falha ao ativar template.");
        }
    }

    const activeCount = templates.filter(t => t.isActive).length;
    const uniqueNames = [...new Set(templates.map(t => t.name))].length;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Templates de Email</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os templates de email do sistema.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                        Incluir inativos
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => void loadTemplates()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Templates</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{uniqueNames}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Versões</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{templates.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativos</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Assunto</TableHead>
                            <TableHead className="text-center">Versão</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Atualizado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : templates.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum template encontrado.</TableCell></TableRow>
                        ) : (
                            templates.map((t) => (
                                <TableRow key={t.id} className={!t.isActive ? "opacity-50" : ""}>
                                    <TableCell className="font-medium flex items-center gap-2"><Mail className="size-4 text-primary" /> {t.name}</TableCell>
                                    <TableCell className="text-sm max-w-[300px] truncate">{t.subjectTemplate}</TableCell>
                                    <TableCell className="text-center">v{t.version}</TableCell>
                                    <TableCell className="text-center">
                                        {t.isActive
                                            ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativo</span>
                                            : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativo</span>
                                        }
                                    </TableCell>
                                    <TableCell className="text-xs">{fmtDate(t.updatedAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => void viewDetail(t.id)} title="Visualizar">
                                                <Eye className="size-4" />
                                            </Button>
                                            {!t.isActive && (
                                                <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => void handleSetActive(t.id)} title="Ativar">
                                                    <Check className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Detail preview */}
            {selected && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="font-semibold">Pré-visualização: {selected.name} (v{selected.version})</div>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>✕ Fechar</Button>
                    </div>
                    <div className="text-sm"><strong>Assunto:</strong> {selected.subjectTemplate}</div>
                    <div className="border rounded-lg p-4 bg-white dark:bg-zinc-900" dangerouslySetInnerHTML={{ __html: selected.bodyHtml }} />
                </div>
            )}
        </section>
    );
}
