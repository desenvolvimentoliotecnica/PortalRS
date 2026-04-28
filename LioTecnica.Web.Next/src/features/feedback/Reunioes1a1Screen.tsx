"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    RefreshCw, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
    Search, Calendar, Clock, ArrowUpDown, X, Users,
    BookTemplate, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ── Types ── */
interface OneOnOneMeeting {
    id: string;
    participantName: string;
    scheduledAt: string;
    endTime?: string | null;
    subject?: string | null;
    notes: string | null;
    status: string;
    createdAtUtc: string;
}
interface OneOnOneList {
    items: OneOnOneMeeting[];
    totalItems: number;
    page: number;
    pageSize: number;
}

/* Templates de pauta — Entrega 1.2 (Fase 1 Paridade Feedz) */
interface OneOnOneTemplateItemResponse {
    id: string;
    texto: string;
    ordem: number;
}

interface OneOnOneTemplateResponse {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    categoria: string | null;
    isSystem: boolean;
    isActive: boolean;
    ordem: number;
    totalItens: number;
    criadoEmUtc: string;
    itens: OneOnOneTemplateItemResponse[];
}

type SortKey = "name" | "last" | "next" | "freq";
type SortDir = "asc" | "desc";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

function isFuture(iso: string) {
    try { return new Date(iso) > new Date(); } catch { return false; }
}

