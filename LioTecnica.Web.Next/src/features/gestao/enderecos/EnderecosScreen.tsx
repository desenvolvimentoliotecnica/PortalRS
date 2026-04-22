"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  FileText, Users, Eye,
} from "lucide-react";
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

interface EnderecoGridRow {
  id: string;
  status: number;
  solicitanteNome: string | null;
  cep: string;
  cidade: string;
  uf: string;
  createdAtUtc: string;
}

interface EnderecoDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  cep: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string;
  uf: string;
  observacaoAprovador: string | null;
  observacoes: string | null;
  createdAtUtc: string;
}

/* ── helpers ── */

const API = "/api/colaborador/solicitacoes-endereco";

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

export default function EnderecosScreen() {
  const { me } = useAuth();
  const isAdmin = (me?.roles ?? []).some((r: string) => ["admin", "administrador"].includes(r.toLowerCase()));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnderecoGridRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [detail, setDetail] = useState<EnderecoDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalObs, setApprovalObs] = useState("");

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectObs, setRejectObs] = useState("");
  const [changesTarget, setChangesTarget] = useState<string | null>(null);
  const [changesObs, setChangesObs] = useState("");

  const load = useCallback(async () => {
    const data = await fetchJson<EnderecoGridRow[]>(API);
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
      if (statusFilter !== "all" && String(r.status) !== statusFilter) return false;
      if (!term) return true;
      return (r.solicitanteNome ?? "").toLowerCase().includes(term) ||
        r.cidade.toLowerCase().includes(term) ||
        r.uf.toLowerCase().includes(term);
    });
  }, [rows, q, statusFilter]);

  const kpis = useMemo(() => ({
    total: rows.length,
    pendentes: rows.filter((r) => r.status === 1 || r.status === 6).length,
    aprovadas: rows.filter((r) => r.status === 2).length,
    reprovadas: rows.filter((r) => r.status === 3).length,
  }), [rows]);

  async function openDetail(row: EnderecoGridRow) {
    setDetailOpen(true); setDetailLoading(true); setApprovalObs("");
    try { setDetail(await fetchJson<EnderecoDetail>(`${API}/${row.id}`)); }
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
        <div>
          <h4 className="text-lg font-bold">Solicitações de Endereço</h4>
          <p className="text-muted-foreground text-sm">Alterações de endereço residencial</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total",      value: kpis.total,     color: "text-primary" },
          { label: "Pendentes",  value: kpis.pendentes,  color: "text-amber-600" },
          { label: "Aprovadas",  value: kpis.aprovadas,  color: "text-emerald-600" },
          { label: "Reprovadas", value: kpis.reprovadas, color: "text-red-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Solicitações de endereço</div>
            <div className="text-sm text-muted-foreground">{loading ? "Carregando…" : `${filtered.length} solicitações`}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar colaborador ou cidade…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos status</option>
              <option value="1">Pendente</option>
              <option value="2">Aprovada</option>
              <option value="3">Reprovada</option>
              <option value="4">Ajustes</option>
              <option value="6">Aguarda RH</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Cidade / UF</TableHead>
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
                <TableCell className="text-sm font-mono">{r.cep}</TableCell>
                <TableCell className="text-sm">{r.cidade} / {r.uf}</TableCell>
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
            <DialogTitle>Detalhes — Endereço</DialogTitle>
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
                  ["Colaborador", detail.solicitanteNome ?? "—"],
                  ["Status",      <StatusBadge status={detail.status} />],
                  ["CEP",         detail.cep],
                  ["Logradouro",  `${detail.logradouro}${detail.numero ? `, ${detail.numero}` : ""}`],
                  ["Bairro",      detail.bairro ?? "—"],
                  ["Complemento", detail.complemento ?? "—"],
                  ["Cidade",      detail.cidade],
                  ["UF",          detail.uf],
                  ["Criado em",   fmtDate(detail.createdAtUtc)],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div className="text-xs uppercase text-muted-foreground">{label}</div>
                    <div className="mt-0.5 font-medium">{value}</div>
                  </div>
                ))}
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
    </section>
  );
}
