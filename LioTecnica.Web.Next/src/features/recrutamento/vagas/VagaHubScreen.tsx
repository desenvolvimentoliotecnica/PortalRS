"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  PenSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import VagaFormModal from "./VagaFormModal";

const BASE = "/app";

type VagaData = Record<string, unknown>;

function pick(obj: VagaData | null, key: string, fallback = "—"): string {
  if (!obj) return fallback;
  const v = obj[key];
  if (v == null || v === "") return fallback;
  return String(v);
}

function pickNum(obj: VagaData | null, key: string, fallback = 0): number {
  if (!obj) return fallback;
  const v = obj[key];
  return typeof v === "number" ? v : fallback;
}

function fmtDate(iso: string): string {
  if (!iso || iso === "—") return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function fmtSalary(min: unknown, max: unknown): string {
  const a = typeof min === "number" ? min : 0;
  const b = typeof max === "number" ? max : 0;
  if (!a && !b) return "A combinar";
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (a && b) return `${fmt(a)} – ${fmt(b)}`;
  return fmt(a || b);
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-emerald-500/15 text-emerald-700" },
  rascunho: { label: "Rascunho", cls: "bg-amber-500/15 text-amber-700" },
  pausada: { label: "Pausada", cls: "bg-amber-500/15 text-amber-700" },
  fechada: { label: "Fechada", cls: "bg-zinc-500/15 text-zinc-700" },
  encerrada: { label: "Encerrada", cls: "bg-zinc-500/15 text-zinc-700" },
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function VagaHubScreen({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const isRecrutador = me?.isAdmin || (me?.roles ?? []).some((r) => r.toLowerCase().includes("recrutador"));

  const [loading, setLoading] = useState(true);
  const [vaga, setVaga] = useState<VagaData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!vagaId) return;
    try {
      setLoading(true);
      const [data, candData] = await Promise.all([
        fetchJson<VagaData>(`/api/vagas/${encodeURIComponent(vagaId)}`),
        fetchJson<{ totalCount?: number }>(`/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&pageSize=1`).catch(() => null),
      ]);
      setVaga(data);
      setCandidateCount(candData?.totalCount ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vaga.";
      console.error("[VagaHub] load error:", msg, "vagaId:", vagaId);
      toast.error(`Erro ao carregar vaga: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [vagaId]);

  useEffect(() => { void load(); }, [load]);

  const title = pick(vaga, "titulo", "Carregando...");
  const statusRaw = pick(vaga, "status", "Rascunho");
  const status = statusRaw.toLowerCase();
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.rascunho;
  const isRascunho = status === "rascunho";
  const requisitos = Array.isArray(vaga?.requisitos) ? (vaga.requisitos as unknown[]) : [];
  const etapas = Array.isArray(vaga?.etapas) ? (vaga.etapas as { nome: string; responsavel?: string; slaDias?: number }[]) : [];
  const tags = pick(vaga, "tagsKeywordsRaw", "");
  const areaName = pick(vaga, "areaName", "");
  const modalidadeStr = pick(vaga, "modalidade", "");
  const senioridadeStr = pick(vaga, "senioridade", "");
  const cidade = pick(vaga, "cidade", "");
  const uf = pick(vaga, "uf", "");
  const localStr = [cidade, uf].filter(v => v && v !== "—").join(", ") || "—";
  const tipoContratacao = pick(vaga, "tipoContratacao", "");
  const qtdVagas = pick(vaga, "quantidadeVagas", "1");
  const matchMin = pickNum(vaga, "matchMinimoPercentual", 60);
  const resumo = pick(vaga, "resumoPitch", "");
  const descPublica = pick(vaga, "descricaoPublica", "");
  const recrutador = pick(vaga, "recrutadorResponsavel", "");
  const gestor = pick(vaga, "gestorRequisitante", "");

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vagas")}><ArrowLeft className="size-4" /></Button>
          <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vagas")}><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>{statusMeta.label}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
              {pick(vaga, "codigo") !== "—" && <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">{pick(vaga, "codigo")}</span>}
              <span>{areaName || "—"}</span>
              <span className="text-border">|</span>
              <span>{modalidadeStr || "—"}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
          {isRecrutador && (
            <Button size="sm" onClick={() => setEditOpen(true)}><PenSquare className="size-4 mr-1" /> Editar</Button>
          )}
        </div>
      </div>

      {/* ── Banner rascunho ── */}
      {isRascunho && (
        <NextStepBanner
          variant="warning"
          title="Vaga em rascunho"
          description="Configure os dados, requisitos e etapas de seleção. Depois mude o status para 'Aberta' para publicar no portal."
          actions={[{ label: "Editar Vaga", onClick: () => setEditOpen(true) }]}
        />
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="candidatos">
            Candidatos {candidateCount > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{candidateCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="matching">
            <Sparkles className="size-3.5 mr-1" /> Matching IA
          </TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        {/* ── Tab: Resumo ── */}
        <TabsContent value="resumo" className="space-y-4 mt-4">
          {/* Responsáveis */}
          {(recrutador || gestor) && (
            <div className="flex flex-wrap gap-6 text-sm">
              {recrutador && recrutador !== "—" && (
                <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Recrutador</div><div className="font-medium">{recrutador}</div></div>
              )}
              {gestor && gestor !== "—" && (
                <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Gestor requisitante</div><div className="font-medium">{gestor}</div></div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Modalidade</div><div className="font-medium">{modalidadeStr || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Senioridade</div><div className="font-medium">{senioridadeStr || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Local</div><div className="font-medium">{localStr}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faixa salarial</div><div className="font-medium">{fmtSalary(vaga?.salarioMinimo, vaga?.salarioMaximo)}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Contratação</div><div className="font-medium">{tipoContratacao || "—"}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Vagas</div><div className="font-medium">{qtdVagas}</div></div>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Início: {fmtDate(pick(vaga, "dataInicio", ""))}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Encerramento: {fmtDate(pick(vaga, "dataEncerramento", ""))}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Match min: <strong className="text-foreground">{matchMin}%</strong></span>
          </div>

          {/* Resumo */}
          {resumo && resumo !== "—" && (
            <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Resumo</div>
              <div className="text-sm leading-relaxed whitespace-pre-line">{resumo}</div>
            </div>
          )}

          {/* Descrição Pública */}
          {descPublica && descPublica !== "—" && (
            <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Descrição pública</div>
              <div className="text-sm leading-relaxed whitespace-pre-line">{descPublica}</div>
            </div>
          )}

          {/* Tags */}
          {tags !== "—" && (
            <div className="flex flex-wrap gap-1.5">
              {tags.split(/[;,]/).filter(Boolean).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">{tag.trim()}</Badge>
              ))}
            </div>
          )}

          {/* Requisitos */}
          {requisitos.length > 0 && (
            <div className="rounded-lg border border-border/40 p-4">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Requisitos ({requisitos.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {requisitos.map((r, i) => {
                  const req = r as Record<string, unknown>;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={`size-2 rounded-full shrink-0 ${Boolean(req.obrigatorio) ? "bg-red-500" : "bg-blue-400"}`} />
                      <span className="truncate">{String(req.nome ?? req.keyword ?? "")}</span>
                      {Boolean(req.obrigatorio) && <span className="text-[10px] text-red-600 font-medium shrink-0">obrig.</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Checklist da vaga</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "Dados básicos", done: title !== "—" && title !== "Carregando..." },
                { label: "Requisitos", done: requisitos.length > 0 },
                { label: "Etapas de seleção", done: etapas.length > 0 },
                { label: "Publicação", done: status === "aberta" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <CheckCircle2 className={`size-3.5 ${item.done ? "text-emerald-600" : "text-muted-foreground/30"}`} />
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Candidatos ── */}
        <TabsContent value="candidatos" className="mt-4">
          <div className="rounded-xl border border-border/40 bg-card p-6 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">{candidateCount} candidato(s) nesta vaga</p>
            <p className="text-xs text-muted-foreground mt-1">Visualize e gerencie os candidatos na tela dedicada.</p>
            <Button size="sm" className="mt-3" asChild>
              <Link href={`/candidatos?vagaId=${encodeURIComponent(vagaId)}`}>Ver Candidatos</Link>
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab: Matching IA ── */}
        <TabsContent value="matching" className="mt-4">
          <div className="rounded-xl border border-border/40 bg-card p-6 text-center">
            <Sparkles className="mx-auto size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">Matching IA</p>
            <p className="text-xs text-muted-foreground mt-1">Ranqueie candidatos automaticamente com base nos requisitos desta vaga.</p>
            <Button size="sm" className="mt-3" asChild>
              <Link href={`/matching?vagaId=${encodeURIComponent(vagaId)}`}>Abrir Matching</Link>
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab: Configuração ── */}
        <TabsContent value="config" className="space-y-4 mt-4">
          {/* Etapas */}
          <div className="rounded-lg border border-border/40 p-4">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-3">Etapas de seleção ({etapas.length})</div>
            {etapas.length > 0 ? (
              <div className="space-y-2">
                {etapas.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/20 px-3 py-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                    <span className="font-medium">{e.nome}</span>
                    {e.responsavel && <span className="text-xs text-muted-foreground">({e.responsavel})</span>}
                    {e.slaDias != null && <span className="text-xs text-muted-foreground ml-auto">{e.slaDias}d SLA</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Nenhuma etapa configurada.</p>
                {isRecrutador && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => { setEditOpen(true); }}>
                    Configurar Etapas
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2">
            {isRecrutador && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <PenSquare className="size-3.5 mr-1" /> Editar Vaga
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/triagem?vagaId=${encodeURIComponent(vagaId)}`}>Ir para Pipeline</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/gestao/processo-seletivo?vagaId=${encodeURIComponent(vagaId)}`}>Processo Seletivo</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Edit Modal ── */}
      {editOpen && (
        <VagaFormModal
          open={editOpen}
          editId={vagaId}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); void load(); }}
        />
      )}
    </section>
  );
}
