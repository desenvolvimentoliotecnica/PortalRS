"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MapPin,
  PenSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import StepperProgress from "@/components/feedback/StepperProgress";
import type { StepperStep } from "@/components/feedback/StepperProgress";
import VagaFormModal from "./VagaFormModal";
import CandidatosMatchTab from "./CandidatosMatchTab";

const BASE = "/app";
const VAGA_HUB_FONT_135X_STYLE = `
  .vaga-hub-font-135x {
    font-size: 1.35rem;
    line-height: 1.85rem;
  }

  .vaga-hub-font-135x .text-\\[10px\\] {
    font-size: 13.5px !important;
    line-height: 1.15rem !important;
  }

  .vaga-hub-font-135x .text-\\[11px\\] {
    font-size: 14.85px !important;
    line-height: 1.2rem !important;
  }

  .vaga-hub-font-135x .text-\\[0\\.82rem\\] {
    font-size: 1.107rem !important;
    line-height: 1.45rem !important;
  }

  .vaga-hub-font-135x .text-xs {
    font-size: 1.0125rem !important;
    line-height: 1.45rem !important;
  }

  .vaga-hub-font-135x .text-sm {
    font-size: 1.18125rem !important;
    line-height: 1.55rem !important;
  }

  .vaga-hub-font-135x .text-base {
    font-size: 1.35rem !important;
    line-height: 1.85rem !important;
  }

  .vaga-hub-font-135x .text-lg {
    font-size: 1.51875rem !important;
    line-height: 2rem !important;
  }

  .vaga-hub-font-135x .text-xl {
    font-size: 1.6875rem !important;
    line-height: 2.2rem !important;
  }

  .vaga-hub-font-135x input:not([type="checkbox"]),
  .vaga-hub-font-135x select,
  .vaga-hub-font-135x textarea,
  .vaga-hub-font-135x button {
    font-size: 1.18125rem !important;
    line-height: 1.55rem !important;
  }

  .vaga-hub-font-135x input:not([type="checkbox"]),
  .vaga-hub-font-135x select,
  .vaga-hub-font-135x button {
    min-height: 3rem;
  }

  .vaga-hub-font-135x textarea {
    min-height: 5rem;
  }
`;

type VagaData = Record<string, unknown>;

interface CandidateRow {
  id: string;
  nome: string;
  email: string | null;
  fone: string | null;
  celular: string | null;
  status: string;
  createdAtUtc: string;
  candidaturaId?: string | null;
  etapaMacro?: string | number | null;
}

type KanbanCandidaturaLite = {
  id: string;
  candidatoId: string;
  etapaMacro: string | number;
};

type KanbanCandidaturasLiteResponse = {
  colunas?: Array<{ itens?: KanbanCandidaturaLite[] }>;
};

type PropostaVagaHubResponse = {
  id: string;
  status: string | number;
  accessToken: string | null;
};

type WorkflowRhHubItem = {
  id: string;
  status?: number;
  statusLabel?: string;
  totalEtapas?: number;
  etapasConcluidas?: number;
  etapas?: Array<{ label: string; status: number; ordem: number }>;
};

type WorkflowRhHubResponse = WorkflowRhHubItem[] | { items?: WorkflowRhHubItem[] };

function normalizeEtapaMacro(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return ["Aplicada", "EmTriagem", "Entrevista", "Teste", "Proposta", "Contratado", "Recusado", "Desistiu", "EntrevistaTecnica", "ReprovadoRh", "ReprovadoGestor"][value] ?? "Aplicada";
  }
  return value ?? "Aplicada";
}

function resolvePropostaStatus(value: string | number): string {
  if (typeof value === "number") {
    return ["Rascunho", "Enviada", "Visualizada", "Aceita", "Recusada", "Expirada", "Cancelada"][value] ?? "Rascunho";
  }
  return value;
}

async function parseApiErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) return `HTTP ${res.status}`;
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const message = json.message ?? json.detail ?? json.title;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    /* mantém retorno em texto abaixo */
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

function isCandidateReadyForApproval(candidate: CandidateRow): boolean {
  return normalizeEtapaMacro(candidate.etapaMacro) === "Proposta";
}

interface AdmissaoDialogState {
  open: boolean;
  candidate: CandidateRow | null;
  modo: "manual" | "link";
  canal: "whatsapp" | "email" | "whatsapp+email";
  tipoContratacao: "CLT" | "PJ";
  cpf: string;
  working: boolean;
  linkGerado: string | null;
  emailEnviado: boolean;
  whatsappEnviado: boolean;
}

const ADMISSAO_DOCUMENTOS: Record<AdmissaoDialogState["tipoContratacao"], string[]> = {
  CLT: [
    "RG",
    "CPF",
    "Comprovante de Residência",
    "CTPS",
    "Título de Eleitor",
    "PIS/PASEP",
    "Certidão",
    "Escolaridade",
    "Dados Bancários",
  ],
  PJ: [
    "CNPJ",
    "Contrato Social/MEI",
    "RG e CPF do sócio",
    "Conta Bancária PJ",
    "Certidões Negativas",
  ],
};

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

function pickOptional(obj: VagaData | null, key: string): string {
  if (!obj) return "";
  const v = obj[key];
  if (v == null || v === "") return "";
  return String(v).trim();
}

/** Mesmo formato do autocomplete: `01.11.023.002 : GESTAO SISTEMAS` */
function formatCentroCustoLabel(vaga: VagaData | null): string {
  const code = pickOptional(vaga, "centroCustoCode");
  const desc =
    pickOptional(vaga, "centroCustoDescription") ||
    pickOptional(vaga, "centroCustoName") ||
    pickOptional(vaga, "areaName");
  if (code && desc) return `${code} : ${desc}`;
  return desc || code;
}

/** Cidade/UF da vaga (API já faz fallback para empresa do centro de custo). */
function formatVagaLocal(vaga: VagaData | null): string {
  const parts = [pickOptional(vaga, "cidade"), pickOptional(vaga, "uf")].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
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

function initials(value: string): string {
  const parts = value
    .replace("—", "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "—";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function displayValue(value: string): string {
  return value && value !== "—" ? value : "—";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-emerald-500/15 text-emerald-700" },
  rascunho: { label: "Rascunho", cls: "bg-amber-500/15 text-amber-700" },
  pausada: { label: "Pausada", cls: "bg-amber-500/15 text-amber-700" },
  fechada: { label: "Fechada", cls: "bg-zinc-500/15 text-zinc-700" },
  encerrada: { label: "Encerrada", cls: "bg-zinc-500/15 text-zinc-700" },
  cancelada: { label: "Cancelada", cls: "bg-red-500/15 text-red-700" },
  preenchida: { label: "Preenchida", cls: "bg-blue-500/15 text-blue-700" },
};

const MOTIVO_LABEL: Record<string, string> = {
  desligamento: "Desligado",
  promocao: "Promoção",
  transferencia: "Transferência",
  manual: "Manual",
};

interface SolicitacaoLinked {
  id: string;
  titulo: string;
  status: number;
  urgencia: number;
  solicitanteNome: string | null;
  aprovadorNome: string | null;
  qtdPosicoes: number;
  etapaPendenteLabel: string | null;
  etapaPendenteCom: string | null;
  createdAtUtc: string;
}

const SOL_STATUS_MAP: Record<number, { label: string; cls: string; icon: React.ElementType }> = {
  0: { label: "Rascunho",            cls: "bg-zinc-100 text-zinc-600",    icon: FileText      },
  1: { label: "Pend. Aprovação",     cls: "bg-amber-100 text-amber-700",  icon: Clock         },
  2: { label: "Aprovada",            cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  3: { label: "Reprovada",           cls: "bg-red-100 text-red-700",      icon: XCircle       },
  4: { label: "Ajustes Necessários", cls: "bg-orange-100 text-orange-700",icon: AlertTriangle },
  5: { label: "Pend. Aprovação RH",  cls: "bg-purple-100 text-purple-700",icon: Clock         },
  6: { label: "Cancelada",           cls: "bg-zinc-100 text-zinc-500",    icon: XCircle       },
  7: { label: "Em Integração",       cls: "bg-blue-100 text-blue-700",    icon: RefreshCw     },
  8: { label: "Concluída",           cls: "bg-teal-100 text-teal-700",    icon: CheckCircle2  },
  9: { label: "Aguarda Decisão RH",  cls: "bg-amber-100 text-amber-700",  icon: AlertTriangle },
  10:{ label: "Pend. Aumento HC",    cls: "bg-violet-100 text-violet-700",icon: AlertTriangle },
};

const SOL_URGENCIA_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: "Baixa",   cls: "bg-sky-100 text-sky-700"    },
  1: { label: "Média",   cls: "bg-amber-100 text-amber-700"},
  2: { label: "Alta",    cls: "bg-orange-100 text-orange-700"},
  3: { label: "Crítica", cls: "bg-red-100 text-red-700"    },
};

function parseSolStatus(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (!isNaN(n)) return n;
    const map: Record<string, number> = {
      rascunho: 0, pendenteaprovacao: 1, aprovada: 2, reprovada: 3,
      ajustesnecessarios: 4, pendenteaprovacaorh: 5, cancelada: 6,
      emintegracao: 7, concluida: 8, aguardandodecisaorh: 9, pendenteaprovacaoaumentohc: 10,
    };
    return map[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? 0;
  }
  return 0;
}

interface DesligamentoDetail {
  id: string;
  status: number;
  funcionarioNome: string | null;
  solicitanteNome: string | null;
  dataDesligamento: string;
  tipoDesligamento: number;
  motivoDesligamento: string;
  substituirPosicao: boolean;
  observacoes: string | null;
  createdAtUtc: string;
  etapas: Array<{
    ordem: number;
    label: string;
    aprovadorNome: string | null;
    roleFilaNome: string | null;
    status: string;
    dataUtc: string | null;
    observacao: string | null;
  }>;
}

const DESL_STATUS_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: "Rascunho",            cls: "bg-zinc-100 text-zinc-600"        },
  1: { label: "Pend. Aprovação",     cls: "bg-amber-100 text-amber-700"      },
  2: { label: "Aprovada",            cls: "bg-emerald-100 text-emerald-700"  },
  3: { label: "Reprovada",           cls: "bg-red-100 text-red-700"          },
  4: { label: "Ajustes Necessários", cls: "bg-orange-100 text-orange-700"    },
  5: { label: "Cancelada",           cls: "bg-zinc-100 text-zinc-500"        },
  6: { label: "Pend. Aprovação RH",  cls: "bg-purple-100 text-purple-700"   },
  7: { label: "Em Integração",       cls: "bg-blue-100 text-blue-700"        },
  8: { label: "Concluída",           cls: "bg-teal-100 text-teal-700"        },
};

