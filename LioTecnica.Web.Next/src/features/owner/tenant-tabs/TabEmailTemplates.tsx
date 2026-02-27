"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, FileText, Loader2, Plus, Power, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
}

interface Template {
    id: string;
    key: string;
    subject: string;
    body: string;
    isActive: boolean;
}

export default function TabEmailTemplates({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/EmailTemplates/_api`;

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Template | null>(null);
    const [editing, setEditing] = useState<{ key: string; subject: string; body: string }>({ key: "", subject: "", body: "" });
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<Template[]>(`${apiBase}/templates`);
            setTemplates(data || []);
        } catch { toast.error("Erro ao carregar templates."); }
        finally { setLoading(false); }
    }, [apiBase]);

    useEffect(() => { load(); }, [load]);

    const handleSelect = (t: Template) => {
        setSelected(t);
        setEditing({ key: t.key, subject: t.subject, body: t.body });
        setIsNew(false);
    };

    const handleNew = () => {
        setSelected(null);
        setEditing({ key: "", subject: "", body: "" });
        setIsNew(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isNew) {
                await fetchJson(`${apiBase}/templates`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editing),
                });
                toast.success("Template criado.");
            } else if (selected) {
                await fetchJson(`${apiBase}/templates/${selected.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editing),
                });
                toast.success("Template atualizado.");
            }
            await load();
            setSelected(null);
            setIsNew(false);
        } catch { toast.error("Falha ao salvar template."); }
        finally { setSaving(false); }
    };

    const handleSetActive = async (id: string, isActive: boolean) => {
        try {
            await fetchJson(`${apiBase}/templates/${id}/active`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive }),
            });
            toast.success(isActive ? "Template ativado." : "Template desativado.");
            await load();
        } catch { toast.error("Falha ao atualizar status."); }
    };

    const filtered = templates.filter((t) =>
        !search || t.key.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* List Panel */}
            <Card className="shadow-lt lg:col-span-1">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Templates</CardTitle>
                        <Button variant="outline" size="sm" onClick={handleNew}><Plus className="size-3.5 mr-1" />Novo</Button>
                    </div>
                    <div className="relative mt-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar…" className="pl-8" />
                    </div>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-y-auto space-y-1 p-3">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhum template encontrado.</p>
                    ) : filtered.map((t) => (
                        <div
                            key={t.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition hover:bg-muted/50 ${selected?.id === t.id ? "bg-muted" : ""}`}
                            onClick={() => handleSelect(t)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{t.key}</div>
                                <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <span className={`w-2 h-2 rounded-full ${t.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => { e.stopPropagation(); handleSetActive(t.id, !t.isActive); }}
                                    title={t.isActive ? "Desativar" : "Ativar"}
                                >
                                    <Power className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Editor Panel */}
            <Card className="shadow-lt lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="size-4" />
                        {isNew ? "Novo template" : selected ? `Editar: ${selected.key}` : "Selecione um template"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(isNew || selected) ? (
                        <>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Chave</label>
                                <Input
                                    value={editing.key}
                                    onChange={(e) => setEditing((p) => ({ ...p, key: e.target.value }))}
                                    placeholder="ex: welcome_email, password_reset"
                                    disabled={!isNew}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Assunto</label>
                                <Input
                                    value={editing.subject}
                                    onChange={(e) => setEditing((p) => ({ ...p, subject: e.target.value }))}
                                    placeholder="Assunto do email…"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Corpo (HTML)</label>
                                <textarea
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
                                    value={editing.body}
                                    onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                                    placeholder="<html>...</html>"
                                />
                            </div>
                            <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                                {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                                {isNew ? "Criar template" : "Salvar alterações"}
                            </Button>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-12">Selecione um template da lista à esquerda ou crie um novo.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
