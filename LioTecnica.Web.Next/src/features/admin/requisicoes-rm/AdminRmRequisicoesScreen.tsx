"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  DownloadCloud,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const TIPO_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "AUMENTO_QUADRO", label: "Aumento de quadro" },
  { value: "SUBSTITUICAO", label: "Substituição" },
  { value: "DESLIGAMENTO", label: "Desligamento" },
] as const;

const RM_TIPOS_IMPORTAVEIS = new Set(["AUMENTO_QUADRO", "SUBSTITUICAO", "DESLIGAMENTO"]);

/** 1 Em andamento · 3 Aprovada · 5 Em processo de aprovação (só consulta, não distribuir). */
const CODSTATUS_VISIVEIS = [1, 3, 5] as const;

type StatusFilter = "all" | "1" | "3" | "5";
type ImportStage = "idle" | "running" | "refreshing" | "success" | "error";

interface RmRequisicaoRow {
  tipoRequisicao: string;
  codcolrequisicao: number | null;
  idreq: number;
  justificativa: string | null;
  dataabertura: string | null;
  dataprevista: string | null;
  dataconclusao: string | null;
  datacancelamento: string | null;
  codstatus: number | null;
  statusDescricao: string | null;
  statusPermiteAlterar: boolean | null;
  codcolrequisitante: number | null;
  chaparequisitante: string | null;
  nomeRequisitante: string | null;
  codatendimento: number | null;
  codlocal: number | null;
  atendimentoAssunto: string | null;
  tiporeqpai: string | null;
  idreqpai: number | null;
  chapaFuncionario: string | null;
  nomeFuncionarioEnvolvido: string | null;
  chapaSubstituto: string | null;
  nomeFuncionarioSubstituto: string | null;
  numvagas: number | null;
  codfilial: string | null;
  codsecao: string | null;
  codfuncao: string | null;
  codtabelasalarial: string | null;
  codnivelsalarial: string | null;
  codfaixasalarial: string | null;
  nomeFuncao: string | null;
  descricaoFuncao: string | null;
  codccusto: string | null;
  vlrsalario: string | number | null;
  reccreatedby: string | null;
  reccreatedon: string | null;
  recmodifiedby: string | null;
  recmodifiedon: string | null;
}

interface RmRequisicaoListResponse {
  items: RmRequisicaoRow[];
  totalCount: number;
}

interface RmRequisicaoImportResponse {
  totalLidos: number;
  criados: number;
  atualizados: number;
  vagasCriadas: number;
  ignorados: number;
  erros: number;
  mensagens: string[];
}

type SortKey = "abertura" | "tipo" | "id" | "status" | "requisitante" | "funcao" | "justificativa";

function formatDt(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR");
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /aborted|timeout|cancel/i.test(error.message))
      return "Consulta ao RM excedeu o tempo limite. Reduza o período de abertura ou aplique filtros (tipo/status).";
    if (error.message.trim()) return error.message;
  }
  return fallback;
}

function isRmIntegrationConfigMissing(message: string): boolean {
  return /configure\s+rm:connectionstring\s+ou\s+rm:server\s+e\s+rm:database/i.test(message);
}

function isUnmappedStatus(row: RmRequisicaoRow): boolean {
  return row.codstatus != null && /sem mapa/i.test(row.statusDescricao ?? "");
}

function formatMoney(value: string | number | null): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return value;
}

function formatTipoRequisicao(tipo: string | null | undefined): string {
  const value = (tipo ?? "").trim().toUpperCase();
  const labels: Record<string, string> = {
    AUMENTO_QUADRO: "Aumento de Quadro",
    SUBSTITUICAO: "Substituição",
    DESLIGAMENTO: "Desligamento",
  };
  return labels[value] ?? (value ? value.replace(/_/g, " ") : "—");
}

function formatFuncao(row: Pick<RmRequisicaoRow, "codfuncao" | "nomeFuncao">): string {
  const codigo = row.codfuncao?.trim();
  const nome = row.nomeFuncao?.trim();
  if (codigo && nome) return `${codigo} · ${nome}`;
  return nome || codigo || "—";
}