const TIPO_DESL_MAP: Record<number, string> = {
  0: "Sem Justa Causa",
  1: "Com Justa Causa",
  2: "Pedido de Demissão",
  3: "Acordo",
  4: "Aposentadoria",
};

function parseDeslStatus(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (!isNaN(n)) return n;
    const map: Record<string, number> = {
      rascunho: 0, pendenteaprovacao: 1, aprovada: 2, reprovada: 3,
      ajustesnecessarios: 4, cancelada: 5, pendenteaprovacaorh: 6,
      emintegracao: 7, concluida: 8,
    };
    return map[raw.toLowerCase().replace(/[^a-z]/g, "")] ?? 0;
  }
  return 0;
}

type OcupacaoItem = {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  dataEntrada: string;
  dataSaida?: string | null;
  motivoSaida?: string | null;
  desligamentoSolicitacaoId?: string | null;
};

interface HistoricoEvent {
  acao: string;
  quemFez: string | null;
  dataHora: string;
  entidadeId: string | null;
  entidadeTipo: string | null;
}

interface FuncDetail {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  headcount: number;
  jobPositionName?: string;
  jobPositionCode?: string;
  notes?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  gestorDiretoNome?: string;
  nivelHierarquicoNome?: string;
  unidadeLotacaoDescricao?: string;
  unidadeLotacaoCode?: string;
  centroCustoDescricao?: string;
  centroCustoCode?: string;
  cdnFuncionario?: string;
  cdnEmpresa?: string;
  cdnEstab?: string;
}

interface FuncHistoryItem {
  id: string;
  occurredAt: string;
  state: string;
  userName: string | null;
  changedColumns: string | null;
}

function funcStatusBadge(s: string | null | undefined) {
  const st = (s ?? "").toLowerCase();
  if (st === "ativo" || st === "active")
    return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Ativo</span>;
  return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">Inativo</span>;
}

function fmtDateTime(iso: string | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function stateLabel(state: string | null | undefined) {
  const s = (state ?? "").toLowerCase();
  if (s === "added") return "Criado";
  if (s === "modified") return "Alterado";
  if (s === "deleted") return "Removido";
  return state || "—";
}

function HistoricoTimeline({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<HistoricoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vagaId) return;
    let active = true;
    const loadHistorico = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/historico`);
        if (res.ok && active) setEvents(await res.json() as HistoricoEvent[]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadHistorico();
    return () => { active = false; };
  }, [vagaId]);

  if (loading) return <div className="text-center py-6 text-sm text-muted-foreground">Carregando histórico...</div>;
  if (events.length === 0) return <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento registrado.</div>;

  return (
    <div className="relative border-l-2 border-border/40 pl-6 space-y-4">
      {events.map((ev, i) => (
        <div key={i} className="relative">
          <div className={`absolute -left-[31px] top-1 size-4 rounded-full border-2 ${
            ev.acao.includes("reprovada") || ev.acao.includes("cancelada") ? "bg-red-500/20 border-red-500" :
            ev.acao.includes("aprovada") ? "bg-emerald-500/20 border-emerald-500" :
            ev.acao.includes("criada") ? "bg-primary/20 border-primary" :
            ev.acao.includes("Candidato") ? "bg-violet-500/20 border-violet-500" :
            ev.acao.includes("Admissão") ? "bg-amber-500/20 border-amber-500" :
            "bg-blue-500/20 border-blue-500"
          }`} />
          <div className="text-xs text-muted-foreground">{new Date(ev.dataHora).toLocaleString("pt-BR")}</div>
          <div className="text-sm font-medium">
            {ev.entidadeTipo === "candidato" && ev.entidadeId ? (
              <button type="button" className="text-primary hover:underline" onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vagaId)}`)}>
                {ev.acao}
              </button>
            ) : ev.acao}
          </div>
          {ev.quemFez && <div className="text-xs text-muted-foreground">por {ev.quemFez}</div>}
        </div>
      ))}
    </div>
  );
}

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

interface CandidateDocRow {
  id: string;
  tipo: string;
  nomeArquivo: string | null;
  descricao: string | null;
  tamanhoBytes: number | null;
  url: string | null;
}

function parseCandidateDocumentos(raw: unknown): CandidateDocRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CandidateDocRow[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    const id = r?.id != null ? String(r.id) : "";
    if (!id) continue;
    const tb = r?.tamanhoBytes;
    const tamanhoBytes = typeof tb === "number" && Number.isFinite(tb) ? tb : null;
    out.push({
      id,
      tipo: r?.tipo != null ? String(r.tipo) : "",
      nomeArquivo: r?.nomeArquivo != null ? String(r.nomeArquivo) : null,
      descricao: r?.descricao != null ? String(r.descricao) : null,
      tamanhoBytes,
      url: r?.url != null ? String(r.url) : null,
    });
  }
  return out;
}

function formatDocTipoLabel(tipo: string): string {
  const t = tipo.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t === "curriculo" || t === "0") return "Currículo";
  if (t === "documento" || t === "1") return "Documento";
  if (t === "outros" || t === "2") return "Outros";
  return tipo || "Documento";
}

