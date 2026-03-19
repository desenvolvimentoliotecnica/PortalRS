"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, RefreshCw, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

const API = "/api/colaborador/dependentes";

interface Dependente {
    id: string;
    nomeCompleto: string;
    parentesco: number;
    cpf: string | null;
    dataNascimento: string;
    isPcd: boolean;
    createdAtUtc: string;
}

const PARENTESCO_MAP: Record<number, string> = {
    0: "Cônjuge", 1: "Filho(a)", 2: "Pai", 3: "Mãe", 4: "Outro",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function formatDate(iso: string) {
    try { return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return "—"; }
}

export default function DependentesScreen() {
    const [loading, setLoading] = useState(true);
    const [deps, setDeps] = useState<Dependente[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Dependente | null>(null);
    const [saving, setSaving] = useState(false);

    // form fields
    const [fNome, setFNome] = useState("");
    const [fParentesco, setFParentesco] = useState(0);
    const [fCpf, setFCpf] = useState("");
    const [fNasc, setFNasc] = useState("");
    const [fPcd, setFPcd] = useState(false);

    const load = useCallback(async () => {
        const data = await fetchJson<Dependente[]>(API);
        setDeps(Array.isArray(data) ? data : []);
    }, []);

    useEffect(() => {
        setLoading(true);
        load().catch(() => toast.error("Falha ao carregar dependentes.")).finally(() => setLoading(false));
    }, [load]);

    function openNew() {
        setEditing(null);
        setFNome(""); setFParentesco(0); setFCpf(""); setFNasc(""); setFPcd(false);
        setFormOpen(true);
    }

    function openEdit(d: Dependente) {
        setEditing(d);
        setFNome(d.nomeCompleto); setFParentesco(d.parentesco); setFCpf(d.cpf || ""); setFNasc(d.dataNascimento); setFPcd(d.isPcd);
        setFormOpen(true);
    }

    async function handleSave() {
        if (!fNome.trim() || !fNasc) { toast.error("Preencha nome e data de nascimento."); return; }
        setSaving(true);
        try {
            const body = { nomeCompleto: fNome.trim(), parentesco: fParentesco, cpf: fCpf.trim() || null, dataNascimento: fNasc, isPcd: fPcd };
            if (editing) {
                await fetchJson(`${API}/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                toast.success("Dependente atualizado!");
            } else {
                await fetchJson(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                toast.success("Dependente adicionado!");
            }
            setFormOpen(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Remover este dependente?")) return;
        try {
            await fetchJson(`${API}/${id}`, { method: "DELETE" });
            toast.success("Dependente removido.");
            await load();
        } catch {
            toast.error("Falha ao remover.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Meus Dependentes</h4>
                    <div className="text-muted-foreground text-sm">Gerencie seus dependentes cadastrados</div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" />
                    </Button>
                    <Button size="sm" onClick={openNew} className="bg-violet-600 hover:bg-violet-700">
                        <Plus className="size-4" /> Adicionar
                    </Button>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Parentesco</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Nascimento</TableHead>
                            <TableHead>PcD</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                        ) : deps.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum dependente cadastrado.</TableCell></TableRow>
                        ) : deps.map((d) => (
                            <TableRow key={d.id}>
                                <TableCell className="font-medium">{d.nomeCompleto}</TableCell>
                                <TableCell className="text-sm">{PARENTESCO_MAP[d.parentesco] ?? "Outro"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{d.cpf || "—"}</TableCell>
                                <TableCell className="text-sm">{formatDate(d.dataNascimento)}</TableCell>
                                <TableCell className="text-sm">{d.isPcd ? "Sim" : "Não"}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => openEdit(d)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-red-600" title="Remover" onClick={() => void handleDelete(d.id)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* ── Form Dialog ── */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Dependente" : "Novo Dependente"}</DialogTitle>
                        <DialogDescription>Preencha os dados do dependente.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Nome completo *</label>
                            <Input value={fNome} onChange={(e) => setFNome(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Parentesco</label>
                            <select className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={fParentesco} onChange={(e) => setFParentesco(Number(e.target.value))}>
                                {Object.entries(PARENTESCO_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">CPF</label>
                            <Input value={fCpf} onChange={(e) => setFCpf(e.target.value)} placeholder="000.000.000-00" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">Data de nascimento *</label>
                            <Input type="date" value={fNasc} onChange={(e) => setFNasc(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={fPcd} onChange={(e) => setFPcd(e.target.checked)} className="rounded" />
                            Pessoa com deficiência (PcD)
                        </label>
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={() => setFormOpen(false)}><X className="size-4" /> Cancelar</Button>
                            <Button disabled={saving} onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                                <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
