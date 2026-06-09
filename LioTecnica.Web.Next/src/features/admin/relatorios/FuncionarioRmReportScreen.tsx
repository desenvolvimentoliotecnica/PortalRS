"use client";

import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Download,
  Eye,
  FileSpreadsheet,
  IdCard,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  UserRound,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReportColumn {
  key: string;
  label: string;
  description: string;
}

interface ReportResponse {
  generatedAtUtc: string;
  totalItems: number;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}

const DEFAULT_TAKE = 5000;
type ReportRow = Record<string, unknown>;

function formatCell(value: unknown, key?: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if ((key === "salarioAtual"
    || key === "movimentacaoSalarioOrigem"
    || key === "movimentacaoSalarioDestino"
    || key === "movimentacaoSalarioAnterior"
    || key === "movimentacaoDiferencaSalarioAnterior")
    && typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (key === "movimentacaoPercentualSalarioAnterior" && typeof value === "number") {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
      const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    }
    return value;
  }
  return String(value);
}

function exportXlsx(data: ReportResponse) {
  const rows = data.rows.map((row) => Object.fromEntries(
    data.columns.map((column) => [column.label, formatCell(row[column.key], column.key)]),
  ));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: data.columns.map((column) => column.label),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Funcionarios RM");
  XLSX.writeFile(workbook, `relatorio-funcionarios-rm-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function cellText(row: ReportRow | null | undefined, key: string) {
  if (!row) return "—";
  return formatCell(row[key], key);
}

function firstCellText(rows: ReportRow[], keys: string[]) {
  for (const row of rows) {
    for (const key of keys) {
      const text = cellText(row, key);
      if (text !== "—") return text;
    }
  }
  return "—";
}

function rowString(row: ReportRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value.trim() : "";
}

function employeeGroupKey(row: ReportRow) {
  return rowString(row, "matriculaRm")
    || rowString(row, "cdnFuncionario")
    || rowString(row, "cpf")
    || rowString(row, "nome");
}

function movementTimestamp(row: ReportRow) {
  const value = row.movimentacaoPeriodoInicio ?? row.movimentacaoDataConclusao ?? row.movimentacaoDataAbertura;
  if (typeof value !== "string") return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getEmployeeRows(allRows: ReportRow[], selectedRow: ReportRow | null) {
  if (!selectedRow) return [];
  const key = employeeGroupKey(selectedRow);
  if (!key) return [selectedRow];
  return allRows.filter((row) => employeeGroupKey(row) === key);
}

function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`border-b border-slate-200 py-1.5 ${className}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SectionTitle({ number, children }: { number: number; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">{number}</span>
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-blue-900">{children}</h3>
    </div>
  );
}

function SummaryLine({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[22px_1fr_1.3fr] items-center gap-2 border-b border-slate-200 py-2 text-xs">
      <Icon className="size-4 text-blue-800" />
      <span className="font-bold text-slate-600">{label}</span>
      <span className="font-extrabold text-slate-900">{value}</span>
    </div>
  );
}

function EmployeeSheet({
  selectedRow,
  rows,
}: {
  selectedRow: ReportRow | null;
  rows: ReportRow[];
}) {
  const employeeRows = getEmployeeRows(rows, selectedRow);
  const baseRow = selectedRow ?? employeeRows[0] ?? null;
  const movements = employeeRows
    .filter((row) => cellText(row, "movimentacaoIdReqRm") !== "—")
    .sort((a, b) => movementTimestamp(b) - movementTimestamp(a));
  const timeline = [...movements].sort((a, b) => movementTimestamp(a) - movementTimestamp(b));
  const employeeName = firstCellText(employeeRows, ["nome"]);
  const currentStatus = firstCellText(employeeRows, ["situacaoRm", "codSituacaoRm", "statusPortal"]);
  const currentFunction = firstCellText(employeeRows, ["codFuncaoRm", "funcaoNomeRm", "jobPositionCode"]);
  const currentCostCenter = firstCellText(employeeRows, ["centroCustoCode", "centroCustoDescricao"]);
  const latestMovement = movements[0] ? firstCellText([movements[0]], ["movimentacaoTipoCodigo", "movimentacaoTipo"]) : "—";

  return (
    <div className="max-h-[82vh] overflow-auto rounded-xl bg-slate-100 p-4">
      <article className="mx-auto max-w-[1120px] rounded-sm bg-white p-6 text-slate-900 shadow-xl">
        <header className="mb-4 border-b-2 border-blue-900 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-full border bg-slate-100">
                <UserRound className="size-12 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal RH 2.0 · Dados cadastrais e histórico funcional</p>
                <h2 className="text-3xl font-black uppercase tracking-tight text-blue-950">Ficha do Funcionário</h2>
                <p className="mt-1 text-lg font-extrabold uppercase text-blue-900">{employeeName}</p>
              </div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
              <BadgeCheck className="mr-1 inline size-4" />
              {currentStatus}
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-lg border border-slate-300 p-3">
            <SectionTitle number={1}>Identificação</SectionTitle>
            <dl className="grid gap-x-4 md:grid-cols-2">
              <InfoItem label="Nome" value={employeeName} />
              <InfoItem label="Matrícula RM" value={cellText(baseRow, "matriculaRm")} />
              <InfoItem label="Empresa" value={cellText(baseRow, "cdnEmpresa")} />
              <InfoItem label="Estab." value={cellText(baseRow, "cdnEstab")} />
              <InfoItem label="Status Portal" value={cellText(baseRow, "statusPortal")} />
              <InfoItem label="Situação RM" value={currentStatus} />
              <InfoItem label="Data admissão" value={cellText(baseRow, "dataAdmissao")} />
              <InfoItem label="Atualizado em" value={cellText(baseRow, "updatedAtUtc")} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-300 p-3">
            <SectionTitle number={2}>Resumo funcional</SectionTitle>
            <SummaryLine icon={BriefcaseBusiness} label="Função atual" value={currentFunction} />
            <SummaryLine icon={Building2} label="Centro de custo" value={currentCostCenter} />
            <SummaryLine icon={UserRound} label="Gestor atual" value={cellText(baseRow, "gestorDiretoNome")} />
            <SummaryLine icon={TrendingUp} label="Salário atual" value={cellText(baseRow, "salarioAtual")} />
            <SummaryLine icon={CalendarDays} label="Última movimentação" value={latestMovement} />
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-300 p-3">
            <SectionTitle number={3}>Contato e dados pessoais</SectionTitle>
            <dl className="grid gap-x-4 md:grid-cols-2">
              <InfoItem label="E-mail" value={cellText(baseRow, "email")} />
              <InfoItem label="Telefone" value={cellText(baseRow, "telefone")} />
              <InfoItem label="CPF" value={cellText(baseRow, "cpf")} />
              <InfoItem label="Data nascimento" value={cellText(baseRow, "dataNascimento")} />
              <InfoItem label="Sexo" value={cellText(baseRow, "sexo")} />
              <InfoItem label="Estado civil" value={cellText(baseRow, "estadoCivil")} />
              <InfoItem label="Grau instrução" value={cellText(baseRow, "grauInstrucao")} />
              <InfoItem label="Nacionalidade" value={cellText(baseRow, "nacionalidade")} />
              <InfoItem label="Nome do pai" value={cellText(baseRow, "nomePai")} />
              <InfoItem label="Nome da mãe" value={cellText(baseRow, "nomeMae")} />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-300 p-3">
            <SectionTitle number={4}>Endereço e documentos</SectionTitle>
            <dl className="grid gap-x-4 md:grid-cols-2">
              <InfoItem label="CEP" value={cellText(baseRow, "cep")} />
              <InfoItem label="Logradouro" value={cellText(baseRow, "logradouro")} />
              <InfoItem label="Número" value={cellText(baseRow, "numeroEndereco")} />
              <InfoItem label="Bairro" value={cellText(baseRow, "bairro")} />
              <InfoItem label="Cidade/UF" value={`${cellText(baseRow, "cidade")} / ${cellText(baseRow, "uf")}`} />
              <InfoItem label="RG" value={cellText(baseRow, "rg")} />
              <InfoItem label="CTPS" value={cellText(baseRow, "carteiraTrabalho")} />
              <InfoItem label="PIS/PASEP" value={cellText(baseRow, "numeroPis")} />
            </dl>
          </section>
        </div>

        <section className="mt-4 rounded-lg border border-slate-300 p-3">
          <SectionTitle number={5}>Histórico de movimentações</SectionTitle>
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-xs">
              <thead>
                <tr className="bg-blue-900 text-left text-white">
                  <th className="px-2 py-2">Mov. ID RM</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Abertura</th>
                  <th className="px-2 py-2">Conclusão</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Salário origem</th>
                  <th className="px-2 py-2">Salário destino</th>
                  <th className="px-2 py-2">Período</th>
                  <th className="px-2 py-2">Tempo</th>
                  <th className="px-2 py-2">Gestor hist.</th>
                  <th className="px-2 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {movements.length ? movements.map((row, index) => (
                  <tr key={`${row.movimentacaoIdReqRm ?? index}`} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="border px-2 py-2 font-semibold">{cellText(row, "movimentacaoIdReqRm")}</td>
                    <td className="border px-2 py-2">{firstCellText([row], ["movimentacaoTipoCodigo", "movimentacaoTipo"])}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoDataAbertura")}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoDataConclusao")}</td>
                    <td className="border px-2 py-2 text-green-700">{firstCellText([row], ["movimentacaoCodStatus", "movimentacaoStatus"])}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoSalarioOrigem")}</td>
                    <td className="border px-2 py-2 font-bold">{cellText(row, "movimentacaoSalarioDestino")}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoPeriodoInicio")} a {cellText(row, "movimentacaoPeriodoFim")}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoTempoFuncao")}</td>
                    <td className="border px-2 py-2">{firstCellText([row], ["movimentacaoGestorHistoricoChapaRm", "movimentacaoGestorHistoricoNome"])}</td>
                    <td className="border px-2 py-2">{cellText(row, "movimentacaoJustificativa")}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={11} className="border px-3 py-6 text-center text-slate-500">Sem movimentações no resultado atual.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-slate-300 p-3">
          <SectionTitle number={6}>Timeline da carreira</SectionTitle>
          {timeline.length ? (
            <div className="grid gap-3 md:grid-cols-4">
              {timeline.map((row, index) => (
                <div key={`${row.movimentacaoIdReqRm ?? index}-timeline`} className="relative rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-blue-800 text-xs font-bold text-white">{index + 1}</div>
                  <p className="text-xs font-bold text-blue-950">{cellText(row, "movimentacaoPeriodoInicio")}</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{firstCellText([row], ["movimentacaoTipoCodigo", "movimentacaoTipo"])}</p>
                  <p className="mt-2 inline-block rounded bg-white px-2 py-1 text-xs font-black text-blue-900">{cellText(row, "movimentacaoSalarioDestino")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Use o modo &quot;Com movimentações&quot; para visualizar a timeline completa.</p>
          )}
        </section>

        <footer className="mt-5 text-center text-xs font-semibold text-slate-400">
          Documento gerado a partir dos dados do relatório RM no Portal RH.
        </footer>
      </article>
    </div>
  );
}

export default function FuncionarioRmReportScreen() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const [somenteRm, setSomenteRm] = useState(true);
  const [incluirMovimentacoes, setIncluirMovimentacoes] = useState(false);
  const [take, setTake] = useState(DEFAULT_TAKE);
  const [selectedFichaRow, setSelectedFichaRow] = useState<ReportRow | null>(null);
  const requestSeqRef = useRef(0);

  const load = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        somenteRm: String(somenteRm),
        incluirMovimentacoes: String(incluirMovimentacoes),
        take: String(take || DEFAULT_TAKE),
      });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);

      const res = await apiFetch(`/api/reports/funcionarios-rm?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string; detail?: string } | null;
        throw new Error(body?.message || body?.detail || `HTTP ${res.status}`);
      }
      const payload = await res.json() as ReportResponse;
      if (requestSeqRef.current === requestSeq) {
        setData(payload);
      }
    } catch (error) {
      if (requestSeqRef.current === requestSeq) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar relatório de funcionários RM.");
        setData(null);
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [incluirMovimentacoes, q, somenteRm, status, take]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCount = data?.rows.length ?? 0;
  const truncated = useMemo(
    () => !!data && data.totalItems > data.rows.length,
    [data],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-sm">Admin &gt; Relatórios</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Relatório de Funcionários RM</h1>
          <p className="text-muted-foreground text-sm">
            Dados importados do TOTVS RM e materializados no Portal para conferência em HTML.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={() => data && exportXlsx(data)} disabled={!data || loading}>
            <Download className="size-4" /> Exportar XLSX
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_160px_160px_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
              placeholder="Buscar por nome, matrícula, CPF, centro de custo..."
              className="pl-8"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos status</option>
            <option value="Active">Ativos</option>
            <option value="Inactive">Inativos</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={somenteRm ? "true" : "false"}
            onChange={(e) => setSomenteRm(e.target.value === "true")}
          >
            <option value="true">Somente RM</option>
            <option value="false">Todos</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={incluirMovimentacoes ? "movimentacoes" : "consolidado"}
            onChange={(e) => setIncluirMovimentacoes(e.target.value === "movimentacoes")}
            title="Modo do relatório"
          >
            <option value="consolidado">Consolidado</option>
            <option value="movimentacoes">Com movimentações</option>
          </select>
          <Input
            type="number"
            min={1}
            max={10000}
            value={take}
            onChange={(e) => setTake(Number(e.target.value) || DEFAULT_TAKE)}
            title="Limite de linhas"
          />
          <Button onClick={() => void load()} disabled={loading}>Aplicar</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Registros encontrados</p>
          <p className="mt-1 text-2xl font-bold">{data?.totalItems ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Exibidos na tela</p>
          <p className="mt-1 text-2xl font-bold text-primary">{visibleCount}</p>
          {incluirMovimentacoes && (
            <p className="mt-1 text-xs text-muted-foreground">1 linha por movimentação; funcionários sem histórico aparecem com movimentação em branco.</p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gerado em</p>
          <p className="mt-1 text-sm font-semibold">
            {data?.generatedAtUtc ? new Date(data.generatedAtUtc).toLocaleString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      {truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O relatório possui mais linhas do que o limite atual. Aumente o limite até 10.000 ou refine os filtros.
        </div>
      )}

      <details className="group rounded-xl border border-border/50 bg-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            <span className="font-semibold">Descrição dos campos</span>
          </span>
          <span className="text-xs text-muted-foreground group-open:hidden">Expandir</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
        </summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(data?.columns ?? []).map((column) => (
            <div key={column.key} className="rounded-lg border border-border/40 bg-background p-3">
              <div className="text-sm font-semibold">{column.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{column.description}</div>
            </div>
          ))}
        </div>
      </details>

      <div className="rounded-xl border border-border/50 bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Tabela HTML</h2>
          <p className="text-xs text-muted-foreground">
            Use a rolagem horizontal para visualizar todos os dados do relatório.
            {incluirMovimentacoes ? " Neste modo, cada movimentação gera uma linha." : ""}
          </p>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[3600px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="sticky left-0 z-20 border-b border-r bg-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ficha
                </th>
                {(data?.columns ?? []).map((column) => (
                  <th
                    key={column.key}
                    className="border-b border-r px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    title={column.description}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={(data?.columns.length || 0) + 1}>
                    Carregando relatório...
                  </td>
                </tr>
              ) : data?.rows.length ? (
                data.rows.map((row, idx) => (
                  <tr key={`${row.matriculaRm ?? row.cdnFuncionario ?? idx}`} className={idx % 2 ? "bg-muted/25" : ""}>
                    <td className={`sticky left-0 z-10 whitespace-nowrap border-b border-r px-3 py-2 ${idx % 2 ? "bg-muted" : "bg-background"}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedFichaRow(row)}
                        title="Ver ficha do funcionário"
                      >
                        <Eye className="size-4" />
                        Ficha
                      </Button>
                    </td>
                    {data.columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap border-b border-r px-3 py-2">
                        {formatCell(row[column.key], column.key)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={(data?.columns.length || 0) + 1}>
                    Nenhum funcionário encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedFichaRow} onOpenChange={(open) => !open && setSelectedFichaRow(null)}>
        <DialogContent className="max-h-[95vh] max-w-[96vw] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="size-5 text-primary" />
              Ficha do funcionário
            </DialogTitle>
            <DialogDescription>
              Visualização em formato de ficha impressa com histórico funcional e timeline da carreira.
            </DialogDescription>
          </DialogHeader>
          <EmployeeSheet selectedRow={selectedFichaRow} rows={data?.rows ?? []} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