function formatFileSizeShort(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function isPdfDocumentName(nomeArquivo: string | null | undefined): boolean {
  return (nomeArquivo ?? "").toLowerCase().endsWith(".pdf");
}

function resolveHubCandidateDocumentPath(doc: CandidateDocRow, candidatoIdFallback: string | null): string | null {
  let rawPath = doc.url?.trim();
  if (!rawPath || rawPath === "#") {
    if (candidatoIdFallback && doc.id) {
      rawPath = `/api/candidatos/${candidatoIdFallback}/documentos/${doc.id}/download`;
    }
  }
  return rawPath && rawPath !== "#" ? rawPath : null;
}

async function downloadHubCandidateDocument(doc: CandidateDocRow, candidatoIdFallback: string | null): Promise<void> {
  const rawPath = resolveHubCandidateDocumentPath(doc, candidatoIdFallback);
  if (!rawPath) {
    toast.error("Link de download indisponível.");
    return;
  }
  if (/^https?:\/\//i.test(rawPath)) {
    window.open(rawPath, "_blank", "noopener,noreferrer");
    return;
  }
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  try {
    // apiFetch define Accept: application/json por omissão — incompatível com arquivo binário / alguns proxies.
    const res = await apiFetch(
      path,
      {
        method: "GET",
        headers: { Accept: "*/*" },
      },
      120_000,
    );
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      let detail = (msg ?? "").trim().slice(0, 300);
      try {
        const j = JSON.parse(msg) as { message?: string; detail?: string; title?: string };
        detail = (j.message || j.detail || j.title || detail).trim();
      } catch {
        /* texto plano ou HTML */
      }
      throw new Error(detail ? `${res.status} — ${detail}` : `${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = (doc.nomeArquivo ?? "documento").replace(/[/\\]/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    toast.error(`Não foi possível baixar o arquivo. ${m}`);
  }
}

export default function VagaHubScreen({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const { me } = useAuth();

  const [loading, setLoading] = useState(true);
  const [vaga, setVaga] = useState<VagaData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [activeTab, setActiveTab] = useState("resumo");

  useEffect(() => {
    if (activeTab === "matching") setActiveTab("candidatos");
  }, [activeTab]);
  const [editOpen, setEditOpen] = useState(false);
  const [admissaoDialog, setAdmissaoDialog] = useState<AdmissaoDialogState>({
    open: false, candidate: null, modo: "manual", canal: "whatsapp+email", tipoContratacao: "CLT", cpf: "", working: false, linkGerado: null, emailEnviado: false, whatsappEnviado: false,
  });
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newCandForm, setNewCandForm] = useState({ nome: "", email: "", fone: "", celular: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
  const [newCandWorking, setNewCandWorking] = useState(false);
  const [newCandDocTipo, setNewCandDocTipo] = useState("curriculo");
  const [newCandDocDesc, setNewCandDocDesc] = useState("");
  const [newCandDocFile, setNewCandDocFile] = useState<File | null>(null);
  const [newCandPendingDocs, setNewCandPendingDocs] = useState<Array<{ id: string; tipo: string; desc: string; file: File; name: string; size: number }>>([]);
  /** Documentos já persistidos (ex.: CV do portal) — preenchido ao abrir edição via GET /api/candidatos/{id}. */
  const [existingCandDocs, setExistingCandDocs] = useState<CandidateDocRow[]>([]);
  const [previewingCandidateDocId, setPreviewingCandidateDocId] = useState<string | null>(null);
  const [candidatePdfPreview, setCandidatePdfPreview] = useState<{ url: string; nomeArquivo: string } | null>(null);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [candidateFormMode, setCandidateFormMode] = useState<"create" | "edit" | "view">("create");
  const candidateFormReadOnly = candidateFormMode === "view";

  useEffect(() => {
    return () => {
      if (candidatePdfPreview?.url) URL.revokeObjectURL(candidatePdfPreview.url);
    };
  }, [candidatePdfPreview?.url]);

  async function previewHubCandidateDocument(doc: CandidateDocRow, candidatoIdFallback: string | null): Promise<void> {
    if (!isPdfDocumentName(doc.nomeArquivo)) {
      toast.error("A visualização no navegador está disponível apenas para PDFs.");
      return;
    }
    const rawPath = resolveHubCandidateDocumentPath(doc, candidatoIdFallback);
    if (!rawPath) {
      toast.error("Link de visualização indisponível.");
      return;
    }
    if (/^https?:\/\//i.test(rawPath)) {
      window.open(rawPath, "_blank", "noopener,noreferrer");
      return;
    }

    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    setPreviewingCandidateDocId(doc.id);
    try {
      const res = await apiFetch(
        path,
        { method: "GET", headers: { Accept: "application/pdf,*/*" } },
        120_000,
      );
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res));
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
      setCandidatePdfPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: objectUrl, nomeArquivo: doc.nomeArquivo ?? "documento.pdf" };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao visualizar o documento.");
    } finally {
      setPreviewingCandidateDocId(null);
    }
  }

  function closeCandidatePdfPreview() {
    setCandidatePdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  const [solicitacoesLinked, setSolicitacoesLinked] = useState<SolicitacaoLinked[]>([]);
  const [cancelSolWorking, setCancelSolWorking] = useState<string | null>(null);
  const [desligamentoDialog, setDesligamentoDialog] = useState<{ open: boolean; loading: boolean; data: DesligamentoDetail | null }>({ open: false, loading: false, data: null });

  // ── Publicações (Rodadas) ──
  interface RodadaItem {
    id: string;
    numero: number;
    descricao: string | null;
    status: string;
    totalCandidatos: number;
    createdAtUtc: string;
    dataInicio: string | null;
    dataEncerramento: string | null;
  }
  const [rodadas, setRodadas] = useState<RodadaItem[]>([]);
  const [rodadasLoading, setRodadasLoading] = useState(false);

  async function cancelSolicitacao(id: string) {
    if (!confirm("Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.")) return;
    setCancelSolWorking(id);
    try {
      await apiFetch(`/api/solicitacoes-vaga/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      toast.success("Solicitação cancelada com sucesso.");
      void load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao cancelar solicitação.";
      toast.error(msg);
    } finally {
      setCancelSolWorking(null);
    }
  }

  async function openDesligamentoDialog(id: string) {
    setDesligamentoDialog({ open: true, loading: true, data: null });
    try {
      const raw = await fetchJson<Record<string, unknown>>(`/api/solicitacoes-desligamento/${encodeURIComponent(id)}`);
      const etapas = Array.isArray(raw.etapas) ? (raw.etapas as Record<string, unknown>[]).map((e) => ({
        ordem: typeof e.ordem === "number" ? e.ordem : 0,
        label: String(e.label ?? ""),
        aprovadorNome: e.aprovadorNome ? String(e.aprovadorNome) : null,
        roleFilaNome: e.roleFilaNome ? String(e.roleFilaNome) : null,
        status: String(e.status ?? ""),
        dataUtc: e.dataUtc ? String(e.dataUtc) : null,
        observacao: e.observacao ? String(e.observacao) : null,
      })) : [];
      setDesligamentoDialog({
        open: true,
        loading: false,
        data: {
          id: String(raw.id ?? ""),
          status: parseDeslStatus(raw.status),
          funcionarioNome: raw.funcionarioNome ? String(raw.funcionarioNome) : null,
          solicitanteNome: raw.solicitanteNome ? String(raw.solicitanteNome) : null,
          dataDesligamento: String(raw.dataDesligamento ?? ""),
          tipoDesligamento: typeof raw.tipoDesligamento === "number" ? raw.tipoDesligamento : 0,
          motivoDesligamento: String(raw.motivoDesligamento ?? ""),
          substituirPosicao: raw.substituirPosicao === true,
          observacoes: raw.observacoes ? String(raw.observacoes) : null,
          createdAtUtc: String(raw.createdAtUtc ?? ""),
          etapas,
        },
      });
    } catch {
      toast.error("Erro ao carregar solicitação de desligamento");
      setDesligamentoDialog({ open: false, loading: false, data: null });
    }
  }

  // Workflow RH data
  const [workflowData, setWorkflowData] = useState<{
    id: string;
    status: number;
    statusLabel: string;
    totalEtapas: number;
    etapasConcluidas: number;
    etapas: Array<{ label: string; status: number; ordem: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    if (!vagaId) return;
    try {
      setLoading(true);
      const [data, candListData, wfData, kanbanData] = await Promise.all([
        fetchJson<VagaData>(`/api/vagas/${encodeURIComponent(vagaId)}`),
        fetchJson<{ totalCount?: number; items?: CandidateRow[] }>(`/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&pageSize=100`).catch(() => null),
        fetchJson<WorkflowRhHubResponse>(`/api/workflow-rh?vagaId=${encodeURIComponent(vagaId)}&pageSize=1`).catch(() => null),
        fetchJson<KanbanCandidaturasLiteResponse>(`/api/candidaturas/kanban?vagaId=${encodeURIComponent(vagaId)}`).catch(() => null),
      ]);
      setVaga(data);

      // Busca a solicitação diretamente pelo ID que a vaga já conhece
      const solicitacaoId = data.solicitacaoPendenteDecisaoId as string | null | undefined;
      if (solicitacaoId) {
        const solData = await fetchJson<Record<string, unknown>>(`/api/solicitacoes-vaga/${encodeURIComponent(solicitacaoId)}`).catch(() => null);
        if (solData) {
          setSolicitacoesLinked([{
            id: String(solData.id ?? ""),
            titulo: String(solData.titulo ?? ""),
            status: parseSolStatus(solData.status),
            urgencia: typeof solData.urgencia === "number" ? solData.urgencia : 0,
            solicitanteNome: solData.solicitanteNome ? String(solData.solicitanteNome) : null,
            aprovadorNome: solData.aprovadorNome ? String(solData.aprovadorNome) : null,
            qtdPosicoes: typeof solData.qtdPosicoes === "number" ? solData.qtdPosicoes : 1,
            etapaPendenteLabel: null,
            etapaPendenteCom: null,
            createdAtUtc: String(solData.createdAtUtc ?? ""),
          }]);
        }
      } else {
        setSolicitacoesLinked([]);
      }
      const candidaturaByCandidateId = new Map<string, KanbanCandidaturaLite>();
      for (const coluna of kanbanData?.colunas ?? []) {
        for (const item of coluna.itens ?? []) {
          candidaturaByCandidateId.set(item.candidatoId, item);
        }
      }
      const items = (candListData?.items ?? []).map((candidate) => {
        const candidatura = candidaturaByCandidateId.get(candidate.id);
        return candidatura
          ? { ...candidate, candidaturaId: candidatura.id, etapaMacro: candidatura.etapaMacro }
          : candidate;
      });
      setCandidates(items);
      setCandidateCount(candListData?.totalCount ?? items.length);
      // Workflow RH associated with this vaga
      const wfItems = Array.isArray(wfData) ? wfData : wfData?.items ?? [];
      if (wfItems.length > 0) {
        const wf = wfItems[0];
        setWorkflowData({
          id: wf.id,
          status: wf.status ?? 0,
          statusLabel: wf.statusLabel ?? "",
          totalEtapas: wf.totalEtapas ?? 0,
          etapasConcluidas: wf.etapasConcluidas ?? 0,
          etapas: Array.isArray(wf.etapas) ? wf.etapas : [],
        });
      } else {
        setWorkflowData(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar vaga.";
      console.error("[VagaHub] load error:", msg, "vagaId:", vagaId);
      toast.error(`Erro ao carregar vaga: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [vagaId]);

  async function iniciarAdmissao(canalOverride?: "whatsapp" | "email" | "whatsapp+email") {
    const { candidate, tipoContratacao, cpf } = admissaoDialog;
    const canal = canalOverride ?? admissaoDialog.canal;
    const modo = canalOverride ? "link" : admissaoDialog.modo;
    if (!candidate) return;
    setAdmissaoDialog((d) => ({ ...d, working: true }));
    try {
      const res = await fetchJson<{ id: string }>("/api/pre-admissao/iniciar-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidatoId: candidate.id, tipoContratacao }),
      });
      if (modo === "manual") {
        setAdmissaoDialog((d) => ({ ...d, open: false, working: false }));
        router.push(`/admissao/nova?id=${encodeURIComponent(res.id)}`);
      } else {
        const enviarEmail = canal === "email" || canal === "whatsapp+email";
        const enviarWhatsapp = canal === "whatsapp" || canal === "whatsapp+email";
        const linkRes = await fetchJson<{ publicUrl?: string; emailEnviado?: boolean; whatsappEnviado?: boolean }>(`/api/pre-admissao/${encodeURIComponent(res.id)}/gerar-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), enviarEmail, enviarWhatsapp }),
        });
        setAdmissaoDialog((d) => ({ ...d, working: false, linkGerado: linkRes.publicUrl ?? null, emailEnviado: linkRes.emailEnviado ?? false, whatsappEnviado: linkRes.whatsappEnviado ?? false }));
        void load();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(`Falha ao iniciar admissão: ${msg}`);
      setAdmissaoDialog((d) => ({ ...d, working: false }));
    }
  }

  const [publishing, setPublishing] = useState(false);
  async function publicarVaga() {
    setPublishing(true);
    try {
      const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Aberta" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      toast.success("Vaga publicada com sucesso!");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao publicar vaga.");
    } finally {
      setPublishing(false);
    }
  }

  async function reenviarPropostaCandidato(candidatoId: string) {
    try {
      const params = new URLSearchParams({ vagaId, candidatoId });
      const propostas = await fetchJson<PropostaVagaHubResponse[]>(`/api/propostas-vaga?${params.toString()}`);
      const proposta = propostas.find((p) => {
        const statusProposta = resolvePropostaStatus(p.status);
        return statusProposta === "Enviada" || statusProposta === "Visualizada";
      });

      if (!proposta) {
        toast.error("Nenhuma proposta enviada ou visualizada foi encontrada para este candidato nesta vaga.");
        return;
      }

      const res = await apiFetch(`/api/propostas-vaga/${encodeURIComponent(proposta.id)}/reenviar-email`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiErrorMessage(res));

      toast.success("E-mail da proposta reenviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar proposta.");
    }
  }

  async function openEditCandidate(candidateId: string, mode: "edit" | "view" = "edit") {
    try {
      const docQ = vagaId ? `?vagaId=${encodeURIComponent(vagaId)}` : "";
      const data = await fetchJson<Record<string, unknown>>(`/api/candidatos/${encodeURIComponent(candidateId)}${docQ}`);
      setNewCandForm({
        nome: String(data.nome ?? ""),
        email: String(data.email ?? ""),
        fone: String(data.fone ?? ""),
        celular: String(data.celular ?? ""),
        cidade: String(data.cidade ?? ""),
        uf: String(data.uf ?? "SP"),
        fonte: String(data.fonte ?? "Email"),
        pretensaoSalarial: data.pretensaoSalarial != null ? String(data.pretensaoSalarial) : "",
        trabalhandoAtualmente: data.trabalhandoAtualmente === true ? "sim" : data.trabalhandoAtualmente === false ? "nao" : "",
        linkedinUrl: String(data.linkedinUrl ?? ""),
        obs: String(data.obs ?? ""),
      });
      setExistingCandDocs(parseCandidateDocumentos(data.documentos));
      setNewCandPendingDocs([]);
      setNewCandDocDesc("");
      setNewCandDocFile(null);
      setEditingCandidateId(candidateId);
      setCandidateFormMode(mode);
      setNewCandidateOpen(true);
    } catch {
      toast.error("Erro ao carregar candidato");
    }
  }

  function closeCandidateForm() {
    setNewCandidateOpen(false);
    setEditingCandidateId(null);
    setCandidateFormMode("create");
    setNewCandForm({ nome: "", email: "", fone: "", celular: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
    setNewCandPendingDocs([]);
    setExistingCandDocs([]);
  }

  useEffect(() => { void load(); }, [load]);

  const [ocupacoes, setOcupacoes] = useState<OcupacaoItem[]>([]);
  const [ocupacoesLoading, setOcupacoesLoading] = useState(false);

  const [funcDetailId, setFuncDetailId] = useState<string | null>(null);
  const [funcDetailData, setFuncDetailData] = useState<FuncDetail | null>(null);
  const [funcDetailLoading, setFuncDetailLoading] = useState(false);
  const [funcDetailTab, setFuncDetailTab] = useState<"dados" | "historico">("dados");
  const [funcHistory, setFuncHistory] = useState<FuncHistoryItem[]>([]);
  const [funcHistoryLoading, setFuncHistoryLoading] = useState(false);

  async function openFuncDetail(id: string) {
    setFuncDetailId(id);
    setFuncDetailData(null);
    setFuncDetailLoading(true);
    setFuncDetailTab("dados");
    setFuncHistory([]);
    setFuncHistoryLoading(true);
    try {
      const [d, histPayload] = await Promise.all([
        fetchJson<Record<string, unknown>>(`/api/funcionarios/${id}`),
        fetchJson<Record<string, unknown>>(`/api/audit/entity-changes?${new URLSearchParams({ entityName: "Funcionario", entityId: id, page: "1", pageSize: "50" })}`).catch(() => null),
      ]);
      setFuncDetailData({
        id: String(d.id ?? id),
        name: String(d.name ?? ""),
        email: d.email ? String(d.email) : undefined,
        phone: d.phone ? String(d.phone) : undefined,
        status: String(d.status ?? ""),
        headcount: typeof d.headcount === "number" ? d.headcount : 0,
        jobPositionName: d.jobPositionName ? String(d.jobPositionName) : undefined,
        jobPositionCode: d.jobPositionCode ? String(d.jobPositionCode) : undefined,
        notes: d.notes ? String(d.notes) : undefined,
        createdAtUtc: String(d.createdAtUtc ?? ""),
        updatedAtUtc: String(d.updatedAtUtc ?? ""),
        gestorDiretoNome: d.gestorDiretoNome ? String(d.gestorDiretoNome) : undefined,
        nivelHierarquicoNome: d.nivelHierarquicoNome ? String(d.nivelHierarquicoNome) : undefined,
        unidadeLotacaoDescricao: d.unidadeLotacaoDescricao ? String(d.unidadeLotacaoDescricao) : undefined,
        unidadeLotacaoCode: d.unidadeLotacaoCode ? String(d.unidadeLotacaoCode) : undefined,
        centroCustoDescricao: d.centroCustoDescricao ? String(d.centroCustoDescricao) : undefined,
        centroCustoCode: d.centroCustoCode ? String(d.centroCustoCode) : undefined,
        cdnFuncionario: d.cdnFuncionario ? String(d.cdnFuncionario) : undefined,
        cdnEmpresa: d.cdnEmpresa ? String(d.cdnEmpresa) : undefined,
        cdnEstab: d.cdnEstab ? String(d.cdnEstab) : undefined,
      });
      const list = Array.isArray(histPayload?.items) ? (histPayload.items as FuncHistoryItem[]) : [];
      setFuncHistory(list);
    } catch {
      toast.error("Falha ao carregar dados do funcionário.");
      setFuncDetailId(null);
    } finally {
      setFuncDetailLoading(false);
      setFuncHistoryLoading(false);
    }
  }

  function closeFuncDetail() {
    setFuncDetailId(null);
    setFuncDetailData(null);
    setFuncHistory([]);
    setFuncDetailTab("dados");
  }

  useEffect(() => {
    if (!vagaId) return;
    setOcupacoesLoading(true);
    fetchJson<unknown[]>(`/api/vagas/${encodeURIComponent(vagaId)}/ocupacoes`)
      .then((rows) => {
        setOcupacoes((Array.isArray(rows) ? rows : []).map((r) => {
          const rec = r as Record<string, unknown>;
          return {
            id: String(rec.id ?? ""),
            funcionarioId: String(rec.funcionarioId ?? ""),
            funcionarioNome: String(rec.funcionarioNome ?? rec.nome ?? "—"),
            dataEntrada: String(rec.dataEntrada ?? ""),
            dataSaida: rec.dataSaida ? String(rec.dataSaida) : null,
            motivoSaida: rec.motivoSaida ? String(rec.motivoSaida) : null,
            desligamentoSolicitacaoId: rec.desligamentoSolicitacaoId ? String(rec.desligamentoSolicitacaoId) : null,
          };
        }));
      })
      .catch(() => {})
      .finally(() => setOcupacoesLoading(false));
  }, [vagaId]);

  const title = pick(vaga, "titulo", "Carregando...");
  const statusRaw = pick(vaga, "status", "Rascunho");
  const status = statusRaw.toLowerCase();
  const statusMeta = STATUS_MAP[status] ?? STATUS_MAP.rascunho;
  const isRascunho = status === "rascunho";
  const isCancelada = status === "cancelada";
  const isEncerrada = status === "encerrada";
  const isReadOnly = isCancelada || isEncerrada;
  const requisitos = Array.isArray(vaga?.requisitos) ? (vaga.requisitos as unknown[]) : [];
  const etapas = Array.isArray(vaga?.etapas) ? (vaga.etapas as { nome: string; responsavel?: string; slaDias?: number }[]) : [];
  const tags = pick(vaga, "tagsKeywordsRaw", "");
  const centroCustoLabel = formatCentroCustoLabel(vaga);
  const modalidadeStr = pick(vaga, "modalidade", "");
  const senioridadeStr = pick(vaga, "senioridade", "");
  const localStr = formatVagaLocal(vaga);
  const tipoContratacao = pick(vaga, "tipoContratacao", "");
  const qtdVagas = pick(vaga, "quantidadeVagas", "1");
  const matchMin = pickNum(vaga, "matchMinimoPercentual", 60);
  const resumo = pick(vaga, "resumoPitch", "");
  const descPublica = pick(vaga, "descricaoPublica", "");
  const recrutador = pick(vaga, "recrutadorResponsavel", "");
  const gestor = pick(vaga, "gestorRequisitante", "");
  const headcountAutorizado = pickNum(vaga, "headcountAutorizado", 1);
  const headcountOcupado = pickNum(vaga, "headcountOcupado", 0);
  const headcountProvisorio = pickNum(vaga, "headcountProvisorio", 0);
  const headcountPendente = pickNum(vaga, "headcountPendente", 0);
  const alertaHCProvVencido = vaga?.alertaHCProvVencido === true;
  const isEstrutural = vaga?.isEstrutural === true;
  const hasDescricaoCargo = Boolean(
    pickOptional(vaga, "descricaoCargoId") || pickOptional(vaga, "descricaoCargo")
  );

  const publishBlockReason: string | null = (() => {
    if (headcountPendente > 0) return "Existe aumento de headcount pendente de aprovação — acompanhe em Aprovações antes de publicar";
    if (!hasDescricaoCargo) return "Vincule uma Descrição de Cargo (DNALIO) antes de publicar a vaga";
    if (status === "aberta") return "A vaga já está publicada";
    if (status === "preenchida") return "A vaga está preenchida";
    if (status === "cancelada") return "A vaga está cancelada";
    if (status === "encerrada") return "A vaga está encerrada";
    return null; // rascunho sem bloqueio → pode publicar
  })();

  if (loading) {
    return (
      <section className="vaga-hub-font-135x space-y-4">
        <style>{VAGA_HUB_FONT_135X_STYLE}</style>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/vagas")}><ArrowLeft className="size-4" /></Button>
          <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </section>
    );
  }

  return (
    <section className="vaga-hub-font-135x space-y-4">
      <style>{VAGA_HUB_FONT_135X_STYLE}</style>
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
              {centroCustoLabel ? (
                <span className="truncate max-w-[min(100%,28rem)]" title={centroCustoLabel}>
                  {(() => {
                    const ccCode = pickOptional(vaga, "centroCustoCode");
                    const ccDesc =
                      pickOptional(vaga, "centroCustoDescription") ||
                      pickOptional(vaga, "centroCustoName") ||
                      pickOptional(vaga, "areaName");
                    if (ccCode && ccDesc) {
                      return (
                        <>
                          <span className="font-mono text-xs">{ccCode}</span>
                          <span> : </span>
                          <span className="font-medium text-foreground/90">{ccDesc}</span>
                        </>
                      );
                    }
                    return <span className="font-medium text-foreground/90">{centroCustoLabel}</span>;
                  })()}
                </span>
              ) : null}
              {centroCustoLabel ? <span className="text-border">|</span> : null}
              <span>{modalidadeStr || "—"}</span>
              {(() => {
                const dt = (vaga?.dataAbertura as string | undefined) ?? (vaga?.createdAtUtc as string | undefined);
                return dt ? (
                  <>
                    <span className="text-border">|</span>
                    <span>Aberta em {new Date(dt).toLocaleDateString("pt-BR")}</span>
                  </>
                ) : null;
              })()}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
          {!isReadOnly && (
            <Button size="sm" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}`)}><PenSquare className="size-4 mr-1" /> {isRascunho ? "Preencher Dados" : "Editar"}</Button>
          )}
          <Button
            size="sm"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={publishing || publishBlockReason !== null}
            title={publishBlockReason ?? undefined}
            onClick={() => void publicarVaga()}
          >
            <Globe className="size-4 mr-1" /> {publishing ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>

      {/* ── Indicador cancelada/encerrada ── */}
      {isCancelada && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Esta vaga foi <b>cancelada</b> e não pode mais ser editada.
        </div>
      )}
      {isEncerrada && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/20 dark:text-zinc-400">
          Esta vaga está <b>encerrada</b> e não pode mais ser editada.
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === "publicacoes" && rodadas.length === 0 && !rodadasLoading) {
          setRodadasLoading(true);
          fetchJson<RodadaItem[]>(`/api/vagas/${encodeURIComponent(vagaId)}/projetos`)
            .then((data) => setRodadas(Array.isArray(data) ? data : []))
            .catch(() => toast.error("Falha ao carregar publicações"))
            .finally(() => setRodadasLoading(false));
        }
      }}>
        <TabsList className="!grid h-auto w-full grid-cols-7 rounded-xl border border-border/40 bg-card p-1 shadow-sm">
          <TabsTrigger value="resumo" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2 data-[state=active]:text-[#105290]">
            <FileText className="size-4 shrink-0" />
            <span className="truncate">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="candidatos" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
            <Sparkles className="size-3.5 shrink-0" />
            <span className="truncate">Candidatos & Match</span>
            {candidateCount > 0 && (
              <span className="shrink-0 text-[10px] bg-primary/15 text-primary rounded-full px-1.5 leading-none py-0.5">
                {candidateCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="publicacoes" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
            <Send className="size-4 shrink-0" />
            <span className="truncate">Publicações</span>
            {rodadas.length > 0 && <span className="ml-1 shrink-0 text-[10px] bg-emerald-500/15 text-emerald-700 rounded-full px-1.5">{rodadas.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="config" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
            <Target className="size-4 shrink-0" />
            <span className="truncate">Etapas</span>
          </TabsTrigger>
          {workflowData && (
            <TabsTrigger value="workflow" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
              <span className="truncate">Workflow</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="historico" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
            <Clock className="size-4 shrink-0" />
            <span className="truncate">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="posicao" className="inline-flex min-w-0 items-center justify-center whitespace-nowrap gap-2 px-3 py-2">
            <Users className="size-4 shrink-0" />
            <span className="truncate">Posição</span>
            {isEstrutural && <span className="ml-1 shrink-0 text-[10px] bg-blue-500/15 text-blue-700 rounded-full px-1.5">{headcountOcupado}/{headcountAutorizado}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Resumo ── */}
        <TabsContent value="resumo" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="size-4 text-[#105290]" />
              Checklist da vaga
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: "Dados básicos", statusLabel: "Concluído", done: title !== "—" && title !== "Carregando..." },
                { label: "Requisitos", statusLabel: requisitos.length > 0 ? "Concluído" : "Pendente", done: requisitos.length > 0 },
                { label: "Etapas de seleção", statusLabel: etapas.length > 0 ? "Concluído" : "Pendente", done: etapas.length > 0 },
                { label: "Publicação", statusLabel: status === "aberta" ? "Concluído" : "Pendente", done: status === "aberta" },
              ].map((item, index, arr) => (
                <div key={item.label} className="relative flex flex-col items-center text-center">
                  {index < arr.length - 1 && (
                    <div className={`absolute left-1/2 top-4 hidden h-px w-full border-t md:block ${item.done ? "border-emerald-300" : "border-dashed border-border"}`} />
                  )}
                  <div className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 bg-card text-sm font-semibold ${item.done ? "border-emerald-500 text-emerald-600" : "border-border text-muted-foreground"}`}>
                    {item.done ? <CheckCircle2 className="size-5" /> : index + 1}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">{item.label}</div>
                  <div className={`text-[11px] ${item.done ? "text-emerald-600" : "text-muted-foreground"}`}>{item.statusLabel}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { label: "Recrutador", name: displayValue(recrutador), role: "Analista de Recrutamento & Seleção" },
              { label: "Gestor requisitante", name: displayValue(gestor), role: pick(vaga, "gestorRequisitanteCargo", "Gerente de P&D") },
            ].map((person) => (
              <div key={person.label} className="flex items-center justify-between rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-semibold text-[#105290]">
                    {initials(person.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{person.label}</div>
                    <div className="truncate text-sm font-semibold text-foreground">{person.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{person.role}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" title={`Enviar mensagem para ${person.name}`}>
                  <Mail className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Modalidade", value: displayValue(modalidadeStr), icon: Briefcase },
              { label: "Senioridade", value: displayValue(senioridadeStr), icon: Target },
              { label: "Local", value: localStr, icon: MapPin },
              { label: "Faixa salarial", value: fmtSalary(vaga?.salarioMinimo, vaga?.salarioMaximo), icon: Banknote },
              { label: "Contratação", value: displayValue(tipoContratacao), icon: FileText },
              { label: "Vagas", value: qtdVagas, icon: Users },
            ].map((item) => (
              <div key={item.label} className="flex min-h-[92px] items-center gap-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#105290]">
                  <item.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                  <div className="truncate text-base font-semibold text-foreground">{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-border/40 bg-slate-50/80 px-4 py-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#105290]" /> Início: <strong className="font-medium text-foreground">{fmtDate(pick(vaga, "dataInicio", ""))}</strong></span>
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-[#105290]" /> Encerramento: <strong className="font-medium text-foreground">{fmtDate(pick(vaga, "dataEncerramento", ""))}</strong></span>
            <span className="inline-flex items-center gap-2"><Target className="size-4 text-[#105290]" /> Match mín: <strong className="font-semibold text-[#105290]">{matchMin}%</strong></span>
          </div>

          {(resumo && resumo !== "—") || (descPublica && descPublica !== "—") || tags !== "—" || requisitos.length > 0 ? (
            <div className="space-y-3">
              {resumo && resumo !== "—" && (
                <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Resumo</div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{resumo}</div>
                </div>
              )}

              {descPublica && descPublica !== "—" && (
                <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Descrição pública</div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{descPublica}</div>
                </div>
              )}

              {tags !== "—" && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.split(/[;,]/).filter(Boolean).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">{tag.trim()}</Badge>
                  ))}
                </div>
              )}

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
            </div>
          ) : null}
        </TabsContent>

        {/* ── Tab: Candidatos & Match ── */}
        <TabsContent value="candidatos">
          <CandidatosMatchTab
            vagaId={vagaId}
            candidates={candidates}
            temDescricaoCargo={Boolean(pick(vaga, "descricaoCargoId", "")) || Boolean(pick(vaga, "descricaoCargo", ""))}
            matchMinimoPercentual={matchMin}
            isReadOnly={isReadOnly}
            onAddCandidate={() => {
              setEditingCandidateId(null);
              setCandidateFormMode("create");
              setExistingCandDocs([]);
              setNewCandForm({ nome: "", email: "", fone: "", celular: "", cidade: "", uf: "SP", fonte: "Email", pretensaoSalarial: "", trabalhandoAtualmente: "", linkedinUrl: "", obs: "" });
              setNewCandPendingDocs([]);
              setNewCandidateOpen(true);
            }}
            onViewCandidate={(id) => void openEditCandidate(id, "view")}
            onEditCandidate={(id) => void openEditCandidate(id)}
            onReenviarProposta={(c) => void reenviarPropostaCandidato(c.id)}
            onApproveCandidate={(c) => {
              if (!isCandidateReadyForApproval(c)) {
                toast.error("A aprovação do candidato só fica disponível após a candidatura chegar na etapa Proposta.");
                return;
              }
              const semEmail = !c.email?.trim();
              const semCelular = !c.celular?.trim();
              if (semEmail || semCelular) {
                const campos = [semEmail && "e-mail", semCelular && "celular"].filter(Boolean).join(" e ");
                toast.error(`Preencha o ${campos} do candidato antes de aprovar.`, { duration: 5000 });
                void openEditCandidate(c.id);
                return;
              }
              const vagaTipo = pick(vaga, "tipoContratacao").toUpperCase();
              const tipo = (vagaTipo === "CLT" || vagaTipo === "PJ") ? vagaTipo as "CLT" | "PJ" : "CLT";
              setAdmissaoDialog({ open: true, candidate: c, modo: "manual", canal: "whatsapp+email", tipoContratacao: tipo, cpf: "", working: false, linkGerado: null, emailEnviado: false, whatsappEnviado: false });
            }}
            onAcompanharAdmissao={async (candidatoId) => {
              const res = await apiFetch(`/api/pre-admissao/iniciar-manual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidatoId }),
              });
              if (res.ok) {
                const data = (await res.json()) as { id: string };
                router.push(`/admissao/tracking/${encodeURIComponent(data.id)}`);
              } else {
                const body = await res.json().catch(() => null) as { message?: string } | null;
                toast.error(body?.message ?? "Erro ao abrir admissão");
              }
            }}
          />
        </TabsContent>

        {/* ── Tab: Publicações (Rodadas) ── */}
        <TabsContent value="publicacoes" className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Histórico de publicações</div>
          {rodadasLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando publicações...</div>
          ) : rodadas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma publicação registrada para esta vaga.</div>
          ) : (
            <div className="space-y-2">
              {rodadas
                .slice()
                .sort((a, b) => b.numero - a.numero)
                .map((r) => {
                  const isActive = r.status?.toLowerCase() === "ativo";
                  return (
                    <div key={r.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${isActive ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10" : "border-border/40 bg-muted/10"}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold ${isActive ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                            {r.numero}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{r.descricao ?? `Publicação ${r.numero}`}</span>
                            {isActive && (
                              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                Ativa
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            {r.dataInicio && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="size-3" />
                                Início: {fmtDate(r.dataInicio)}
                              </span>
                            )}
                            {r.dataEncerramento && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                Encerrada: {fmtDate(r.dataEncerramento)}
                              </span>
                            )}
                            {!r.dataEncerramento && r.dataInicio && (
                              <span className="text-emerald-600 dark:text-emerald-400">Em andamento</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${r.totalCandidatos} candidato(s) inscrito(s) nesta rodada`}>
                          <Users className="size-3.5" />
                          {r.totalCandidatos}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(r.createdAtUtc)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Configuração ── */}
        <TabsContent value="config" className="space-y-4 mt-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
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
                <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
                  As etapas definem o roteiro da seleção desta vaga, como triagem, entrevistas, proposta e admissão, com responsável e SLA por fase.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push(`/vagas/editar?id=${encodeURIComponent(vagaId)}&tab=processo`)}>
                  Configurar Etapas
                </Button>
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pipeline?vagaId=${encodeURIComponent(vagaId)}`}>Ir para Pipeline</Link>
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab: Workflow RH ── */}
        {workflowData && (
          <TabsContent value="workflow" className="mt-4 space-y-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Status do Workflow</div>
                <div className="text-sm font-medium mt-0.5">
                  {workflowData.status === 0 ? "Não Iniciado" : workflowData.status === 1 ? "Em Andamento" : workflowData.status === 2 ? "Concluído" : "Cancelado"}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {workflowData.etapasConcluidas}/{workflowData.totalEtapas} etapas concluídas
              </div>
            </div>
            {workflowData.etapas.length > 0 ? (
              <StepperProgress
                orientation="vertical"
                steps={workflowData.etapas
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((etapa) => ({
                    label: etapa.label,
                    status:
                      etapa.status === 2
                        ? ("done" as const)
                        : etapa.status === 1
                          ? ("current" as const)
                          : ("pending" as const),
                  }))}
              />
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <p>Workflow criado mas sem etapas detalhadas disponíveis.</p>
                <p className="text-xs mt-1">Progresso: {workflowData.etapasConcluidas}/{workflowData.totalEtapas}</p>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Tab: Histórico ── */}
        <TabsContent value="historico" className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <HistoricoTimeline vagaId={vagaId} />
        </TabsContent>

        {/* ── Tab: Posição ── */}
        <TabsContent value="posicao" className="mt-4 space-y-4 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          {/* Headcount summary */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Autorizado</span>
              <span className="font-bold text-lg leading-none">{headcountAutorizado}</span>
            </div>
            {headcountProvisorio > 0 && (
              <>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Provisório</span>
                  <span className={`font-bold text-lg leading-none ${alertaHCProvVencido ? "text-red-600" : "text-amber-600"}`}>
                    +{headcountProvisorio}
                  </span>
                  {alertaHCProvVencido && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">Vencido</span>
                  )}
                </div>
              </>
            )}
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Ocupado</span>
              <span className="font-bold text-lg leading-none">{headcountOcupado}</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Em aberto</span>
              {(() => {
                const limite = headcountAutorizado + headcountProvisorio;
                const aberto = Math.max(0, limite - headcountOcupado);
                return aberto > 0
                  ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">{aberto} aberto{aberto > 1 ? "s" : ""}</span>
                  : <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">Completo</span>;
              })()}
            </div>
          </div>

          {/* HC pending decision alert */}
          {headcountPendente > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-900/20">
              <div className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-300">
                <AlertTriangle className="size-4 shrink-0" />
                <div>
                  <p>
                    <b>+{headcountPendente} headcount</b> aguarda aprovação do aumento de HC.
                  </p>
                  <p className="mt-0.5 text-xs text-violet-700 dark:text-violet-300/80">
                    A decisão de tipo de headcount já foi registrada na solicitação. Agora a vaga só pode ser publicada depois da aprovação do fluxo de aumento.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300"
                onClick={() => router.push(`/gestao/aprovacoes?tab=contratacao&q=${encodeURIComponent(title)}`)}
              >
                Ver aprovações
              </Button>
            </div>
          )}

          {/* Occupancy history table */}
          <div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Histórico de Ocupação</div>
            {ocupacoesLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-muted" />)}
              </div>
            ) : ocupacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ocupação registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Funcionário</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entrada</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saída</th>
                      <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status / Motivo</th>
                      <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {ocupacoes.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{o.funcionarioNome}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataEntrada ? fmtDate(o.dataEntrada) : "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataSaida ? fmtDate(o.dataSaida) : "—"}</td>
                        <td className="px-4 py-2.5">
                          {!o.dataSaida ? (
                            o.desligamentoSolicitacaoId ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">
                                  Em Desligamento
                                </span>
                                <button
                                  onClick={() => void openDesligamentoDialog(o.desligamentoSolicitacaoId!)}
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline font-medium"
                                  title="Ver solicitação de desligamento"
                                >
                                  <FileText className="size-3" /> Ver sol.
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">Ativo</span>
                            )
                          ) : (o.motivoSaida ?? "").toLowerCase() === "desligamento" ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">Desligado</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                              {MOTIVO_LABEL[(o.motivoSaida ?? "").toLowerCase()] ?? o.motivoSaida ?? "Histórico"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {o.funcionarioId && (
                            <button
                              onClick={() => void openFuncDetail(o.funcionarioId)}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                              title="Ver detalhes do funcionário"
                            >
                              <ExternalLink className="size-3" /> Ver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Solicitação vinculada a este HC */}
          {solicitacoesLinked.length > 0 && (
            <div>
              <div className="border-t border-border/30 mb-4" />
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Nova Vaga Solicitada</div>
              <div className="space-y-2">
                {solicitacoesLinked.map((sol) => {
                  const stMeta = SOL_STATUS_MAP[sol.status] ?? SOL_STATUS_MAP[0];
                  const StIcon = stMeta.icon;
                  const urgMeta = SOL_URGENCIA_MAP[sol.urgencia] ?? SOL_URGENCIA_MAP[0];
                  return (
                    <div key={sol.id} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{sol.titulo}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${stMeta.cls}`}>
                              <StIcon className="size-3" />{stMeta.label}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgMeta.cls}`}>
                              {urgMeta.label}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {sol.solicitanteNome && <span>Solicitante: <span className="font-medium text-foreground">{sol.solicitanteNome}</span></span>}
                            {sol.aprovadorNome && <span>Aprovador: <span className="font-medium text-foreground">{sol.aprovadorNome}</span></span>}
                            <span>{sol.qtdPosicoes} posição(ões)</span>
                            <span>Criada em {fmtDate(sol.createdAtUtc)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {![0, 2, 6, 8].includes(sol.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={cancelSolWorking === sol.id}
                              onClick={() => void cancelSolicitacao(sol.id)}
                            >
                              {cancelSolWorking === sol.id ? "Cancelando…" : "Cancelar"}
                            </Button>
                          )}
                          <Link
                            href="/gestao/painel-solicitacoes"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" /> Ver solicitação
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New Candidate — modal customizado idêntico ao CandidatosScreen ── */}
      {newCandidateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={closeCandidateForm}>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm w-full max-w-6xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  {candidateFormReadOnly ? "Visualizar candidato" : editingCandidateId ? "Editar candidato" : "Novo candidato"}
                </p>
                <div className="text-lg font-extrabold">{candidateFormReadOnly ? "Dados do candidato" : "Cadastro"}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {candidateFormReadOnly && editingCandidateId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void reenviarPropostaCandidato(editingCandidateId)}
                  >
                    <Send className="size-3.5" />
                    Reenviar proposta
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={closeCandidateForm}>Fechar</Button>
              </div>
            </div>
            <div className="mt-4 space-y-4">
            {/* Vaga (travada) */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <label className="text-[10px] font-semibold text-blue-700 uppercase tracking-widest mb-1 block">Vaga</label>
              <div className="text-sm font-medium">{title}</div>
            </div>

            {/* Dados do Candidato */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Dados do Candidato</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Nome *</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.nome} onChange={(e) => setNewCandForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-6">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Email *</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" type="email" value={newCandForm.email} onChange={(e) => setNewCandForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Telefone</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.fone} onChange={(e) => setNewCandForm(f => ({ ...f, fone: e.target.value }))} placeholder="(11) 99999-0000" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Celular *</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.celular} onChange={(e) => setNewCandForm(f => ({ ...f, celular: e.target.value }))} placeholder="(11) 99999-0000" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Cidade</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.cidade} onChange={(e) => setNewCandForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">UF</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" maxLength={2} value={newCandForm.uf} onChange={(e) => setNewCandForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="SP" readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Fonte</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.fonte} onChange={(e) => setNewCandForm(f => ({ ...f, fonte: e.target.value }))} disabled={candidateFormReadOnly}>
                    {["Email","Site","Indicacao","LinkedIn","Pasta"].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Informações Profissionais */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Informações Profissionais</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Pretensão salarial (R$)</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" type="number" min={0} step={100} placeholder="Ex: 5000" value={newCandForm.pretensaoSalarial} onChange={(e) => setNewCandForm(f => ({ ...f, pretensaoSalarial: e.target.value }))} readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Trabalhando atualmente?</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={newCandForm.trabalhandoAtualmente} onChange={(e) => setNewCandForm(f => ({ ...f, trabalhandoAtualmente: e.target.value }))} disabled={candidateFormReadOnly}>
                    <option value="">Não informado</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Status</label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled>
                    <option>Triagem</option>
                  </select>
                </div>
                <div className="md:col-span-8">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">LinkedIn</label>
                  <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" type="url" placeholder="https://linkedin.com/in/..." value={newCandForm.linkedinUrl} onChange={(e) => setNewCandForm(f => ({ ...f, linkedinUrl: e.target.value }))} readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
                <div className="md:col-span-12">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Observações</label>
                  <textarea className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-70" rows={2} value={newCandForm.obs} onChange={(e) => setNewCandForm(f => ({ ...f, obs: e.target.value }))} placeholder="Observações sobre o candidato..." readOnly={candidateFormReadOnly} disabled={candidateFormReadOnly} />
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div>
              <div className="rounded-xl border border-border/40 bg-muted/5 p-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Documentos</h3>
                {existingCandDocs.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    <div className="text-sm font-medium">Arquivos do candidato ({existingCandDocs.length})</div>
                    <ul className="space-y-2">
                      {existingCandDocs.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate" title={d.nomeArquivo ?? undefined}>{d.nomeArquivo ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDocTipoLabel(d.tipo)}
                              {d.descricao ? ` • ${d.descricao}` : ""}
                              {d.tamanhoBytes != null ? ` • ${formatFileSizeShort(d.tamanhoBytes)}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            {isPdfDocumentName(d.nomeArquivo) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                disabled={previewingCandidateDocId === d.id}
                                onClick={() => void previewHubCandidateDocument(d, editingCandidateId)}
                              >
                                <Eye className="mr-1 size-4" />
                                {previewingCandidateDocId === d.id ? "Abrindo..." : "Visualizar"}
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" type="button" onClick={() => void downloadHubCandidateDocument(d, editingCandidateId)}>
                              <Download className="mr-1 size-4" />
                              Download
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : editingCandidateId ? (
                  <p className="text-sm text-muted-foreground mb-3">Nenhum documento cadastrado ainda neste perfil.</p>
                ) : null}
                {!candidateFormReadOnly && (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm mb-3">
                      Arquivos na fila <span className="font-medium">Pendentes</span> são enviados automaticamente após salvar (criar ou atualizar o candidato).
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Tipo</label>
                        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newCandDocTipo} onChange={(e) => setNewCandDocTipo(e.target.value)}>
                          <option value="curriculo">Currículo</option>
                          <option value="documento">Documento</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Descrição</label>
                        <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={newCandDocDesc} onChange={(e) => setNewCandDocDesc(e.target.value)} placeholder="Ex.: CV atualizado" />
                      </div>
                      <div className="overflow-hidden">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Arquivo</label>
                        <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700" type="file" onChange={(e) => setNewCandDocFile(e.currentTarget.files?.[0] ?? null)} />
                      </div>
                    </div>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        if (!newCandDocFile) return toast.error("Selecione um arquivo.");
                        setNewCandPendingDocs(prev => [...prev, { id: crypto.randomUUID(), tipo: newCandDocTipo, desc: newCandDocDesc, file: newCandDocFile, name: newCandDocFile.name, size: newCandDocFile.size }]);
                        setNewCandDocDesc("");
                        setNewCandDocFile(null);
                        toast.success("Documento adicionado. Será enviado ao salvar.");
                      }}>Adicionar documento</Button>
                    </div>
                  </>
                )}
                {newCandPendingDocs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="font-medium text-sm">Pendentes ({newCandPendingDocs.length})</div>
                    {newCandPendingDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.tipo} • {d.desc || "Sem descrição"} • {(d.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => setNewCandPendingDocs(prev => prev.filter(x => x.id !== d.id))}>Remover</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeCandidateForm}>{candidateFormReadOnly ? "Fechar" : "Cancelar"}</Button>
            {!candidateFormReadOnly && (
            <Button disabled={!newCandForm.nome.trim() || !newCandForm.email.trim() || !newCandForm.celular.trim() || newCandWorking} onClick={async () => {
              setNewCandWorking(true);
              try {
                const payload = {
                  nome: newCandForm.nome.trim(),
                  email: newCandForm.email.trim(),
                  fone: newCandForm.fone.trim() || null,
                  celular: newCandForm.celular.trim(),
                  cidade: newCandForm.cidade.trim() || null,
                  uf: newCandForm.uf || null,
                  fonte: newCandForm.fonte,
                  pretensaoSalarial: newCandForm.pretensaoSalarial ? parseFloat(newCandForm.pretensaoSalarial) : null,
                  trabalhandoAtualmente: newCandForm.trabalhandoAtualmente === "sim" ? true : newCandForm.trabalhandoAtualmente === "nao" ? false : null,
                  linkedinUrl: newCandForm.linkedinUrl.trim() || null,
                  obs: newCandForm.obs.trim() || null,
                  vagaId,
                };

                let effectiveId: string | null = editingCandidateId;

                if (editingCandidateId) {
                  const res = await apiFetch(`/api/candidatos/${encodeURIComponent(editingCandidateId)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
                    throw new Error(String(body.message || body.detail || `Erro ${res.status}`));
                  }
                } else {
                  const res = await apiFetch("/api/candidatos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, status: "Triagem", vagaId }),
                  });
                  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
                  if (!res.ok) {
                    throw new Error(String(body.message || body.detail || `Erro ${res.status}`));
                  }
                  const id = body.id;
                  effectiveId = typeof id === "string" ? id : id != null ? String(id) : null;
                }

                if (effectiveId && newCandPendingDocs.length > 0) {
                  for (const doc of newCandPendingDocs) {
                    const form = new FormData();
                    form.append("arquivo", doc.file);
                    form.append("tipo", doc.tipo);
                    if (doc.desc.trim()) form.append("descricao", doc.desc.trim());
                    if (vagaId) form.append("vagaId", vagaId);
                    const up = await apiFetch(`/api/candidatos/${encodeURIComponent(effectiveId)}/documentos`, { method: "POST", body: form });
                    if (!up.ok) {
                      const detail = await up.json().catch(() => ({})) as Record<string, unknown>;
                      throw new Error(String(detail.message || detail.detail || `Falha ao enviar documento (${up.status})`));
                    }
                  }
                }

                toast.success(editingCandidateId ? "Candidato atualizado!" : "Candidato adicionado!");
                closeCandidateForm();
                void load();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar candidato");
              } finally {
                setNewCandWorking(false);
              }
            }}>
              {newCandWorking ? "Salvando..." : "Salvar"}
            </Button>
            )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: Solicitação de Desligamento ── */}
      <Sheet open={desligamentoDialog.open} onOpenChange={(o) => setDesligamentoDialog((d) => ({ ...d, open: o }))}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              Solicitação de Desligamento
              {desligamentoDialog.data && (() => {
                const st = DESL_STATUS_MAP[desligamentoDialog.data!.status] ?? DESL_STATUS_MAP[0];
                return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>;
              })()}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {desligamentoDialog.loading && (
              <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
            )}
            {!desligamentoDialog.loading && desligamentoDialog.data && (() => {
              const d = desligamentoDialog.data!;
              const etapas = d.etapas;
              return (
                <>
                  {/* Dados principais */}
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-3">Informações</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Funcionário</p>
                        <p className="font-medium">{d.funcionarioNome ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Solicitante</p>
                        <p>{d.solicitanteNome ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Data Desligamento</p>
                        <p>{d.dataDesligamento ? new Date(d.dataDesligamento).toLocaleDateString("pt-BR") : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Tipo</p>
                        <p>{TIPO_DESL_MAP[d.tipoDesligamento] ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Substituir Posição?</p>
                        <p>{d.substituirPosicao ? "Sim" : "Não"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Abertura</p>
                        <p>{d.createdAtUtc ? new Date(d.createdAtUtc).toLocaleDateString("pt-BR") : "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Motivo</p>
                        <p className="leading-relaxed">{d.motivoDesligamento || "—"}</p>
                      </div>
                      {d.observacoes && (
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-0.5">Observações</p>
                          <p className="leading-relaxed">{d.observacoes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Etapas de aprovação */}
                  {etapas.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-3">Fluxo de Aprovação</p>
                      <div className="space-y-2">
                        {etapas.map((e) => {
                          const isPendente = e.status === "Pendente";
                          const isAprovado = e.status === "Aprovado";
                          return (
                            <div key={e.ordem} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${isPendente ? "border-amber-200 bg-amber-50" : isAprovado ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                              <div className="mt-0.5 shrink-0">
                                {isPendente
                                  ? <Clock className="size-4 text-amber-600" />
                                  : isAprovado
                                    ? <CheckCircle2 className="size-4 text-emerald-600" />
                                    : <XCircle className="size-4 text-red-600" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{e.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {e.aprovadorNome ?? e.roleFilaNome ?? "—"}
                                  {e.dataUtc && ` · ${new Date(e.dataUtc).toLocaleDateString("pt-BR")}`}
                                </p>
                                {e.observacao && <p className="text-xs mt-1 italic text-muted-foreground">{e.observacao}</p>}
                              </div>
                              <span className={`shrink-0 text-[10px] font-semibold ${isPendente ? "text-amber-700" : isAprovado ? "text-emerald-700" : "text-red-700"}`}>{e.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="border-t px-6 py-4">
            <Button variant="outline" className="w-full" onClick={() => setDesligamentoDialog((d) => ({ ...d, open: false }))}>Fechar</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: Detalhes do Funcionário ── */}
      <Dialog open={!!funcDetailId} onOpenChange={(o) => { if (!o) closeFuncDetail(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{funcDetailData?.name ?? "Funcionário"}</DialogTitle>
            <DialogDescription>Dados do colaborador. Somente leitura.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {(["dados", "historico"] as const).map((t) => (
              <Button key={t} type="button" size="sm" variant={funcDetailTab === t ? "default" : "outline"} onClick={() => setFuncDetailTab(t)}>
                {t === "dados" ? "Dados" : "Histórico"}
              </Button>
            ))}
          </div>

          {funcDetailLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>
          ) : funcDetailTab === "dados" && funcDetailData ? (
            <div className="space-y-5">
              {/* Banner dados incompletos */}
              {(() => {
                const missing: string[] = [];
                if (!funcDetailData.jobPositionName) missing.push("Cargo");
                if (!funcDetailData.unidadeLotacaoDescricao) missing.push("Unidade de Lotação");
                if (!funcDetailData.nivelHierarquicoNome) missing.push("Nível do Cargo");
                if (!funcDetailData.centroCustoDescricao) missing.push("Centro de Custo");
                return missing.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div><span className="font-semibold">Dados incompletos: </span>{missing.join(", ")}</div>
                  </div>
                ) : null;
              })()}

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-xs font-medium text-muted-foreground">Nome</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{funcDetailData.name}</dd>
                  </div>
                  <div><dt className="text-xs font-medium text-muted-foreground">E-mail</dt><dd className="mt-0.5 text-sm">{funcDetailData.email || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Telefone</dt><dd className="mt-0.5 text-sm">{funcDetailData.phone || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Status</dt><dd className="mt-0.5">{funcStatusBadge(funcDetailData.status)}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Headcount</dt><dd className="mt-0.5 text-sm">{funcDetailData.headcount}</dd></div>
                </dl>
              </div>

              <hr className="border-border/40" />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organização Interna</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Cargo</dt>
                    <dd className="mt-0.5 text-sm">{funcDetailData.jobPositionName ? (funcDetailData.jobPositionCode ? `${funcDetailData.jobPositionCode} - ${funcDetailData.jobPositionName}` : funcDetailData.jobPositionName) : "—"}</dd>
                  </div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Gestor Direto</dt><dd className="mt-0.5 text-sm">{funcDetailData.gestorDiretoNome || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Nível do Cargo</dt><dd className="mt-0.5 text-sm">{funcDetailData.nivelHierarquicoNome || "—"}</dd></div>
                </dl>
              </div>

              <hr className="border-border/40" />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integração TOTVS Datasul</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-xs font-medium text-muted-foreground">Unidade de Lotação</dt>
                    <dd className="mt-0.5 text-sm">{funcDetailData.unidadeLotacaoDescricao ? (funcDetailData.unidadeLotacaoCode ? `${funcDetailData.unidadeLotacaoCode} - ${funcDetailData.unidadeLotacaoDescricao}` : funcDetailData.unidadeLotacaoDescricao) : "—"}</dd>
                  </div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Matrícula</dt><dd className="mt-0.5 font-mono text-sm">{funcDetailData.cdnFuncionario || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Empresa</dt><dd className="mt-0.5 font-mono text-sm">{funcDetailData.cdnEmpresa || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-muted-foreground">Estabelecimento</dt><dd className="mt-0.5 font-mono text-sm">{funcDetailData.cdnEstab || "—"}</dd></div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Centro de Custo</dt>
                    <dd className="mt-0.5 text-sm">{funcDetailData.centroCustoDescricao ? (funcDetailData.centroCustoCode ? `${funcDetailData.centroCustoCode} - ${funcDetailData.centroCustoDescricao}` : funcDetailData.centroCustoDescricao) : "—"}</dd>
                  </div>
                </dl>
              </div>

              {(funcDetailData.notes || funcDetailData.createdAtUtc) && (
                <>
                  <hr className="border-border/40" />
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações e Auditoria</p>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                      {funcDetailData.notes && (
                        <div className="col-span-2 sm:col-span-3">
                          <dt className="text-xs font-medium text-muted-foreground">Observações</dt>
                          <dd className="mt-0.5 text-sm whitespace-pre-line">{funcDetailData.notes}</dd>
                        </div>
                      )}
                      <div><dt className="text-xs font-medium text-muted-foreground">Criado em</dt><dd className="mt-0.5 text-sm">{fmtDateTime(funcDetailData.createdAtUtc)}</dd></div>
                      <div><dt className="text-xs font-medium text-muted-foreground">Atualizado em</dt><dd className="mt-0.5 text-sm">{fmtDateTime(funcDetailData.updatedAtUtc)}</dd></div>
                    </dl>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {funcDetailTab === "historico" && (
            <div className="mt-2">
              {funcHistoryLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Carregando histórico…</div>
              ) : funcHistory.length ? (
                <div className="space-y-2">
                  {funcHistory.map((h) => (
                    <div key={h.id} className="rounded-xl border border-border/40 bg-card/50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {fmtDateTime(h.occurredAt)} — {stateLabel(h.state)}
                          {h.changedColumns ? <span className="text-muted-foreground"> ({h.changedColumns})</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{h.userName ? `por ${h.userName}` : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeFuncDetail}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ── */}
      {editOpen && (
        <VagaFormModal
          open={editOpen}
          editId={vagaId}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); void load(); }}
        />
      )}

      {/* ── Dialog: Aprovar Candidato ── */}
      <Dialog open={admissaoDialog.open} onOpenChange={(o) => !admissaoDialog.working && setAdmissaoDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-[900px] text-base sm:text-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl leading-tight">Aprovar Candidato — {admissaoDialog.candidate?.nome}</DialogTitle>
          </DialogHeader>
          {admissaoDialog.linkGerado ? (
            <div className="space-y-4">
              {/* WhatsApp enviado */}
              {admissaoDialog.whatsappEnviado && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                  <svg className="mx-auto mb-1 size-8 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <p className="text-xl font-medium text-emerald-700 dark:text-emerald-400">WhatsApp enviado com sucesso!</p>
                </div>
              )}
              {/* Email enviado */}
              {admissaoDialog.emailEnviado && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                  <Mail className="mx-auto mb-1 size-8 text-emerald-600" />
                  <p className="text-xl font-medium text-emerald-700 dark:text-emerald-400">Email enviado ao candidato!</p>
                </div>
              )}
              {/* Só mostra link se não enviou WhatsApp (canal foi só email ou nenhum canal funcionou) */}
              {!admissaoDialog.whatsappEnviado && (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-muted-foreground">Link de acesso do candidato:</p>
                  <div className="flex gap-2">
                    <input readOnly value={admissaoDialog.linkGerado} className="flex-1 truncate rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-lg" />
                    <Button size="sm" variant="outline" className="text-lg" onClick={() => { void navigator.clipboard.writeText(admissaoDialog.linkGerado!); toast.success("Link copiado!"); }}>Copiar</Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" className="text-lg" onClick={() => setAdmissaoDialog((d) => ({ ...d, open: false }))}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Tipo de contratação */}
              <div className="space-y-2">
                <label className="text-lg font-semibold">Tipo de contratação</label>
                <div className="flex gap-2">
                  {(["CLT", "PJ"] as const).map((tipo) => (
                    <button key={tipo} type="button"
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-lg font-semibold transition-colors ${admissaoDialog.tipoContratacao === tipo ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted/20"}`}
                      onClick={() => setAdmissaoDialog((d) => ({ ...d, tipoContratacao: tipo }))}
                    >{tipo}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-sky-200/80 bg-sky-50/45 p-4 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm dark:bg-sky-950 dark:text-sky-300">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-sky-950 dark:text-sky-100">
                        Documentos que serão solicitados
                      </div>
                      <p className="text-sm text-sky-800/80 dark:text-sky-200/80">
                        {ADMISSAO_DOCUMENTOS[admissaoDialog.tipoContratacao].length} itens para contratação {admissaoDialog.tipoContratacao}.
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-sky-700 shadow-sm dark:bg-sky-950 dark:text-sky-300">
                    {admissaoDialog.tipoContratacao}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ADMISSAO_DOCUMENTOS[admissaoDialog.tipoContratacao].map((doc) => (
                    <span
                      key={doc}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-sky-900 shadow-sm dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
                    >
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {doc}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-center text-sm leading-relaxed text-sky-800/75 dark:text-sky-200/75">
                  Ao enviar o link, o candidato acessa o Portal de Admissão e envia estes arquivos para validação do RH.
                </p>
              </div>

              {/* Canais de envio */}
              <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                <Button
                  className="h-11 w-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#1ebe5d]"
                  disabled={admissaoDialog.working}
                  onClick={() => { setAdmissaoDialog((d) => ({ ...d, modo: "link", canal: "whatsapp" })); void iniciarAdmissao("whatsapp"); }}
                >
                  <svg className="mr-2 size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar via WhatsApp
                </Button>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-10 w-full text-sm font-medium"
                    disabled={admissaoDialog.working}
                    onClick={() => { setAdmissaoDialog((d) => ({ ...d, modo: "link", canal: "email" })); void iniciarAdmissao("email"); }}
                  >
                    <Mail className="mr-2 size-4" /> Enviar via E-mail
                  </Button>

                  <Button
                    variant="outline"
                    className="h-10 w-full text-sm font-medium"
                    disabled={admissaoDialog.working}
                    onClick={() => { setAdmissaoDialog((d) => ({ ...d, modo: "link", canal: "whatsapp+email" })); void iniciarAdmissao("whatsapp+email"); }}
                  >
                    <svg className="mr-2 size-4 shrink-0 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <Mail className="mr-2 size-4" /> WhatsApp e E-mail
                  </Button>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  className="text-sm"
                  disabled={admissaoDialog.working}
                  onClick={() => {
                    setAdmissaoDialog((d) => ({ ...d, open: false }));
                    if (admissaoDialog.candidate) void openEditCandidate(admissaoDialog.candidate.id);
                  }}
                >
                  <PenSquare className="mr-2 size-4" /> Revisar candidato
                </Button>
                <Button variant="outline" className="text-sm" disabled={admissaoDialog.working} onClick={() => setAdmissaoDialog((d) => ({ ...d, open: false }))}>
                  Cancelar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {candidatePdfPreview ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={closeCandidatePdfPreview}>
          <div className="flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Visualizar PDF</div>
                <div className="truncate text-xs text-muted-foreground">{candidatePdfPreview.nomeArquivo}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = candidatePdfPreview.url;
                    a.download = candidatePdfPreview.nomeArquivo || "documento.pdf";
                    a.rel = "noopener";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="size-4" />
                  Baixar
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  onClick={closeCandidatePdfPreview}
                >
                  Fechar
                </button>
              </div>
            </div>
            <iframe title={`PDF - ${candidatePdfPreview.nomeArquivo}`} src={candidatePdfPreview.url} className="min-h-0 flex-1 bg-slate-100" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
