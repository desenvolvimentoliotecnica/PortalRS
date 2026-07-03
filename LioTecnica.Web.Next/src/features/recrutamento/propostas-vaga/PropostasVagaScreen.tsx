"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Search } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";
import { getAccessToken, getTenantId, setTenantId, tryGetTenantIdFromJwt } from "@/lib/session";
import {
  cancelarProposta,
  createProposta,
  enviarProposta,
  listPropostas,
  reenviarEmailProposta,
  resolveStatus,
  updateProposta,
  type PropostaVagaResponse,
} from "./propostaApi";
import {
  beneficioKey,
  formatBeneficioLinha,
  mapVagaBeneficios,
  type VagaBeneficioFormItem,
} from "./propostaBeneficioUtils";

type VagaLite = { id: string; titulo: string | null };
type CandidatoLite = { id: string; nome: string | null; email: string | null; celular: string | null; fone: string | null };
type PropostaSentFeedback = {
  vagaTitulo: string | null;
  candidatoNome: string | null;
  candidatoEmail: string | null;
  expiraEmUtc: string | null;
};
type SortCol = "vaga" | "candidato" | "salario" | "status" | "enviadaEm" | "createdAt";
type SortDir = "asc" | "desc";

type AnyRecord = Record<string, unknown>;

const STATUS_FILTERS = ["Rascunho", "Enviada", "Visualizada", "Aceita", "Recusada", "Expirada", "Cancelada"] as const;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function extractItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const items = record?.items ?? record?.Items;
  return Array.isArray(items) ? items : [];
}

function toVagaLite(value: unknown): VagaLite | null {
  const record = asRecord(value);
  const id = typeof record?.id === "string" ? record.id : typeof record?.Id === "string" ? record.Id : "";
  if (!id) return null;
  const titulo = typeof record?.titulo === "string"
    ? record.titulo
    : typeof record?.Titulo === "string"
      ? record.Titulo
      : null;
  return { id, titulo };
}

function toCandidatoLite(value: unknown): CandidatoLite | null {
  const record = asRecord(value);
  const id = typeof record?.id === "string" ? record.id : typeof record?.Id === "string" ? record.Id : "";
  if (!id) return null;
  const nome = typeof record?.nome === "string"
    ? record.nome
    : typeof record?.Nome === "string"
      ? record.Nome
      : typeof record?.nomeCompleto === "string"
        ? record.nomeCompleto
        : typeof record?.NomeCompleto === "string"
          ? record.NomeCompleto
          : null;
  const email = typeof record?.email === "string"
    ? record.email
    : typeof record?.Email === "string"
      ? record.Email
      : null;
  const celular = typeof record?.celular === "string"
    ? record.celular
    : typeof record?.Celular === "string"
      ? record.Celular
      : null;
  const fone = typeof record?.fone === "string"
    ? record.fone
    : typeof record?.Fone === "string"
      ? record.Fone
      : typeof record?.telefone === "string"
        ? record.telefone
        : typeof record?.Telefone === "string"
          ? record.Telefone
          : null;
  return { id, nome, email, celular, fone };
}

