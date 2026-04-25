"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  FileText, Users, Eye, CalendarDays, Download, Plus,
} from "lucide-react";
import { FuncionarioAutocomplete, type FuncionarioLookup } from "@/components/autocomplete/FuncionarioAutocomplete";
import { AGING_BUCKETS, type AgingBucket, matchesAgingBucket } from "@/features/shared/urgencia";

const ATIVAS = new Set(["0", "1", "4", "5"]); // Rascunho, Pendente, Ajustes, PendenteAprovacaoRh
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

/* ── types ── */

interface BeneficioGridRow {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoBeneficio: number;
  tipoAlteracao: number;
  createdAtUtc: string;
}

interface BeneficioDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoBeneficio: number;
  tipoAlteracao: number;
  descricao: string;
  incluirDependentes: boolean;
  observacaoAprovador: string | null;
  observacoes: string | null;
  createdAtUtc: string;
}

/* ── helpers ── */

const API = "/api/colaborador/solicitacoes-beneficio";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t || res.statusText}`); }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

const STATUS_CFG: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: "Rascunho",   color: "bg-zinc-400/15 text-zinc-600",       icon: FileText },
  1: { label: "Pendente",   color: "bg-amber-500/15 text-amber-700",     icon: Clock },
  2: { label: "Aprovada",   color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  3: { label: "Reprovada",  color: "bg-red-500/15 text-red-700",         icon: XCircle },
  4: { label: "Ajustes",    color: "bg-orange-500/15 text-orange-700",   icon: AlertTriangle },
  5: { label: "Cancelada",  color: "bg-zinc-500/15 text-zinc-500",       icon: XCircle },
  6: { label: "Aguarda RH", color: "bg-violet-500/15 text-violet-700",   icon: Users },
};

const TIPO_BENEFICIO: Record<number, string> = {
  0: "Vale Refeição", 1: "Vale Alimentação", 2: "Plano Saúde", 3: "Plano Odontológico",
  4: "Vale Transporte", 5: "Seguro de Vida", 6: "Aux. Creche", 7: "Gympass", 8: "Outro",
};

const TIPO_ALTERACAO: Record<number, string> = {
  0: "Inclusão", 1: "Exclusão", 2: "Alteração de Plano",
};

function StatusBadge({ status }: { status: number }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG[1];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      <Icon className="size-3" />{cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
}

/* ── component ── */

export default function BeneficiosScreen() {
  const { me } = useAuth();
  const isAdmin = (me?.roles ?? []).some((r: string) => ["admin", "administrador"].includes(r.toLowerCase()));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BeneficioGridRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [agingBucket, setAgingBucket] = useState<AgingBucket>("");

  const [detail, setDetail] = useState<BeneficioDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalObs, setApprovalObs] = useState("");

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectObs, setRejectObs] = useState("");
  const [changesTarget, setChangesTarget] = useState<string | null>(null);
  const [changesObs, setChangesObs] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [newFuncionario, setNewFuncionario] = useState<FuncionarioLookup | null>(null);
  const [newTipoBeneficio, setNewTipoBeneficio] = useState(0);
  const [newTipoAlteracao, setNewTipoAlteracao] = useState(0);
  const [newDescricao, setNewDescricao] = useState("");
  const [newIncluirDep, setNewIncluirDep] = useState(false);
  const [newObs, setNewObs] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchJson<BeneficioGridRow[]>(API);
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`))
      .finally(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const s = String(r.status);
      if (statusFilter === "ativas"    && !ATIVAS.has(s)) return false;
      if (statusFilter === "aprovadas" && s !== "2") return false;
      if (statusFilter === "reprovadas"&& s !== "3") return false;
      if (statusFilter === "canceladas"&& s !== "6") return false;
      if (dateFrom && r.createdAtUtc && new Date(r.createdAtUtc) < new Date(dateFrom)) return false;
      if (dateTo && r.createdAtUtc && new Date(r.createdAtUtc) > new Date(`${dateTo}T23:59:59`)) return false;
      if (!matchesAgingBucket(r.createdAtUtc, agingBucket)) return false;
      if (!term) return true;
      return (r.solicitanteNome ?? "").toLowerCase().includes(term);
    });
  }, [rows, q, statusFilter, dateFrom, dateTo, agingBucket]);

  const kpis = useMemo(() => ({
    total: rows.length,
    pendentes: rows.filter((r) => r.status === 1 || r.status === 6).length,
    aprovadas: rows.filter((r) => r.status === 2).length,
    reprovadas: rows.filter((r) => r.status === 3).length,
  }), [rows]);

  async function openDetail(row: BeneficioGridRow) {
    setDetailOpen(true); setDetailLoading(true); setApprovalObs("");
    try { setDetail(await fetchJson<BeneficioDetail>(`${API}/${row.id}`)); }
    catch { toast.error("Falha ao carregar detalhes."); setDetailOpen(false); }
    finally { setDetailLoading(false); }
  }

  async function doApproval(id: string, action: "approve" | "reject" | "request-changes", obs: string | null = null) {
    const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
    try {
      await fetchJson(`${API}/${id}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao: obs }),
      });
      toast.success(`Solicitação: ${labels[action]}!`);
      await load(); setDetailOpen(false);
    } catch (e) { toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`); }
  }

  const isPending = (s: number) => s === 1 || s === 6;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">Inclusão, exclusão e alteração de benefícios</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            apiFetch(`${API}/export`).then((r) => r.blob()).then((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "beneficios.csv"; a.click(); }).catch(() => toast.error("Falha ao exportar."));
          }}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nova solicitação</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        {/* Row 1: title + search */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Solicitações de benefícios</div>
            <div className="text-sm text-muted-foreground">{loading ? "Carregando…" : `${filtered.length} solicitação${filtered.length !== 1 ? "ões" : ""}`}</div>
          </div>
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar colaborador…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {/* Row 2: status chips */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {([
            { key: "ativas",     label: "Ativas",     count: rows.filter(r => ATIVAS.has(String(r.status))).length, cls: "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-700 data-[active=true]:border-amber-400/50" },
            { key: "aprovadas",  label: "Aprovadas",  count: rows.filter(r => r.status === 2).length,               cls: "data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-700 data-[active=true]:border-emerald-400/50" },
            { key: "reprovadas", label: "Reprovadas", count: rows.filter(r => r.status === 3).length,               cls: "data-[active=true]:bg-red-500/15 data-[active=true]:text-red-700 data-[active=true]:border-red-400/50" },
            { key: "canceladas", label: "Canceladas", count: rows.filter(r => r.status === 6).length,               cls: "data-[active=true]:bg-zinc-500/15 data-[active=true]:text-zinc-600 data-[active=true]:border-zinc-400/50" },
            { key: "all",        label: "Todas",      count: rows.length,                                           cls: "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border-primary/30" },
          ] as const).map(({ key, label, count, cls }) => (
            <button key={key} data-active={statusFilter === key} onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 ${cls}`}>
              {label}
              <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none opacity-80">{count}</span>
            </button>
          ))}
        </div>
        {/* Row 3: date range + aging */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" /><span>Criado em:</span>
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data inicial" />
          <span className="text-xs text-muted-foreground">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data final" />
          {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>}
          <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" /><span>Aging:</span>
          </div>
          {AGING_BUCKETS.map((b) => (
            <button key={b.value} type="button" onClick={() => setAgingBucket(prev => prev === b.value ? "" : b.value)} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ${agingBucket === b.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>{b.label}</button>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Benefício</TableHead>
              <TableHead>Alteração</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtered.length ? filtered.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold">{r.solicitanteNome || "—"}</TableCell>
                <TableCell className="text-sm">{TIPO_BENEFICIO[r.tipoBeneficio] ?? "—"}</TableCell>
                <TableCell className="text-sm">{TIPO_ALTERACAO[r.tipoAlteracao] ?? "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(r.createdAtUtc)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && isPending(r.status) && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => void doApproval(r.id, "approve")}>
                          <CheckCircle2 className="size-3 mr-1" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => setChangesTarget(r.id)}>
                          <AlertTriangle className="size-3 mr-1" />Ajustes
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => setRejectTarget(r.id)}>
                          <XCircle className="size-3 mr-1" />Reprovar
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Detalhes" onClick={() => void openDetail(r)}>
                      <Eye className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma solicitação encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes — Benefício</DialogTitle>
            <DialogDescription>Informações completas da solicitação.</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Colaborador",       detail.solicitanteNome ?? "—"],
                  ["Status",            <StatusBadge status={detail.status} />],
                  ["Benefício",         TIPO_BENEFICIO[detail.tipoBeneficio] ?? "—"],
                  ["Alteração",         TIPO_ALTERACAO[detail.tipoAlteracao] ?? "—"],
                  ["Inclui Dep.",       detail.incluirDependentes ? "Sim" : "Não"],
                  ["Criado em",         fmtDate(detail.createdAtUtc)],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div className="text-xs uppercase text-muted-foreground">{label}</div>
                    <div className="mt-0.5 font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Descrição</div>
                <div className="mt-1 rounded-md bg-muted/30 p-3 text-sm">{detail.descricao}</div>
              </div>
              {detail.observacoes && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Observações</div>
                  <div className="mt-1 rounded-md bg-muted/30 p-3 text-sm">{detail.observacoes}</div>
                </div>
              )}
              {detail.observacaoAprovador && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Obs. do Aprovador</div>
                  <div className="mt-1 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm">{detail.observacaoAprovador}</div>
                </div>
              )}
              {isAdmin && isPending(detail.status) && (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div className="text-sm font-semibold">Ações de aprovação</div>
                  <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                    rows={2} placeholder="Observação (opcional)…" value={approvalObs} onChange={(e) => setApprovalObs(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doApproval(detail.id, "approve", approvalObs || null)}>
                      <CheckCircle2 className="size-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50"
                      onClick={() => void doApproval(detail.id, "request-changes", approvalObs || null)}>
                      <AlertTriangle className="size-4" /> Ajustes
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => void doApproval(detail.id, "reject", approvalObs || null)}>
                      <XCircle className="size-4" /> Reprovar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectObs(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reprovar solicitação</DialogTitle><DialogDescription>Motivo da reprovação (opcional).</DialogDescription></DialogHeader>
          <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm" rows={3} placeholder="Observação…" value={rejectObs} onChange={(e) => setRejectObs(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectObs(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { await doApproval(rejectTarget!, "reject", rejectObs || null); setRejectTarget(null); setRejectObs(""); }}>Reprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Changes dialog */}
      <Dialog open={!!changesTarget} onOpenChange={(o) => { if (!o) { setChangesTarget(null); setChangesObs(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Solicitar ajustes</DialogTitle><DialogDescription>Descreva os ajustes necessários.</DialogDescription></DialogHeader>
          <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm" rows={3} placeholder="Observação…" value={changesObs} onChange={(e) => setChangesObs(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangesTarget(null); setChangesObs(""); }}>Cancelar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={async () => { await doApproval(changesTarget!, "request-changes", changesObs || null); setChangesTarget(null); setChangesObs(""); }}>Solicitar ajustes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New request dialog */}
      <Dialog open={newOpen} onOpenChange={(o) => { if (!o) { setNewOpen(false); setNewFuncionario(null); setNewTipoBeneficio(0); setNewTipoAlteracao(0); setNewDescricao(""); setNewIncluirDep(false); setNewObs(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova solicitação de benefício</DialogTitle>
            <DialogDescription>Preencha os dados para criar uma nova solicitação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Colaborador</label>
              <FuncionarioAutocomplete value={newFuncionario?.id ?? null} onSelect={setNewFuncionario} placeholder="Buscar colaborador…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Benefício</label>
                <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={newTipoBeneficio} onChange={(e) => setNewTipoBeneficio(Number(e.target.value))}>
                  {Object.entries(TIPO_BENEFICIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Tipo alteração</label>
                <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={newTipoAlteracao} onChange={(e) => setNewTipoAlteracao(Number(e.target.value))}>
                  {Object.entries(TIPO_ALTERACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Descrição *</label>
              <input className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Detalhes da solicitação…" value={newDescricao} onChange={(e) => setNewDescricao(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={newIncluirDep} onChange={(e) => setNewIncluirDep(e.target.checked)} className="rounded" />
              Incluir dependentes
            </label>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Observações</label>
              <textarea className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" rows={2} placeholder="Informações adicionais…" value={newObs} onChange={(e) => setNewObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button disabled={newSaving || !newDescricao} onClick={async () => {
              setNewSaving(true);
              try {
                await fetchJson(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: newFuncionario?.id ?? null, tipoBeneficio: newTipoBeneficio, tipoAlteracao: newTipoAlteracao, descricao: newDescricao, incluirDependentes: newIncluirDep, observacoes: newObs || null }) });
                toast.success("Solicitação criada!");
                setNewOpen(false);
                await load();
              } catch (e) { toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`); }
              finally { setNewSaving(false); }
            }}>
              {newSaving ? "Salvando…" : "Criar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
