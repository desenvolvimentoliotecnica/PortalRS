"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Filter, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const BASE = "/app";

interface EmailItem {
    id: string;
    scope: string;
    to: string;
    subject: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
    lastError: string | null;
}

interface EmailDetail extends EmailItem {
    body: string;
}

interface EmailSummary {
    total: number;
    sent: number;
    pending: number;
    failed: number;
}

interface PagedResponse {
    items: EmailItem[];
    page: number;
    totalPages: number;
    totalItems: number;
}

export default function TabEmails({ tenantId }: { tenantId: string }) {
    const apiBase = `/api/owner/tenants/${encodeURIComponent(tenantId)}/config/emails`;

    const [items, setItems] = useState<EmailItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<EmailSummary | null>(null);

    const [scope, setScope] = useState("");
    const [status, setStatus] = useState("");

    const [detail, setDetail] = useState<EmailDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [retrying, setRetrying] = useState<string | null>(null);

    const loadEmails = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: "50" });
            if (scope) params.set("scope", scope);
            if (status) params.set("status", status);
            const res = await apiFetch(`${apiBase}/messages?${params}`);
            if (!res.ok) throw new Error();
            const data: PagedResponse = await res.json();
            setItems(data.items || []);
            setPage(data.page || 1);
            setTotalPages(data.totalPages || 1);
            setTotalItems(data.totalItems || 0);
        } catch { toast.error("Erro ao carregar emails."); }
        finally { setLoading(false); }
    }, [apiBase, scope, status]);

    const loadSummary = useCallback(async () => {
        try {
            const res = await apiFetch(`${apiBase}/summary`);
            if (res.ok) setSummary(await res.json());
        } catch { }
    }, [apiBase]);

    useEffect(() => { loadEmails(1); loadSummary(); }, [loadEmails, loadSummary]);

    const openDetail = async (id: string) => {
        try {
            const res = await apiFetch(`${apiBase}/messages/${id}`);
            if (!res.ok) return;
            setDetail(await res.json());
            setDetailOpen(true);
        } catch { }
    };

    const handleRetry = async (id: string) => {
        setRetrying(id);
        try {
            const res = await apiFetch(`${apiBase}/messages/${id}/retry`, { method: "POST" });
            if (res.ok) {
                toast.success("Email reenviado.");
                loadEmails(page);
                loadSummary();
            } else { toast.error("Falha ao reenviar."); }
        } catch { toast.error("Erro ao reenviar."); }
        finally { setRetrying(null); }
    };

    const statusBadge = (s: string) => {
        const map: Record<string, { cls: string; label: string }> = {
            sent: { cls: "bg-green-100 text-green-700", label: "Enviado" },
            pending: { cls: "bg-yellow-100 text-yellow-700", label: "Pendente" },
            failed: { cls: "bg-red-100 text-red-700", label: "Falhou" },
        };
        const badge = map[s.toLowerCase()] || { cls: "bg-gray-100 text-gray-700", label: s };
        return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>;
    };

    return (
        <div className="space-y-4">
            {/* KPIs */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total", value: summary.total, color: "bg-blue-500" },
                        { label: "Enviados", value: summary.sent, color: "bg-green-500" },
                        { label: "Pendentes", value: summary.pending, color: "bg-yellow-500" },
                        { label: "Falharam", value: summary.failed, color: "bg-red-500" },
                    ].map((k) => (
                        <Card key={k.label} className="shadow-lt">
                            <CardContent className="pt-4 pb-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center text-white text-lg font-bold`}>
                                    {k.value > 99 ? "99+" : k.value}
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">{k.label}</div>
                                    <div className="font-bold text-sm">{k.value}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filters + Table */}
            <Card className="shadow-lt">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap gap-2 items-end mb-4">
                        <div>
                            <label className="text-xs font-medium mb-1 block">Escopo</label>
                            <select className="h-9 rounded-md border px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="system">Sistema</option>
                                <option value="user">Usuário</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Status</label>
                            <select className="h-9 rounded-md border px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="sent">Enviado</option>
                                <option value="pending">Pendente</option>
                                <option value="failed">Falhou</option>
                            </select>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { loadEmails(1); loadSummary(); }}>
                            <Filter className="size-3.5 mr-1" />Aplicar
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b text-xs text-muted-foreground">
                                        <th className="text-left py-2 px-2">Data</th>
                                        <th className="text-left py-2 px-2">Para</th>
                                        <th className="text-left py-2 px-2">Assunto</th>
                                        <th className="text-center py-2 px-2">Status</th>
                                        <th className="text-center py-2 px-2"></th>
                                    </tr></thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhum email encontrado.</td></tr>
                                        ) : items.map((item) => (
                                            <tr key={item.id} className="border-b hover:bg-muted/50 transition">
                                                <td className="py-1.5 px-2 whitespace-nowrap text-xs">{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                                                <td className="py-1.5 px-2 text-xs">{item.to}</td>
                                                <td className="py-1.5 px-2 text-xs max-w-[300px] truncate">{item.subject}</td>
                                                <td className="py-1.5 px-2 text-center">{statusBadge(item.status)}</td>
                                                <td className="py-1.5 px-2 text-center">
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <Button variant="outline" size="sm" onClick={() => openDetail(item.id)}>
                                                            <Eye className="size-3.5" />
                                                        </Button>
                                                        {item.status.toLowerCase() === "failed" && (
                                                            <Button variant="outline" size="sm" onClick={() => handleRetry(item.id)} disabled={retrying === item.id}>
                                                                {retrying === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground">{totalItems} emails</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => loadEmails(page - 1)} disabled={page <= 1}><ChevronLeft className="size-4" /></Button>
                                    <span className="text-xs">Pág {page}/{totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => loadEmails(page + 1)} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-base">Detalhes do email</DialogTitle></DialogHeader>
                    {detail && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-muted-foreground">Para:</span> {detail.to}</div>
                                <div><span className="text-muted-foreground">Status:</span> {statusBadge(detail.status)}</div>
                                <div><span className="text-muted-foreground">Criado:</span> {new Date(detail.createdAt).toLocaleString("pt-BR")}</div>
                                <div><span className="text-muted-foreground">Enviado:</span> {detail.sentAt ? new Date(detail.sentAt).toLocaleString("pt-BR") : "-"}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium mb-1">Assunto: {detail.subject}</div>
                            </div>
                            {detail.lastError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                    <div className="font-medium mb-1">Último erro:</div>
                                    <div className="text-xs font-mono">{detail.lastError}</div>
                                </div>
                            )}
                            {detail.body && (
                                <div>
                                    <div className="text-sm font-medium mb-1">Corpo</div>
                                    <div className="border rounded-lg p-3 bg-muted/50 text-xs font-mono max-h-[300px] overflow-y-auto whitespace-pre-wrap">{detail.body}</div>
                                </div>
                            )}
                            {detail.status.toLowerCase() === "failed" && (
                                <Button variant="outline" size="sm" onClick={() => { handleRetry(detail.id); setDetailOpen(false); }} disabled={retrying === detail.id}>
                                    <RotateCw className="size-3.5 mr-1" />Reenviar
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
