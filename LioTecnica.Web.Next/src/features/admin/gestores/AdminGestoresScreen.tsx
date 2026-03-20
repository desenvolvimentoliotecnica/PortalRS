"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */

interface FuncionarioItem {
    id: string;
    name: string;
    email: string;
    jobPositionName: string | null;
    nivelHierarquicoId: string | null;
    nivelHierarquicoNome: string | null;
    gestorDiretoId: string | null;
    gestorDiretoNome: string | null;
}

interface NivelItem {
    id: string;
    nome: string;
}

/* ── Helpers ── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return res.json();
}

/* ── Component ── */

export default function AdminGestoresScreen() {
    const [funcionarios, setFuncionarios] = useState<FuncionarioItem[]>([]);
    const [niveis, setNiveis] = useState<NivelItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    // editMap: { [funcionarioId]: { gestorDiretoId, nivelHierarquicoId } }
    const [editMap, setEditMap] = useState<Record<string, { gestorDiretoId: string; nivelHierarquicoId: string }>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, niveisRes] = await Promise.all([
                fetchJson<any>("/api/funcionarios?pageSize=200"),
                fetchJson<NivelItem[]>("/api/niveis-hierarquicos"),
            ]);

            const items: FuncionarioItem[] = (res?.items ?? res ?? []);
            setFuncionarios(items);
            setNiveis(niveisRes ?? []);

            // Inicializa editMap com os valores atuais
            const map: Record<string, { gestorDiretoId: string; nivelHierarquicoId: string }> = {};
            items.forEach((f) => {
                map[f.id] = {
                    gestorDiretoId: f.gestorDiretoId ?? "",
                    nivelHierarquicoId: f.nivelHierarquicoId ?? "",
                };
            });
            setEditMap(map);
        } catch {
            toast.error("Falha ao carregar funcionários.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleSave(id: string) {
        const vals = editMap[id];
        if (!vals) return;
        setSaving(id);
        try {
            await apiFetch(`/api/funcionarios/${id}/hierarquia`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gestorDiretoId: vals.gestorDiretoId || null,
                    nivelHierarquicoId: vals.nivelHierarquicoId || null,
                }),
            });
            toast.success("Hierarquia salva.");
            void load();
        } catch {
            toast.error("Falha ao salvar hierarquia.");
        } finally {
            setSaving(null);
        }
    }

    function setGestor(id: string, gestorDiretoId: string) {
        setEditMap((m) => ({ ...m, [id]: { ...m[id], gestorDiretoId } }));
    }

    function setNivel(id: string, nivelHierarquicoId: string) {
        setEditMap((m) => ({ ...m, [id]: { ...m[id], nivelHierarquicoId } }));
    }

    function hasChanges(f: FuncionarioItem) {
        const curr = editMap[f.id];
        if (!curr) return false;
        return (curr.gestorDiretoId || null) !== (f.gestorDiretoId ?? null) ||
            (curr.nivelHierarquicoId || null) !== (f.nivelHierarquicoId ?? null);
    }

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Hierarquia de Funcionários</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure quem é o gestor direto e o nível hierárquico de cada funcionário.
                        Estes dados são usados para resolver aprovadores de solicitações de vaga automaticamente.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Nível Hierárquico</TableHead>
                        <TableHead>Gestor Direto</TableHead>
                        <TableHead className="text-right">Salvar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                Carregando...
                            </TableCell>
                        </TableRow>
                    ) : funcionarios.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                                Nenhum funcionário encontrado.
                            </TableCell>
                        </TableRow>
                    ) : (
                        funcionarios.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell>
                                    <div className="font-medium">{f.name}</div>
                                    <div className="text-xs text-muted-foreground">{f.email}</div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {f.jobPositionName ?? "—"}
                                </TableCell>
                                <TableCell>
                                    <select
                                        className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                                        value={editMap[f.id]?.nivelHierarquicoId ?? ""}
                                        onChange={(e) => setNivel(f.id, e.target.value)}
                                    >
                                        <option value="">Sem nível</option>
                                        {niveis.map((n) => (
                                            <option key={n.id} value={n.id}>{n.nome}</option>
                                        ))}
                                    </select>
                                </TableCell>
                                <TableCell>
                                    <select
                                        className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                                        value={editMap[f.id]?.gestorDiretoId ?? ""}
                                        onChange={(e) => setGestor(f.id, e.target.value)}
                                    >
                                        <option value="">Sem gestor direto</option>
                                        {funcionarios
                                            .filter((x) => x.id !== f.id)
                                            .map((x) => (
                                                <option key={x.id} value={x.id}>{x.name}</option>
                                            ))}
                                    </select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant={hasChanges(f) ? "default" : "outline"}
                                        size="sm"
                                        disabled={saving === f.id || !hasChanges(f)}
                                        onClick={() => handleSave(f.id)}
                                    >
                                        {saving === f.id ? "..." : <Save className="size-4" />}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