function formatMoney(value: number | null, moeda: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: (moeda ?? "BRL").toUpperCase(),
    }).format(value);
  } catch {
    return `${moeda ?? "R$"} ${value.toLocaleString("pt-BR")}`;
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dateOnlyTime(value: string) {
  if (!value) return 0;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function statusBadgeClass(s: string) {
  switch (s) {
    case "Aceita": return "bg-emerald-100 text-emerald-800";
    case "Recusada": return "bg-red-100 text-red-800";
    case "Expirada":
    case "Cancelada": return "bg-neutral-200 text-neutral-700";
    case "Enviada":
    case "Visualizada": return "bg-sky-100 text-sky-800";
    default: return "bg-amber-100 text-amber-900";
  }
}

function canEditAndSend(status: string) {
  return status === "Rascunho" || status === "Enviada" || status === "Visualizada";
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Em HTTP/IP local o Clipboard API pode falhar; usamos fallback abaixo.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function resolveTenantIdForPublicLink(): string {
  const sessionTenant = getTenantId();
  if (sessionTenant) return sessionTenant;

  const token = getAccessToken();
  const jwtTenant = token ? tryGetTenantIdFromJwt(token) : null;
  if (jwtTenant) {
    setTenantId(jwtTenant);
    return jwtTenant;
  }

  try {
    return localStorage.getItem("tenantId")?.trim() || "";
  } catch {
    return "";
  }
}

export default function PropostasVagaScreen() {
  const [items, setItems] = useState<PropostaVagaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingProposta, setEditingProposta] = useState<PropostaVagaResponse | null>(null);
  const [sentFeedback, setSentFeedback] = useState<PropostaSentFeedback | null>(null);
  const [vagas, setVagas] = useState<VagaLite[]>([]);
  const [candidatos, setCandidatos] = useState<CandidatoLite[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("enviadaEm");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const routePrefillHandled = useRef(false);

  const [form, setForm] = useState({
    vagaId: "",
    candidatoId: "",
    moeda: "BRL",
    salarioOferecido: "",
    descricaoBeneficios: "",
    incluirBeneficiosNaProposta: true,
    beneficiosSelecionadosKeys: [] as string[],
    dataPrevistaInicio: "",
    mensagemPersonalizada: "",
    observacaoInternaRh: "",
  });
  const [vagaBeneficios, setVagaBeneficios] = useState<VagaBeneficioFormItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPropostas();
      setItems(data);
    } catch {
      toast.error("Falha ao listar propostas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (loading || routePrefillHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    const prefillVagaId = params.get("vagaId") ?? "";
    const prefillCandidatoId = params.get("candidatoId") ?? "";
    const existing = items.find((p) => (
      p.vagaId === prefillVagaId
      && p.candidatoId === prefillCandidatoId
      && canEditAndSend(resolveStatus(p.status))
    ));

    routePrefillHandled.current = true;
    if (existing) {
      setForm({
        vagaId: existing.vagaId,
        candidatoId: existing.candidatoId,
        moeda: existing.moeda ?? "BRL",
        salarioOferecido: existing.salarioOferecido != null ? String(existing.salarioOferecido) : "",
        descricaoBeneficios: existing.descricaoBeneficios ?? "",
        incluirBeneficiosNaProposta: existing.incluirBeneficiosNaProposta ?? true,
        beneficiosSelecionadosKeys: (existing.beneficiosSelecionados ?? []).map(beneficioKey),
        dataPrevistaInicio: existing.dataPrevistaInicio ? existing.dataPrevistaInicio.slice(0, 10) : "",
        mensagemPersonalizada: existing.mensagemPersonalizada ?? "",
        observacaoInternaRh: existing.observacaoInternaRh ?? "",
      });
      setEditingProposta(existing);
      setShowNew(false);
      toast.info("Já existe proposta para este candidato nesta vaga. Abrimos para edição e reenvio.");
      return;
    }

    setEditingProposta(null);
    setShowNew(true);
    setForm((f) => ({
      ...f,
      vagaId: prefillVagaId || f.vagaId,
      candidatoId: prefillCandidatoId || f.candidatoId,
    }));
  }, [items, loading]);

  useEffect(() => {
    if (!showNew && !editingProposta) return;
    const ac = new AbortController();
    (async () => {
      try {
        const [vs, cs] = await Promise.all([
          apiJson<unknown>("/api/vagas").catch(() => []),
          apiJson<unknown>("/api/candidatos").catch(() => []),
        ]);
        if (!ac.signal.aborted) {
          setVagas(extractItems(vs).map(toVagaLite).filter((v): v is VagaLite => v !== null));
          setCandidatos(extractItems(cs).map(toCandidatoLite).filter((c): c is CandidatoLite => c !== null));
        }
      } catch { /* ignore */ }
    })();
    return () => ac.abort();
  }, [showNew, editingProposta]);

  useEffect(() => {
    if (!form.vagaId || (!showNew && !editingProposta)) return;
    const ac = new AbortController();
    (async () => {
      try {
        const vaga = await apiJson<Record<string, unknown>>(`/api/vagas/${encodeURIComponent(form.vagaId)}`);
        if (ac.signal.aborted) return;
        const benefs = mapVagaBeneficios(vaga.beneficios ?? vaga.Beneficios);
        setVagaBeneficios(benefs);
        if (!editingProposta && benefs.length > 0) {
          setForm((f) => ({
            ...f,
            incluirBeneficiosNaProposta: true,
            beneficiosSelecionadosKeys: benefs.map((b) => b.key),
          }));
        }
      } catch {
        if (!ac.signal.aborted) setVagaBeneficios([]);
      }
    })();
    return () => ac.abort();
  }, [form.vagaId, showNew, editingProposta]);

  const resetForm = () => {
    setVagaBeneficios([]);
    setForm({
      vagaId: "", candidatoId: "", moeda: "BRL", salarioOferecido: "",
      descricaoBeneficios: "", incluirBeneficiosNaProposta: true, beneficiosSelecionadosKeys: [],
      dataPrevistaInicio: "",
      mensagemPersonalizada: "", observacaoInternaRh: "",
    });
  };

  function fillFormFromProposta(p: PropostaVagaResponse) {
    const selecionados = (p.beneficiosSelecionados ?? []).map(beneficioKey);
    setForm({
      vagaId: p.vagaId,
      candidatoId: p.candidatoId,
      moeda: p.moeda ?? "BRL",
      salarioOferecido: p.salarioOferecido != null ? String(p.salarioOferecido) : "",
      descricaoBeneficios: p.descricaoBeneficios ?? "",
      incluirBeneficiosNaProposta: p.incluirBeneficiosNaProposta ?? true,
      beneficiosSelecionadosKeys: selecionados,
      dataPrevistaInicio: p.dataPrevistaInicio ? p.dataPrevistaInicio.slice(0, 10) : "",
      mensagemPersonalizada: p.mensagemPersonalizada ?? "",
      observacaoInternaRh: p.observacaoInternaRh ?? "",
    });
    if ((p.beneficiosSelecionados ?? []).length > 0) {
      setVagaBeneficios((p.beneficiosSelecionados ?? []).map((b) => ({ ...b, key: beneficioKey(b) })));
    }
  }

  function openEditProposta(p: PropostaVagaResponse) {
    fillFormFromProposta(p);
    setEditingProposta(p);
    setShowNew(false);
  }

  function closeProposalModal() {
    setShowNew(false);
    setEditingProposta(null);
    resetForm();
  }

  const propostaPayload = () => {
    const catalog = vagaBeneficios.length > 0
      ? vagaBeneficios
      : (editingProposta?.beneficiosSelecionados ?? []).map((b) => ({ ...b, key: beneficioKey(b) }));
    const selected = form.incluirBeneficiosNaProposta
      ? catalog.filter((b) => form.beneficiosSelecionadosKeys.includes(b.key))
      : [];
    return {
      moeda: form.moeda || null,
      salarioOferecido: form.salarioOferecido ? Number(form.salarioOferecido) : null,
      descricaoBeneficios: form.descricaoBeneficios || null,
      incluirBeneficiosNaProposta: form.incluirBeneficiosNaProposta,
      beneficiosSelecionados: selected.map(({ key: _k, ...b }) => b),
      dataPrevistaInicio: form.dataPrevistaInicio || null,
      mensagemPersonalizada: form.mensagemPersonalizada || null,
      observacaoInternaRh: form.observacaoInternaRh || null,
    };
  };

  const submitNew = async () => {
    if (!form.vagaId || !form.candidatoId) {
      toast.error("Selecione vaga e candidato.");
      return;
    }
    try {
      if (editingProposta) {
        await updateProposta(editingProposta.id, propostaPayload());
        const status = resolveStatus(editingProposta.status);
        const enviada = status === "Rascunho"
          ? await enviarProposta(editingProposta.id, 7)
          : await reenviarEmailProposta(editingProposta.id);
        toast.success(status === "Rascunho"
          ? "Proposta atualizada e enviada com validade de 7 dias."
          : "Proposta atualizada e reenviada por e-mail.");
        setSentFeedback(toSentFeedback(enviada));
        closeProposalModal();
        await load();
        return;
      }

      const criada = await createProposta({
        vagaId: form.vagaId,
        candidatoId: form.candidatoId,
        ...propostaPayload(),
      });
      const enviada = await enviarProposta(criada.id, 7);
      toast.success("Proposta criada e enviada com validade de 7 dias.");
      setSentFeedback(toSentFeedback(enviada));
      closeProposalModal();
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao salvar proposta.");
    }
  };

  const enviar = async (p: PropostaVagaResponse) => {
    const dias = window.prompt("Prazo em dias para resposta (padrão 7):", "7");
    if (dias === null) return;
    const n = Number(dias);
    try {
      const enviada = await enviarProposta(p.id, Number.isFinite(n) && n > 0 ? n : undefined);
      toast.success("Proposta enviada — token gerado.");
      setSentFeedback(toSentFeedback(enviada));
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao enviar.");
    }
  };

  const cancelar = async (p: PropostaVagaResponse) => {
    const result = await Swal.fire({
      title: "Cancelar proposta?",
      text: "O candidato não conseguirá mais visualizar ou aceitar esta proposta.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, cancelar",
      cancelButtonText: "Manter proposta",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#0f766e",
    });
    if (!result.isConfirmed) return;

    try {
      await cancelarProposta(p.id);
      toast.success("Proposta cancelada.");
      await Swal.fire({
        title: "Proposta cancelada",
        text: "A proposta foi cancelada com sucesso.",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#0f766e",
      });
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao cancelar.");
    }
  };

  const reenviarEmail = async (p: PropostaVagaResponse) => {
    try {
      await reenviarEmailProposta(p.id);
      toast.success("E-mail da proposta reenviado.");
      await Swal.fire({
        title: "E-mail reenviado!",
        text: "A proposta foi enviada novamente para o candidato.",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#0f766e",
      });
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao reenviar proposta.");
    }
  };

  const copiarLink = async (p: PropostaVagaResponse) => {
    if (!p.accessToken) return;
    const tenantId = resolveTenantIdForPublicLink();
    if (!tenantId) {
      toast.error("TenantId não encontrado.");
      await Swal.fire({
        title: "Tenant não encontrado",
        text: "Não foi possível identificar a empresa para montar o link público da proposta. Faça login novamente e tente copiar o link.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#dc2626",
      });
      return;
    }

    const url = `${window.location.origin}/app/PortalVagas/Proposta?token=${encodeURIComponent(p.accessToken)}&tenantId=${encodeURIComponent(tenantId)}`;

    const copied = await copyTextToClipboard(url);
    if (copied) {
      toast.success("Link copiado.");
      await Swal.fire({
        title: "Link copiado!",
        text: "O link público da proposta foi copiado para a área de transferência.",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#0f766e",
      });
      return;
    }

    toast.error("Falha ao copiar automaticamente.");
    await Swal.fire({
      title: "Copie o link manualmente",
      text: "Seu navegador bloqueou a cópia automática. Selecione o link abaixo e copie.",
      input: "textarea",
      inputValue: url,
      inputAttributes: {
        readonly: "true",
        "aria-label": "Link público da proposta",
      },
      icon: "info",
      confirmButtonText: "OK",
      confirmButtonColor: "#0f766e",
    });
  };

  const rows = useMemo(() => items.map((p) => {
    const s = resolveStatus(p.status) as string;
    return { p, statusStr: s };
  }), [items]);

  const candidatosById = useMemo(() => new Map(candidatos.map((c) => [c.id, c])), [candidatos]);

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase();
    const from = dateOnlyTime(dateFrom);
    const to = dateTo ? dateOnlyTime(dateTo) + 86_399_999 : 0;
    const dir = sortDir === "asc" ? 1 : -1;

    return rows
      .filter(({ p, statusStr }) => {
        if (statusFilter && statusStr !== statusFilter) return false;
        const sentAt = dateTime(p.enviadaEmUtc);
        if (from && sentAt < from) return false;
        if (to && sentAt > to) return false;
        if (!search) return true;
        return [
          p.vagaTitulo,
          p.candidatoNome,
          p.candidatoEmail,
          p.moeda,
          statusStr,
        ].some((value) => (value ?? "").toLowerCase().includes(search));
      })
      .sort((a, b) => {
        const pa = a.p;
        const pb = b.p;
        switch (sortCol) {
          case "vaga":
            return dir * (pa.vagaTitulo ?? "").localeCompare(pb.vagaTitulo ?? "", "pt-BR");
          case "candidato":
            return dir * (pa.candidatoNome ?? pa.candidatoEmail ?? "").localeCompare(pb.candidatoNome ?? pb.candidatoEmail ?? "", "pt-BR");
          case "salario":
            return dir * ((pa.salarioOferecido ?? -1) - (pb.salarioOferecido ?? -1));
          case "status":
            return dir * a.statusStr.localeCompare(b.statusStr, "pt-BR");
          case "createdAt":
            return dir * (dateTime(pa.createdAtUtc) - dateTime(pb.createdAtUtc));
          case "enviadaEm":
          default:
            return dir * (dateTime(pa.enviadaEmUtc) - dateTime(pb.enviadaEmUtc));
        }
      });
  }, [dateFrom, dateTo, q, rows, sortCol, sortDir, statusFilter]);

  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filteredRows.length, {
    initialPageSize: 20,
    resetDeps: [q, statusFilter, dateFrom, dateTo, sortCol, sortDir],
  });
  const pagedRows = filteredRows.slice(slice.start, slice.end);
  const hasFilters = Boolean(q || statusFilter || dateFrom || dateTo);

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortCol(col);
    setSortDir(col === "enviadaEm" || col === "createdAt" ? "desc" : "asc");
  }

  function sortIcon(col: SortCol) {
    if (sortCol !== col) return <ArrowUpDown className="inline size-3 ml-1 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="inline size-3 ml-1" />
      : <ArrowDown className="inline size-3 ml-1" />;
  }

  function clearFilters() {
    setQ("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="space-y-6 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Propostas / Cartas de oferta</h1>
          <p className="text-sm text-neutral-600">
            RH cria a proposta, envia por link único e acompanha aceite digital.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>Nova proposta</Button>
      </header>

      <div className="rounded-xl border border-border/40 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2.5">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Buscar vaga, candidato, e-mail ou status..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => { setSortCol("enviadaEm"); setSortDir((current) => (current === "desc" ? "asc" : "desc")); }}
            title={sortDir === "desc" ? "Mais recentes primeiro" : "Mais antigas primeiro"}
          >
            <CalendarDays className="size-3" />
            {sortCol === "enviadaEm" && sortDir === "asc" ? "Antigas" : "Recentes"}
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {filteredRows.length} resultado(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3" /> Enviada em:
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Data inicial de envio"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Data final de envio"
          />
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="ml-auto text-[11px] text-muted-foreground underline hover:text-foreground">
              Limpar filtros
            </button>
          )}
        </div>

        <div className="overflow-x-auto px-2 py-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[260px] cursor-pointer select-none" onClick={() => toggleSort("vaga")}>
                  Vaga {sortIcon("vaga")}
                </TableHead>
                <TableHead className="min-w-[220px] cursor-pointer select-none" onClick={() => toggleSort("candidato")}>
                  Candidato {sortIcon("candidato")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("salario")}>
                  Salário {sortIcon("salario")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("enviadaEm")}>
                  Data envio {sortIcon("enviadaEm")}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  Status {sortIcon("status")}
                </TableHead>
                <TableHead className="min-w-[320px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pagedRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {items.length === 0 ? "Nenhuma proposta criada ainda." : "Nenhuma proposta encontrada para os filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map(({ p, statusStr }) => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium text-foreground">{p.vagaTitulo ?? p.vagaId.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{p.candidatoNome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.candidatoEmail ?? ""}</div>
                      <div className="mt-1">
                        <WhatsAppContactButton
                          size="xs"
                          celular={candidatosById.get(p.candidatoId)?.celular}
                          fone={candidatosById.get(p.candidatoId)?.fone}
                          candidatoNome={p.candidatoNome ?? candidatosById.get(p.candidatoId)?.nome}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatMoney(p.salarioOferecido, p.moeda)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(p.enviadaEmUtc)}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(statusStr)}`}>
                        {statusStr}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        {statusStr === "Rascunho" && (
                          <Button size="sm" onClick={() => enviar(p)}>Enviar</Button>
                        )}
                        {canEditAndSend(statusStr) && (
                          <Button size="sm" variant="outline" onClick={() => openEditProposta(p)}>
                            Editar
                          </Button>
                        )}
                        {p.accessToken && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copiarLink(p)}
                          >
                            Copiar link
                          </Button>
                        )}
                        {(statusStr === "Enviada" || statusStr === "Visualizada") && (
                          <Button size="sm" variant="outline" onClick={() => void reenviarEmail(p)}>
                            Reenviar e-mail
                          </Button>
                        )}
                        {statusStr !== "Aceita" && statusStr !== "Recusada" && statusStr !== "Cancelada" && (
                          <Button size="sm" variant="outline" onClick={() => cancelar(p)}>Cancelar</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border/40 px-4 py-3">
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="proposta(s)"
          />
        </div>
      </div>

      {(showNew || editingProposta) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">
              {editingProposta ? "Editar proposta" : "Nova proposta"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {editingProposta
                ? "Ao salvar, a proposta será atualizada e reenviada por e-mail ao candidato."
                : "Ao criar, a proposta será enviada automaticamente por e-mail com validade de 7 dias."}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Vaga</span>
                <select
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.vagaId}
                  onChange={(e) => setForm((f) => ({ ...f, vagaId: e.target.value }))}
                  disabled={editingProposta !== null}
                >
                  <option value="">Selecione…</option>
                  {editingProposta && (
                    <option value={editingProposta.vagaId}>
                      {editingProposta.vagaTitulo ?? editingProposta.vagaId.slice(0, 8)}
                    </option>
                  )}
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>{v.titulo ?? v.id.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Candidato</span>
                <select
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.candidatoId}
                  onChange={(e) => setForm((f) => ({ ...f, candidatoId: e.target.value }))}
                  disabled={editingProposta !== null}
                >
                  <option value="">Selecione…</option>
                  {editingProposta && (
                    <option value={editingProposta.candidatoId}>
                      {editingProposta.candidatoNome ?? editingProposta.candidatoEmail ?? editingProposta.candidatoId.slice(0, 8)}
                    </option>
                  )}
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome ?? c.email ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Moeda</span>
                <input
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.moeda}
                  onChange={(e) => setForm((f) => ({ ...f, moeda: e.target.value }))}
                  maxLength={3}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Salário oferecido</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.salarioOferecido}
                  onChange={(e) => setForm((f) => ({ ...f, salarioOferecido: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Benefícios</span>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.incluirBeneficiosNaProposta}
                    onChange={(e) => setForm((f) => ({ ...f, incluirBeneficiosNaProposta: e.target.checked }))}
                  />
                  Incluir benefícios da vaga na proposta
                </label>
                {form.incluirBeneficiosNaProposta && vagaBeneficios.length > 0 && (
                  <div className="mb-3 space-y-2 rounded-md border border-neutral-200 p-3">
                    {vagaBeneficios.map((b) => (
                      <label key={b.key} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={form.beneficiosSelecionadosKeys.includes(b.key)}
                          onChange={(e) => {
                            setForm((f) => ({
                              ...f,
                              beneficiosSelecionadosKeys: e.target.checked
                                ? [...f.beneficiosSelecionadosKeys, b.key]
                                : f.beneficiosSelecionadosKeys.filter((k) => k !== b.key),
                            }));
                          }}
                        />
                        <span>{formatBeneficioLinha(b)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <span className="mb-1 block text-xs text-neutral-600">Complemento / observações (opcional)</span>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.descricaoBeneficios}
                  onChange={(e) => setForm((f) => ({ ...f, descricaoBeneficios: e.target.value }))}
                  placeholder="Texto livre para complementar a lista de benefícios"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Data prevista de início</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.dataPrevistaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, dataPrevistaInicio: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Mensagem personalizada (opcional)</span>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.mensagemPersonalizada}
                  onChange={(e) => setForm((f) => ({ ...f, mensagemPersonalizada: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Observação interna (RH)</span>
                <input
                  className="w-full rounded-md border border-neutral-300 px-3 py-2"
                  value={form.observacaoInternaRh}
                  onChange={(e) => setForm((f) => ({ ...f, observacaoInternaRh: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeProposalModal}>Cancelar</Button>
              <Button onClick={submitNew}>
                {editingProposta
                  ? resolveStatus(editingProposta.status) === "Rascunho" ? "Salvar e enviar" : "Salvar e reenviar"
                  : "Criar e enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={sentFeedback !== null} onOpenChange={(open) => !open && setSentFeedback(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <DialogTitle className="text-center text-xl">Proposta enviada com sucesso!</DialogTitle>
          </DialogHeader>
          {sentFeedback && (
            <div className="space-y-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-950">
              <p>
                O e-mail da proposta foi enviado para{" "}
                <strong>{sentFeedback.candidatoNome ?? sentFeedback.candidatoEmail ?? "o candidato"}</strong>.
              </p>
              <div className="space-y-1 text-xs text-emerald-900/80">
                <div>Vaga: <strong>{sentFeedback.vagaTitulo ?? "—"}</strong></div>
                {sentFeedback.candidatoEmail && <div>E-mail: {sentFeedback.candidatoEmail}</div>}
                {sentFeedback.expiraEmUtc && (
                  <div>Validade: {new Date(sentFeedback.expiraEmUtc).toLocaleString("pt-BR")}</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => setSentFeedback(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function toSentFeedback(proposta: PropostaVagaResponse): PropostaSentFeedback {
  return {
    vagaTitulo: proposta.vagaTitulo,
    candidatoNome: proposta.candidatoNome,
    candidatoEmail: proposta.candidatoEmail,
    expiraEmUtc: proposta.expiraEmUtc,
  };
}
