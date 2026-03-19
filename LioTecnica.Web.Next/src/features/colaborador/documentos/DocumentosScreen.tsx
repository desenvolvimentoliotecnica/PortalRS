"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";

const API = "/api/colaborador/documentos";

interface Documento {
    id: string;
    tipo: number;
    nomeArquivo: string;
    contentType: string;
    tamanhoBytes: number;
    status: number;
    observacaoRh: string | null;
    createdAtUtc: string;
}

const TIPO_MAP: Record<number, string> = {
    0: "RG", 1: "CPF", 2: "CNH", 3: "Título de Eleitor", 4: "Reservista",
    5: "Comprovante Residência", 6: "Certidão Nasc./Casamento", 7: "PIS/PASEP", 8: "Outro",
};

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    1: { label: "Validado", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    2: { label: "Rejeitado", color: "bg-red-500/15 text-red-700", icon: XCircle },
};

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string) {
    try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

export default function DocumentosScreen() {
    const [loading, setLoading] = useState(true);
    const [docs, setDocs] = useState<Documento[]>([]);
    const [uploading, setUploading] = useState(false);
    const [tipo, setTipo] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        const data = await fetchJson<Documento[]>(API);
        setDocs(Array.isArray(data) ? data : []);
    }, []);

    useEffect(() => {
        setLoading(true);
        load().catch(() => toast.error("Falha ao carregar documentos.")).finally(() => setLoading(false));
    }, [load]);

    async function handleUpload() {
        const file = fileRef.current?.files?.[0];
        if (!file) { toast.error("Selecione um arquivo."); return; }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("tipo", String(tipo));
            fd.append("file", file);
            const res = await apiFetch(API, { method: "POST", body: fd });
            if (!res.ok) { const t = await res.text(); throw new Error(t || res.statusText); }
            toast.success("Documento enviado!");
            if (fileRef.current) fileRef.current.value = "";
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Remover este documento?")) return;
        try {
            await fetchJson(`${API}/${id}`, { method: "DELETE" });
            toast.success("Documento removido.");
            await load();
        } catch {
            toast.error("Falha ao remover.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Meus Documentos</h4>
                    <div className="text-muted-foreground text-sm">Envie e gerencie seus documentos pessoais</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
                    <RefreshCw className="size-4" /> Atualizar
                </Button>
            </div>

            {/* ── Upload ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="text-sm font-semibold mb-3">Enviar novo documento</div>
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                        <select className="rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>
                            {Object.entries(TIPO_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Arquivo (PDF, JPG, PNG — máx 10MB)</label>
                        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
                    </div>
                    <Button disabled={uploading} onClick={handleUpload} className="bg-violet-600 hover:bg-violet-700">
                        <Upload className="size-4" /> {uploading ? "Enviando…" : "Enviar"}
                    </Button>
                </div>
            </div>

            {/* ── List ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="font-semibold mb-2">Documentos enviados</div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                        ) : docs.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum documento enviado.</TableCell></TableRow>
                        ) : docs.map((d) => {
                            const s = STATUS_MAP[d.status] ?? STATUS_MAP[0];
                            const Icon = s.icon;
                            return (
                                <TableRow key={d.id}>
                                    <TableCell className="text-sm font-medium">{TIPO_MAP[d.tipo] ?? "Outro"}</TableCell>
                                    <TableCell className="text-sm"><FileText className="inline size-3 mr-1" />{d.nomeArquivo}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatSize(d.tamanhoBytes)}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
                                            <Icon className="size-3" />{s.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(d.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon-xs" className="text-red-600" title="Remover" onClick={() => void handleDelete(d.id)}>
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