function truncateText(value: string | null | undefined, maxLength = 40): string {
  const text = value?.trim();
  if (!text) return "—";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Período padrão: últimos 36 meses — cobre histórico recente sem consulta ilimitada no RM. */
function defaultRmConsultaDataDe(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 36);
  return formatIsoDate(d);
}

function codStatusInParaImportacao(statusFilter: StatusFilter): number[] {
  if (statusFilter === "all") return [...CODSTATUS_VISIVEIS];
  return [Number(statusFilter)];
}

function defaultRmConsultaDataAte(): string {
  return formatIsoDate(new Date());
}

export default function AdminRmRequisicoesScreen() {
  const router = useRouter();
  const rmConfigAlertOpenRef = useRef(false);
  const [rows, setRows] = useState<RmRequisicaoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tipo, setTipo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dataDe, setDataDe] = useState(defaultRmConsultaDataDe);
  const [dataAte, setDataAte] = useState(defaultRmConsultaDataAte);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [importStartedAt, setImportStartedAt] = useState<number | null>(null);
  const [importElapsedSeconds, setImportElapsedSeconds] = useState(0);
  const [importResult, setImportResult] = useState<RmRequisicaoImportResponse | null>(null);
  const [detailRow, setDetailRow] = useState<RmRequisicaoRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("abertura");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "abertura" ? "desc" : "asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline size-3" />
      : <ChevronDown className="ml-1 inline size-3" />;
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      setQDebounced((prev) => {
        if (next === prev) return prev;
        setPage(1);
        return next;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    async function showRmConfigMissingAlert() {
      if (rmConfigAlertOpenRef.current) return;
      rmConfigAlertOpenRef.current = true;
      const result = await Swal.fire({
        icon: "warning",
        title: "Configuração RM pendente",
        text: "Faltam configurações da integração RM para carregar as requisições. Deseja configurar agora?",
        confirmButtonText: "Configurar agora",
        cancelButtonText: "Depois",
        showCancelButton: true,
        reverseButtons: true,
      });
      rmConfigAlertOpenRef.current = false;
      if (result.isConfirmed) router.push("/admin/tenant-configuracao");
    }

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tipo.trim()) params.set("tipoRequisicao", tipo.trim());
      if (dataDe.trim()) params.set("dataAberturaDe", dataDe.trim());
      if (dataAte.trim()) params.set("dataAberturaAte", dataAte.trim());
      if (qDebounced) params.set("q", qDebounced);
      const codStatusFiltro = statusFilter === "all" ? CODSTATUS_VISIVEIS : [Number(statusFilter)];
      codStatusFiltro.forEach((status) => params.append("codStatusIn", String(status)));
      params.set("sortBy", sortKey);
      params.set("sortDir", sortDir);

      const res = await apiFetch(`/api/rm/requisicoes?${params}`, { cache: "no-store" }, 300_000);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string; title?: string } | null;
        const msg =
          res.status === 504
            ? "Consulta ao RM excedeu o tempo limite. Reduza o período de abertura ou aplique filtros (tipo/status)."
            : typeof body?.detail === "string"
              ? body.detail
              : typeof body?.title === "string"
                ? body.title
                : `HTTP ${res.status}`;
        if (isRmIntegrationConfigMissing(msg)) await showRmConfigMissingAlert();
        else toast.error(msg);
        setRows([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as RmRequisicaoListResponse;
      setRows(data.items ?? []);
      setTotal(data.totalCount ?? 0);
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao carregar requisições do RM.");
      if (isRmIntegrationConfigMissing(message)) await showRmConfigMissingAlert();
      else toast.error(message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, tipo, statusFilter, dataDe, dataAte, qDebounced, sortKey, sortDir, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!importStartedAt || (importStage !== "running" && importStage !== "refreshing")) return;
    const updateElapsed = () => {
      setImportElapsedSeconds(Math.max(0, Math.floor((Date.now() - importStartedAt) / 1000)));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [importStage, importStartedAt]);

  async function importarAprovadas() {
    setImporting(true);
    setImportDialogOpen(true);
    setImportStage("running");
    setImportStartedAt(Date.now());
    setImportElapsedSeconds(0);
    setImportResult(null);
    try {
      const res = await apiFetch(
        "/api/rm/solicitacao-vaga/importar-aprovadas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageSize: 100,
            tipoRequisicao: tipo.trim() && RM_TIPOS_IMPORTAVEIS.has(tipo.trim())
              ? tipo.trim()
              : null,
            dataAberturaDe: dataDe.trim() || null,
            dataAberturaAte: dataAte.trim() || null,
            codStatusIn: codStatusInParaImportacao(statusFilter),
          }),
        },
        90_000,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string; title?: string; message?: string } | null;
        throw new Error(body?.detail ?? body?.message ?? body?.title ?? `HTTP ${res.status}`);
      }

      const result = await res.json() as RmRequisicaoImportResponse;
      setImportResult(result);
      setImportStage("refreshing");
      toast.success(`Importação concluída: ${result.criados} criadas, ${result.atualizados} atualizadas, ${result.vagasCriadas} vagas criadas.`);
      await load();
      setImportStage(result.erros > 0 ? "error" : "success");
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao importar requisições aprovadas do RM.");
      toast.error(message);
      setImportStage("error");
      setImportResult({
        totalLidos: 0,
        criados: 0,
        atualizados: 0,
        vagasCriadas: 0,
        ignorados: 0,
        erros: 1,
        mensagens: [message],
      });
    } finally {
      setImporting(false);
    }
  }

  const unmappedStatuses = useMemo(
    () => Array.from(new Set(rows.filter(isUnmappedStatus).map((row) => row.codstatus).filter((status): status is number => status != null))).sort((a, b) => a - b),
    [rows],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 size-6 text-primary" />
          <div>
            <h4 className="text-lg font-bold">Requisições RM</h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => void importarAprovadas()} disabled={importing || loading}>
            <DownloadCloud className="size-4" />
            {importing ? "Importando..." : "Importar aprovadas"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || importing}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {unmappedStatuses.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-semibold">CODSTATUS sem mapa: {unmappedStatuses.join(", ")}</div>
                <p className="mt-1 text-xs">
                  Cadastre o mapa do status RM para o status do Portal. Sem esse mapa, a importação não sabe quais requisições estão aprovadas.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/rm-requisicao-status">Configurar mapas</Link>
            </Button>
          </div>
        </div>
      )}

      {importResult && (
        <div className={`rounded-xl border p-4 text-sm ${
          importResult.erros > 0
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}>
          <div className="font-semibold">Resultado da importação RM</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Lidas" value={importResult.totalLidos} />
            <Metric label="Criadas" value={importResult.criados} />
            <Metric label="Atualizadas" value={importResult.atualizados} />
            <Metric label="Vagas criadas" value={importResult.vagasCriadas} />
            <Metric label="Ignoradas" value={importResult.ignorados} />
            <Metric label="Erros" value={importResult.erros} />
          </div>
          {importResult.mensagens.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium">Ver detalhes ({importResult.mensagens.length})</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto rounded-md bg-background/70 p-2 text-xs">
                {importResult.mensagens.slice(0, 100).map((msg, index) => (
                  <li key={`${index}-${msg}`}>{msg}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="card-soft relative overflow-hidden rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 px-4 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-6 py-5 text-center shadow-lg">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">Consultando requisições no RM...</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aguarde enquanto buscamos os dados no sistema externo. Essa consulta pode levar alguns instantes.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
              Tipo
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setPage(1);
              }}
            >
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
              Status
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="all">Todas</option>
              <option value="1">Em Andamento</option>
              <option value="3">Aprovada</option>
              <option value="5">Em aprovação</option>
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
              Abertura de
            </label>
            <Input
              type="date"
              value={dataDe}
              onChange={(e) => {
                setDataDe(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
              Abertura até
            </label>
            <Input
              type="date"
              value={dataAte}
              onChange={(e) => {
                setDataAte(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium uppercase">
              <Search className="size-3" /> Busca
            </label>
            <Input
              placeholder="ID ou justificativa…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="text-muted-foreground mb-3 text-xs">
          Total no filtro atual: <span className="font-semibold text-foreground">{total}</span>
          <span className="ml-2 opacity-80">Período padrão: últimos 36 meses. Status &quot;Em aprovação&quot; (CODSTATUS 5) aparece só para consulta — não pode ser distribuído.</span>
          {tipo === "DESLIGAMENTO" && (
            <span className="ml-2 text-emerald-700">
              Desligamentos importados aparecem na aba Desligamento em Gestão → Solicitações (filtro Aprovadas).
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 cursor-pointer select-none whitespace-nowrap text-center" onClick={() => handleSort("id")}>
                  Código RM<SortIcon col="id" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap text-center" onClick={() => handleSort("abertura")}>
                  Abertura<SortIcon col="abertura" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap text-center" onClick={() => handleSort("tipo")}>
                  Tipo<SortIcon col="tipo" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap text-center" onClick={() => handleSort("status")}>
                  Status<SortIcon col="status" />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("requisitante")}>
                  Requisitante<SortIcon col="requisitante" />
                </TableHead>
                <TableHead>Envolvido / substituto</TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("funcao")}>
                  Função<SortIcon col="funcao" />
                </TableHead>
                <TableHead className="whitespace-nowrap">Salário</TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("justificativa")}>
                  Justificativa<SortIcon col="justificativa" />
                </TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground py-10 text-center">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground py-10 text-center">
                    Nenhuma requisição encontrada (ou integração RM não configurada).
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={`${r.tipoRequisicao}-${r.idreq}-${r.codcolrequisicao ?? ""}`}
                    className="cursor-pointer"
                    onClick={() => setDetailRow(r)}
                  >
                    <TableCell className="whitespace-nowrap text-center font-mono text-xs font-medium">
                      {r.idreq}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">
                      {formatDt(r.dataabertura)}
                    </TableCell>
                    <TableCell className="max-w-[140px] text-center text-xs font-medium">
                      {formatTipoRequisicao(r.tipoRequisicao)}
                    </TableCell>
                    <TableCell className={`max-w-[160px] text-center text-xs ${isUnmappedStatus(r) ? "text-amber-700" : ""}`}>
                      {r.statusDescricao ?? (r.codstatus != null ? `CODSTATUS ${r.codstatus}` : "—")}
                    </TableCell>
                    <TableCell className="max-w-[180px] text-xs">
                      <div className="truncate" title={r.nomeRequisitante ?? ""}>
                        {r.nomeRequisitante ?? (r.chaparequisitante ? `Chapa ${r.chaparequisitante}` : "—")}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs">
                      <div className="truncate" title={r.nomeFuncionarioEnvolvido ?? ""}>
                        {r.nomeFuncionarioEnvolvido ?? r.chapaFuncionario ?? "—"}
                      </div>
                      {r.nomeFuncionarioSubstituto && (
                        <div className="text-muted-foreground truncate text-[11px]">
                          Sub.: {r.nomeFuncionarioSubstituto}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[160px] text-xs">
                      <div className="truncate" title={formatFuncao(r)}>
                        {formatFuncao(r)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.vlrsalario != null && r.vlrsalario !== "" && (
                        <div>
                          {formatMoney(r.vlrsalario)}
                        </div>
                      )}
                      {(r.vlrsalario == null || r.vlrsalario === "") && "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-xs">
                      <div className="truncate" title={r.justificativa ?? ""}>
                        {truncateText(r.justificativa)}
                      </div>
                    </TableCell>
                    <TableCell className="w-[48px] text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Ver detalhes"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailRow(r);
                        }}
                      >
                        <Eye />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        )}
      </div>

      <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalhes da requisição RM</DialogTitle>
            <DialogDescription>
              {detailRow
                ? `${formatTipoRequisicao(detailRow.tipoRequisicao)} · COL ${detailRow.codcolrequisicao ?? "—"} · IDREQ ${detailRow.idreq}`
                : "Dados completos recebidos da consulta RM."}
            </DialogDescription>
          </DialogHeader>
          {detailRow && <RmRequisicaoDetail row={detailRow} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRow(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressDialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open && importing) return;
          setImportDialogOpen(open);
        }}
        stage={importStage}
        result={importResult}
        elapsedSeconds={importElapsedSeconds}
        filters={{
          tipo,
          statusFilter,
          dataDe,
          dataAte,
        }}
        onRefresh={() => void load()}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function importStageMeta(stage: ImportStage, result: RmRequisicaoImportResponse | null) {
  if (stage === "success") {
    return {
      title: "Importação concluída",
      description: "As requisições aprovadas foram processadas e a lista foi atualizada.",
      progress: 100,
      icon: <CheckCircle2 className="size-8 text-emerald-600" />,
    };
  }
  if (stage === "error") {
    return {
      title: result?.erros ? "Importação concluída com atenção" : "Falha na importação",
      description: result?.erros
        ? "O processamento terminou, mas existem erros ou mensagens que precisam ser revisadas."
        : "Não foi possível concluir a importação. Veja os detalhes abaixo.",
      progress: result?.totalLidos ? 100 : 35,
      icon: <XCircle className="size-8 text-red-600" />,
    };
  }
  if (stage === "refreshing") {
    return {
      title: "Atualizando lista do Portal",
      description: "A importação terminou. Estamos recarregando as requisições para refletir os novos dados.",
      progress: 90,
      icon: <Loader2 className="size-8 animate-spin text-primary" />,
    };
  }
  return {
    title: "Importando requisições RM",
    description: "Consultando o RM e criando/atualizando solicitações de vaga no Portal.",
    progress: 55,
    icon: <Loader2 className="size-8 animate-spin text-primary" />,
  };
}

function ImportProgressDialog({
  open,
  onOpenChange,
  stage,
  result,
  elapsedSeconds,
  filters,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: ImportStage;
  result: RmRequisicaoImportResponse | null;
  elapsedSeconds: number;
  filters: {
    tipo: string;
    statusFilter: StatusFilter;
    dataDe: string;
    dataAte: string;
  };
  onRefresh: () => void;
}) {
  const meta = importStageMeta(stage, result);
  const isFinished = stage === "success" || stage === "error";
  const statusLabel = filters.statusFilter === "all"
    ? "Em andamento, aprovadas e em aprovação"
    : filters.statusFilter === "1"
      ? "Em andamento"
      : filters.statusFilter === "5"
        ? "Em aprovação (consulta)"
        : "Aprovadas";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl" showCloseButton={isFinished}>
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{meta.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {stage === "running" && "Processando no RM..."}
                    {stage === "refreshing" && "Sincronizando a tela..."}
                    {stage === "success" && "Dados prontos para conferência"}
                    {stage === "error" && "Revise o resultado da importação"}
                    {stage === "idle" && "Aguardando início"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tempo decorrido: {formatElapsed(elapsedSeconds)}
                  </div>
                </div>
                <Progress value={meta.progress} className="mt-3" />
                {!isFinished && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Esta etapa consulta um sistema externo e pode levar alguns instantes. Mantenha esta janela aberta até o fim do processamento.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border p-3 text-sm sm:grid-cols-2">
            <DetailField label="Tipo" value={filters.tipo ? formatTipoRequisicao(filters.tipo) : "Todos os tipos"} />
            <DetailField label="Status importado" value={statusLabel} />
            <DetailField label="Abertura de" value={filters.dataDe || "Sem filtro"} />
            <DetailField label="Abertura até" value={filters.dataAte || "Sem filtro"} />
          </div>

          {result && (
            <div className={`rounded-xl border p-4 text-sm ${
              result.erros > 0
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}>
              <div className="font-semibold">Resumo da importação</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Lidas" value={result.totalLidos} />
                <Metric label="Criadas" value={result.criados} />
                <Metric label="Atualizadas" value={result.atualizados} />
                <Metric label="Vagas criadas" value={result.vagasCriadas} />
                <Metric label="Ignoradas" value={result.ignorados} />
                <Metric label="Erros" value={result.erros} />
              </div>
              {result.mensagens.length > 0 && (
                <details className="mt-3" open={result.erros > 0}>
                  <summary className="cursor-pointer text-xs font-medium">Ver mensagens ({result.mensagens.length})</summary>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md bg-background/70 p-2 text-xs">
                    {result.mensagens.slice(0, 150).map((msg, index) => (
                      <li key={`${index}-${msg}`}>{msg}</li>
                    ))}
                  </ul>
                  {result.mensagens.length > 150 && (
                    <p className="mt-2 text-xs opacity-80">Exibindo as primeiras 150 mensagens.</p>
                  )}
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {isFinished && (
            <>
              <Button variant="outline" onClick={onRefresh}>
                <RefreshCw className="size-4" />
                Atualizar lista
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RmRequisicaoDetail({ row }: { row: RmRequisicaoRow }) {
  const sections: Array<{ title: string; items: Array<[string, string | number | boolean | null]> }> = [
    {
      title: "Identificação",
      items: [
        ["Tipo", formatTipoRequisicao(row.tipoRequisicao)],
        ["Coligada da requisição", row.codcolrequisicao],
        ["IDREQ", row.idreq],
        ["Status", row.statusDescricao ?? (row.codstatus != null ? `CODSTATUS ${row.codstatus}` : null)],
        ["CODSTATUS", row.codstatus],
        ["Status permite alterar", row.statusPermiteAlterar],
      ],
    },
    {
      title: "Datas",
      items: [
        ["Abertura", formatDt(row.dataabertura)],
        ["Prevista", formatDt(row.dataprevista)],
        ["Conclusão", formatDt(row.dataconclusao)],
        ["Cancelamento", formatDt(row.datacancelamento)],
        ["Criado no RM", formatDt(row.reccreatedon)],
        ["Modificado no RM", formatDt(row.recmodifiedon)],
      ],
    },
    {
      title: "Requisitante",
      items: [
        ["Nome", row.nomeRequisitante],
        ["Chapa", row.chaparequisitante],
        ["Coligada", row.codcolrequisitante],
        ["Criado por", row.reccreatedby],
        ["Modificado por", row.recmodifiedby],
      ],
    },
    {
      title: "Funcionário / Substituição",
      items: [
        ["Chapa funcionário", row.chapaFuncionario],
        ["Funcionário envolvido", row.nomeFuncionarioEnvolvido],
        ["Chapa substituto", row.chapaSubstituto],
        ["Funcionário substituto", row.nomeFuncionarioSubstituto],
      ],
    },
    {
      title: "Vaga / Função",
      items: [
        ["Número de vagas", row.numvagas],
        ["Código filial", row.codfilial],
        ["Código seção", row.codsecao],
        ["Código centro de custo", row.codccusto],
        ["Código função", row.codfuncao],
        ["Função", row.nomeFuncao],
        ["Descrição função", row.descricaoFuncao],
        ["Salário", formatMoney(row.vlrsalario)],
        ["Tabela salarial", row.codtabelasalarial],
        ["Nível salarial", row.codnivelsalarial],
        ["Faixa salarial", row.codfaixasalarial],
      ],
    },
    {
      title: "Atendimento / Vínculos",
      items: [
        ["Código atendimento", row.codatendimento],
        ["Código local", row.codlocal],
        ["Assunto atendimento", row.atendimentoAssunto],
        ["Tipo requisição pai", row.tiporeqpai],
        ["ID requisição pai", row.idreqpai],
      ],
    },
  ];

  return (
    <div className="max-h-[68vh] overflow-y-auto pr-1">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="text-xs font-medium uppercase text-muted-foreground">Justificativa</div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{row.justificativa ?? "—"}</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">{section.title}</div>
            <div className="grid gap-2">
              {section.items.map(([label, value]) => (
                <DetailField key={label} label={label} value={value} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | boolean | null }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[150px_1fr]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{value == null || value === "" ? "—" : String(value)}</div>
    </div>
  );
}