export default function Reunioes1a1Screen() {
    const [data, setData] = useState<OneOnOneList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filters
    const [filterName, setFilterName] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterCategoria, setFilterCategoria] = useState("");
    const [filterFrequencia, setFilterFrequencia] = useState("");

    // Sort
    const [sortKey, setSortKey] = useState<SortKey>("next");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [formDate, setFormDate] = useState("");
    const [formEndTime, setFormEndTime] = useState("");
    const [formSubject, setFormSubject] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formTemplateId, setFormTemplateId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Templates de pauta (Entrega 1.2)
    const [templates, setTemplates] = useState<OneOnOneTemplateResponse[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesPickerOpen, setTemplatesPickerOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            const result = await fetchJson<OneOnOneList>(`/api/feedback/one-on-one?${qs}`);
            setData(result);
        } catch {
            // API may not exist yet — show empty state
            setData({ items: [], totalItems: 0, page: 1, pageSize });
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => { void loadData(); }, [loadData]);

    // Filter + sort
    const processed = useMemo(() => {
        let items = data?.items ?? [];
        const lName = filterName.toLowerCase();
        if (lName) items = items.filter((m) => m.participantName?.toLowerCase().includes(lName));
        if (filterStatus) items = items.filter((m) => m.status?.toLowerCase() === filterStatus);

        items = [...items].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name": cmp = (a.participantName ?? "").localeCompare(b.participantName ?? "", "pt-BR"); break;
                case "last": cmp = (a.createdAtUtc ?? "").localeCompare(b.createdAtUtc ?? ""); break;
                case "next": cmp = (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""); break;
                default: break;
            }
            return sortDir === "desc" ? -cmp : cmp;
        });
        return items;
    }, [data, filterName, filterStatus, sortKey, sortDir]);

    // Upcoming meetings
    const upcoming = useMemo(() => {
        return (data?.items ?? []).filter((m) => isFuture(m.scheduledAt)).sort(
            (a, b) => a.scheduledAt.localeCompare(b.scheduledAt)
        ).slice(0, 5);
    }, [data]);

    const totalPages = Math.ceil((data?.totalItems ?? 0) / pageSize);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    }

    function openCreate() {
        setEditId(null); setFormName(""); setFormDate(""); setFormEndTime(""); setFormSubject(""); setFormNotes(""); setFormTemplateId(null);
        setModalOpen(true);
    }

    function openEdit(m: OneOnOneMeeting) {
        setEditId(m.id);
        setFormName(m.participantName ?? "");
        setFormDate(m.scheduledAt?.slice(0, 16) ?? "");
        setFormEndTime(m.endTime ?? "");
        setFormSubject(m.subject ?? "");
        setFormNotes(m.notes ?? "");
        setFormTemplateId(null);
        setModalOpen(true);
    }

    /* Templates de pauta — Entrega 1.2 */
    const loadTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const data = await fetchJson<OneOnOneTemplateResponse[]>("/api/feedback/oneonone/templates");
            setTemplates(data ?? []);
        } catch {
            toast.error("Falha ao carregar templates de pauta.");
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    function renderPautaMarkdown(t: OneOnOneTemplateResponse): string {
        const bullets = t.itens
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map(i => `- ${i.texto}`)
            .join("\n");
        return t.descricao
            ? `**Pauta — ${t.nome}**\n\n_${t.descricao}_\n\n${bullets}`
            : `**Pauta — ${t.nome}**\n\n${bullets}`;
    }

    function applyTemplate(t: OneOnOneTemplateResponse) {
        setFormTemplateId(t.id);
        setFormSubject(t.nome);
        setFormNotes(renderPautaMarkdown(t));
        setTemplatesPickerOpen(false);
        // Mantém modal de criar/editar aberto se já estiver
        if (!modalOpen) {
            setEditId(null);
            setFormName("");
            setFormDate("");
            setFormEndTime("");
            setModalOpen(true);
        }
    }

    async function handleSave() {
        if (!formName.trim()) { toast.error("Informe o colaborador."); return; }
        if (!formDate) { toast.error("Informe a data."); return; }
        setSaving(true);
        try {
            const body = {
                participantName: formName.trim(),
                scheduledAt: formDate,
                endTime: formEndTime || null,
                subject: formSubject.trim() || null,
                notes: formNotes.trim() || null,
                // Entrega 1.2: id do template usado, para auditoria/métricas (backend usa
                // só se Subject/Notes vierem null — mas como já preenchemos no front, é redundante,
                // serve como rastro).
                templateId: formTemplateId,
            };
            if (editId) {
                await fetchJson(`/api/feedback/one-on-one/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                toast.success("Reunião atualizada ✅");
            } else {
                await fetchJson("/api/feedback/one-on-one", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                toast.success("Reunião criada ✅");
            }
            setModalOpen(false);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally { setSaving(false); }
    }

    async function handleDelete(id: string) {
        if (!(await confirmDialog({ title: "Excluir reunião", description: "Tem certeza que deseja excluir?", confirmText: "Excluir", destructive: true }))) return;
        try {
            await apiFetch(`/api/feedback/one-on-one/${id}`, { method: "DELETE" });
            toast.success("Reunião excluída.");
            void loadData();
        } catch { toast.error("Falha ao excluir."); }
    }

    const SortIcon = ({ col }: { col: SortKey }) => (
        <ArrowUpDown className={`inline size-3 ml-1 ${sortKey === col ? "text-primary" : "text-muted-foreground/30"}`} />
    );

    return (
        <section className="space-y-3">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Feedback
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Reuniões 1:1</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Crie, acompanhe e finalize reuniões individuais com seus liderados</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled title="Em breve">
                        <Calendar className="size-4 mr-1" />Desvincular Agenda
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { void loadTemplates(); setTemplatesPickerOpen(true); }}>
                        <BookTemplate className="size-4 mr-1" />Do Template
                    </Button>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="size-4 mr-1" />Criar reunião 1:1
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1" style={{ minWidth: 200, maxWidth: 300 }}>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Colaborador</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input className="h-9 pl-8" placeholder="Buscar colaborador..." value={filterName} onChange={(e) => setFilterName(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" style={{ minWidth: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="atrasada">Atrasada</option>
                            <option value="agendada">Agendada</option>
                            <option value="finalizada">Finalizada</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" style={{ minWidth: 130 }} value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
                            <option value="">Todas</option>
                            <option value="sem-categoria">Sem Categoria</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Frequência</label>
                        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" style={{ minWidth: 130 }} value={filterFrequencia} onChange={(e) => setFilterFrequencia(e.target.value)}>
                            <option value="">Todas</option>
                            <option value="boa">Boa</option>
                            <option value="ruim">Ruim</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                                    Nome do Colaborador <SortIcon col="name" />
                                </TableHead>
                                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("last")}>
                                    Última Reunião <SortIcon col="last" />
                                </TableHead>
                                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("next")}>
                                    Próxima Reunião <SortIcon col="next" />
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            ) : processed.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Users className="size-8 opacity-30" />
                                            <div>Nenhuma reunião encontrada.</div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                processed.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-medium text-sm">{m.participantName || "—"}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(m.createdAtUtc)}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(m.scheduledAt)}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.status === "finalizada" ? "bg-emerald-100 text-emerald-700" :
                                                m.status === "atrasada" ? "bg-red-100 text-red-700" :
                                                    "bg-blue-100 text-blue-700"
                                                }`}>
                                                {m.status || "agendada"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                                                    <Pencil className="size-3.5" />
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => void handleDelete(m.id)}>
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Itens por página:</span>
                        <select className="h-8 rounded-md border border-input bg-background px-1 text-sm" style={{ width: 65 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                            {[5, 10, 15, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{page} de {totalPages || 1}</span>
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Em Breve ── */}
            {upcoming.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <h6 className="font-bold text-sm mb-3 flex items-center gap-1"><Clock className="size-4" /> Em Breve</h6>
                    <div className="space-y-2">
                        {upcoming.map((m) => (
                            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/20 bg-muted/20 p-3">
                                <div>
                                    <div className="font-medium text-sm">{m.participantName}</div>
                                    <div className="text-xs text-muted-foreground">{m.subject || "Sem assunto"}</div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                    <Calendar className="inline size-3 mr-1" />
                                    {fmtDate(m.scheduledAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Templates Picker (Entrega 1.2) ── */}
            <Dialog open={templatesPickerOpen} onOpenChange={setTemplatesPickerOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookTemplate className="size-5 text-primary" />
                            Escolha um Template de Pauta
                        </DialogTitle>
                        <DialogDescription>
                            Pautas pré-prontas por contexto (carreira, performance, projeto, etc.). Ao selecionar, o assunto e as anotações são pré-preenchidos com a pauta — você ainda pode editar antes de salvar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 max-h-[60vh] overflow-y-auto">
                        {templatesLoading ? (
                            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
                        ) : templates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">Nenhum template disponível.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {templates.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => applyTemplate(t)}
                                        className="text-left rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:border-primary hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2 gap-2">
                                            <h3 className="font-semibold text-sm">{t.nome}</h3>
                                            {t.isSystem && <Badge variant="secondary" className="text-[10px] shrink-0"><Sparkles className="size-2.5 mr-0.5" /> Padrão</Badge>}
                                        </div>
                                        {t.descricao && (
                                            <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{t.descricao}</p>
                                        )}
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                            <span>{t.totalItens} item{t.totalItens !== 1 ? "s" : ""}</span>
                                            {t.categoria && <Badge variant="outline" className="text-[10px]">{t.categoria}</Badge>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplatesPickerOpen(false)}>Cancelar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal Criar/Editar ── */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOpen(false)}>
                    <div className="rounded-xl border bg-card p-6 shadow-xl w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h5 className="font-bold flex items-center gap-2">
                                {editId ? "Editar reunião 1:1" : "Criar reunião 1:1"}
                                {formTemplateId && (
                                    <Badge variant="secondary" className="text-[10px]">
                                        <BookTemplate className="size-2.5 mr-0.5" /> Do template
                                    </Badge>
                                )}
                            </h5>
                            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                                <X className="size-4" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium block mb-1">Colaborador</label>
                                <Input placeholder="Nome do colaborador" value={formName} onChange={(e) => setFormName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Data da reunião</label>
                                <Input type="datetime-local" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Horário de término</label>
                                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Assunto / Categoria (opcional)</label>
                                <Input placeholder="Ex: Feedback trimestral" maxLength={200} value={formSubject} onChange={(e) => setFormSubject(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">Notas / Resumo</label>
                                <textarea
                                    className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    rows={4} maxLength={4000}
                                    value={formNotes} onChange={(e) => setFormNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button onClick={() => void handleSave()} disabled={saving}>
                                {saving ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
