"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  DownloadCloud,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { value: "PROMOCAO_ALTERACAO_FUNCIONAL", label: "Promoção / alteração funcional" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "TRANSFERENCIA_PROMOCAO", label: "Transferência + promoção" },
  { value: "TRANSFERENCIA_LOTE", label: "Transferência em lote" },
  { value: "TREINAMENTO", label: "Treinamento" },
  { value: "GERAL", label: "Geral" },
] as const;

const CODSTATUS_VISIVEIS = [1, 3] as const;

type StatusFilter = "all" | "1" | "3";

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
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  const value = (tipo ?? "").trim();
  const labels: Record<string, string> = {
    AUMENTO_QUADRO: "Aumento de Quadro",
    SUBSTITUICAO: "Substituição",
    DESLIGAMENTO: "Desligamento",
    PROMOCAO_ALTERACAO_FUNCIONAL: "Promoção / Alteração Funcional",
    TRANSFERENCIA: "Transferência",
    TRANSFERENCIA_PROMOCAO: "Transferência + Promoção",
    TRANSFERENCIA_LOTE: "Transferência em Lote",
    TREINAMENTO: "Treinamento",
    GERAL: "Geral",
  };
  const fallback = value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
  return labels[value] ?? (fallback || "—");
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

export default function AdminRmRequisicoesScreen() {
  const [rows, setRows] = useState<RmRequisicaoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tipo, setTipo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [importing, setImporting] = useState(false);
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

      const res = await apiFetch(`/api/rm/requisicoes?${params}`, { cache: "no-store" }, 75_000);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string; title?: string } | null;
        const msg =
          typeof body?.detail === "string"
            ? body.detail
            : typeof body?.title === "string"
              ? body.title
              : `HTTP ${res.status}`;
        toast.error(msg);
        setRows([]);
        setTotal(0);
        return;
      }
      const data = (await res.json()) as RmRequisicaoListResponse;
      setRows(data.items ?? []);
      setTotal(data.totalCount ?? 0);
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao carregar requisições do RM.");
      toast.error(message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, tipo, statusFilter, dataDe, dataAte, qDebounced, sortKey, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importarAprovadas() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiFetch(
        "/api/rm/solicitacao-vaga/importar-aprovadas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageSize: 100,
            tipoRequisicao: tipo.trim() || null,
            dataAberturaDe: dataDe.trim() || null,
            dataAberturaAte: dataAte.trim() || null,
            codStatusIn: statusFilter === "all" ? [...CODSTATUS_VISIVEIS] : [Number(statusFilter)],
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
      toast.success(`Importação concluída: ${result.criados} criadas, ${result.atualizados} atualizadas, ${result.vagasCriadas} vagas criadas.`);
      await load();
    } catch (error) {
      const message = getErrorMessage(error, "Falha ao importar requisições aprovadas do RM.");
      toast.error(message);
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
              <Link href="/app/admin/rm-requisicao-status">Configurar mapas</Link>
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

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
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
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
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
