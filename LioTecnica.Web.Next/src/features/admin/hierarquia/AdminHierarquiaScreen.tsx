"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Plus, GripVertical, Pencil, Trash2, Save, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ────── types ────── */

interface NivelItem {
    id: string;
    nome: string;
    ordem: number;
    ativo: boolean;
}

/* ────── helpers ────── */

const API = "/api/niveis-hierarquicos";

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

/* ────── component ────── */

export default function AdminHierarquiaScreen() {
    const [items, setItems] = useState<NivelItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await fetchJson<NivelItem[]>(API);
            setItems(data.filter((i) => i.ativo));
        } catch {
            toast.error("Falha ao carregar níveis hierárquicos.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create() {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            await fetchJson(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: newName.trim() }),
            });
            setNewName("");
            toast.success("Nível criado!");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    async function update(id: string) {
        if (!editName.trim()) return;
        try {
            await fetchJson(`${API}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: editName.trim() }),
            });
            setEditId(null);
            toast.success("Nível atualizado!");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function remove(id: string) {
        if (!confirm("Desativar este nível hierárquico?")) return;
        try {
            await fetchJson(`${API}/${id}`, { method: "DELETE" });
            toast.success("Nível desativado.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function move(index: number, direction: -1 | 1) {
        const newItems = [...items];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newItems.length) return;
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setItems(newItems);
        try {
            await fetchJson(`${API}/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItems.map((i) => i.id)),
            });
        } catch (e) {
            toast.error(`Falha ao reordenar: ${e instanceof Error ? e.message : "erro"}`);
            await load();
        }
    }

    const startEdit = (item: NivelItem) => {
        setEditId(item.id);
        setEditName(item.nome);
    };

    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Níveis Hierárquicos</h4>
                <div className="text-muted-foreground text-sm">
                    Configure os níveis da hierarquia da empresa. O nível no topo (ordem 0) é o mais alto.
                </div>
            </div>

            {/* ── Add new ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            Novo Nível
                        </label>
                        <Input
                            placeholder="Ex: Diretor, Gerente, Coordenador..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void create()}
                            maxLength={120}
                        />
                    </div>
                    <Button size="sm" disabled={saving || !newName.trim()} onClick={() => void create()}>
                        <Plus className="size-4 mr-1" />
                        Adicionar
                    </Button>
                </div>
            </div>

            {/* ── List ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-1">
                {loading ? (
                    <div className="text-center text-muted-foreground py-8">Carregando…</div>
                ) : items.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        Nenhum nível cadastrado. Adicione acima.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/50 p-3 transition hover:border-primary/30"
                        >
                            <GripVertical className="size-4 text-muted-foreground/50 shrink-0" />

                            <span className="shrink-0 text-xs font-mono text-muted-foreground w-6 text-center">
                                {index}
                            </span>

                            {editId === item.id ? (
                                <div className="flex flex-1 items-center gap-2">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && void update(item.id)}
                                        className="h-8"
                                        autoFocus
                                    />
                                    <Button variant="outline" size="icon-xs" onClick={() => void update(item.id)}>
                                        <Save className="size-4" />
                                    </Button>
                                    <Button variant="outline" size="icon-xs" onClick={() => setEditId(null)}>
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <span className="flex-1 font-medium">{item.nome}</span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline" size="icon-xs"
                                            disabled={index === 0}
                                            onClick={() => void move(index, -1)}
                                        >
                                            <ArrowUp className="size-4" />
                                        </Button>
                                        <Button
                                            variant="outline" size="icon-xs"
                                            disabled={index === items.length - 1}
                                            onClick={() => void move(index, 1)}
                                        >
                                            <ArrowDown className="size-4" />
                                        </Button>
                                        <Button variant="outline" size="icon-xs" onClick={() => startEdit(item)}>
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button variant="destructive" size="icon-xs" onClick={() => void remove(item.id)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Legend ── */}
            <div className="text-xs text-muted-foreground">
                <strong>Dica:</strong> O nível com ordem 0 é o mais alto na hierarquia (ex: CEO/Presidente).
                Use as setas ↑↓ para reordenar. O gestor direto de um funcionário deve estar em um nível acima.
            </div>
        </section>
    );
}
