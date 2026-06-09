"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
type ReportDataSource = "portal" | "rm-live";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function infoItem(label: string, value: string) {
  return `<div class="info-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function sectionTitle(number: number, title: string) {
  return `<div class="section-title"><span>${number}</span><h3>${escapeHtml(title)}</h3></div>`;
}

function summaryLine(label: string, value: string) {
  return `<div class="summary-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildEmployeeSheetHtml(selectedRow: ReportRow, rows: ReportRow[]) {
  const employeeRows = getEmployeeRows(rows, selectedRow);
  const baseRow = selectedRow ?? employeeRows[0];
  const movements = employeeRows
    .filter((row) => cellText(row, "movimentacaoIdReqRm") !== "—")
    .sort((a, b) => movementTimestamp(b) - movementTimestamp(a));
  const timeline = [...movements].sort((a, b) => movementTimestamp(a) - movementTimestamp(b));
  const employeeName = firstCellText(employeeRows, ["nome"]);
  const currentStatus = firstCellText(employeeRows, ["situacaoRm", "codSituacaoRm", "statusPortal"]);
  const currentFunction = firstCellText(employeeRows, ["codFuncaoRm", "funcaoNomeRm", "jobPositionCode"]);
  const currentCostCenter = firstCellText(employeeRows, ["centroCustoCode", "centroCustoDescricao"]);
  const latestMovement = movements[0] ? firstCellText([movements[0]], ["movimentacaoTipoCodigo", "movimentacaoTipo"]) : "—";

  const movementRows = movements.length
    ? movements.map((row, index) => `
      <tr class="${index % 2 ? "muted" : ""}">
        <td>${escapeHtml(cellText(row, "movimentacaoIdReqRm"))}</td>
        <td>${escapeHtml(firstCellText([row], ["movimentacaoTipoCodigo", "movimentacaoTipo"]))}</td>
        <td>${escapeHtml(cellText(row, "movimentacaoDataAbertura"))}</td>
        <td>${escapeHtml(cellText(row, "movimentacaoDataConclusao"))}</td>
        <td class="ok">${escapeHtml(firstCellText([row], ["movimentacaoCodStatus", "movimentacaoStatus"]))}</td>
        <td>${escapeHtml(cellText(row, "movimentacaoSalarioOrigem"))}</td>
        <td><strong>${escapeHtml(cellText(row, "movimentacaoSalarioDestino"))}</strong></td>
        <td>${escapeHtml(cellText(row, "movimentacaoPeriodoInicio"))} a ${escapeHtml(cellText(row, "movimentacaoPeriodoFim"))}</td>
        <td>${escapeHtml(cellText(row, "movimentacaoTempoFuncao"))}</td>
        <td>${escapeHtml(firstCellText([row], ["movimentacaoGestorHistoricoChapaRm", "movimentacaoGestorHistoricoNome"]))}</td>
        <td>${escapeHtml(cellText(row, "movimentacaoJustificativa"))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="11" class="empty">Sem movimentações no resultado atual.</td></tr>`;

  const timelineItems = timeline.length
    ? timeline.map((row, index) => `
      <div class="timeline-card">
        <div class="timeline-index">${index + 1}</div>
        <div class="timeline-date">${escapeHtml(cellText(row, "movimentacaoPeriodoInicio"))}</div>
        <div class="timeline-title">${escapeHtml(firstCellText([row], ["movimentacaoTipoCodigo", "movimentacaoTipo"]))}</div>
        <div class="timeline-salary">${escapeHtml(cellText(row, "movimentacaoSalarioDestino"))}</div>
      </div>
    `).join("")
    : `<p class="empty-text">Use o modo "Com movimentações" para visualizar a timeline completa.</p>`;

  const title = `Ficha do Funcionário - ${employeeName}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --blue:#0b3f75; --line:#cbd5e1; --muted:#f8fafc; --text:#0f172a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e2e8f0; color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--line); }
    .toolbar button { border: 1px solid var(--line); border-radius: 8px; background: var(--blue); color: #fff; padding: 8px 14px; font-weight: 700; cursor: pointer; }
    .page { width: 1120px; margin: 24px auto; background: #fff; padding: 28px; box-shadow: 0 20px 50px rgba(15,23,42,.18); }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid var(--blue); padding-bottom: 18px; }
    .brand { display: flex; gap: 18px; align-items: center; }
    .avatar { width: 82px; height: 82px; border-radius: 999px; display: grid; place-items: center; border: 1px solid var(--line); background: #f1f5f9; font-size: 42px; color: #64748b; }
    h1 { margin: 0; color: #0f2f5f; font-size: 34px; letter-spacing: -.02em; text-transform: uppercase; }
    .subtitle { margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .employee-name { margin: 4px 0 0; color: var(--blue); font-size: 18px; font-weight: 900; text-transform: uppercase; }
    .status { align-self: start; border: 1px solid #bbf7d0; background: #f0fdf4; color: #15803d; border-radius: 10px; padding: 10px 16px; font-weight: 800; }
    .grid { display: grid; gap: 16px; margin-top: 16px; }
    .grid.two { grid-template-columns: 1.5fr 1fr; }
    .grid.half { grid-template-columns: 1fr 1fr; }
    section { border: 1px solid var(--line); border-radius: 10px; padding: 14px; break-inside: avoid; }
    .section-title { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .section-title span { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 5px; background: var(--blue); color: #fff; font-size: 12px; font-weight: 900; }
    .section-title h3 { margin: 0; color: var(--blue); font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
    dl { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; margin: 0; }
    .info-item { border-bottom: 1px solid #e2e8f0; padding: 7px 0; }
    .info-item dt { color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
    .info-item dd { margin: 3px 0 0; font-size: 12px; font-weight: 800; }
    .summary-line { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 9px 0; font-size: 12px; }
    .summary-line span { color: #475569; font-weight: 800; }
    .summary-line strong { font-weight: 900; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: var(--blue); color: #fff; text-align: left; padding: 8px; }
    td { border: 1px solid #dbe3ef; padding: 7px; vertical-align: top; }
    tr.muted td { background: var(--muted); }
    .ok { color: #15803d; font-weight: 800; }
    .empty, .empty-text { color: #64748b; text-align: center; padding: 18px; }
    .timeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .timeline-card { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 12px; }
    .timeline-index { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: var(--blue); color: #fff; font-weight: 900; font-size: 12px; }
    .timeline-date { margin-top: 8px; color: #0f2f5f; font-size: 11px; font-weight: 900; }
    .timeline-title { margin-top: 4px; font-size: 13px; font-weight: 900; }
    .timeline-salary { display: inline-block; margin-top: 10px; border-radius: 5px; background: #fff; color: var(--blue); padding: 5px 8px; font-size: 12px; font-weight: 900; }
    footer { margin-top: 18px; text-align: center; color: #94a3b8; font-size: 11px; font-weight: 700; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { width: auto; margin: 0; padding: 0; box-shadow: none; }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir ficha</button></div>
  <main class="page">
    <header>
      <div class="brand">
        <div class="avatar">👤</div>
        <div>
          <p class="subtitle">Portal RH 2.0 · Dados cadastrais e histórico funcional</p>
          <h1>Ficha do Funcionário</h1>
          <p class="employee-name">${escapeHtml(employeeName)}</p>
        </div>
      </div>
      <div class="status">${escapeHtml(currentStatus)}</div>
    </header>
    <div class="grid two">
      <section>
        ${sectionTitle(1, "Identificação")}
        <dl>
          ${infoItem("Nome", employeeName)}
          ${infoItem("Matrícula RM", cellText(baseRow, "matriculaRm"))}
          ${infoItem("Empresa", cellText(baseRow, "cdnEmpresa"))}
          ${infoItem("Estab.", cellText(baseRow, "cdnEstab"))}
          ${infoItem("Status Portal", cellText(baseRow, "statusPortal"))}
          ${infoItem("Situação RM", currentStatus)}
          ${infoItem("Data admissão", cellText(baseRow, "dataAdmissao"))}
          ${infoItem("Atualizado em", cellText(baseRow, "updatedAtUtc"))}
        </dl>
      </section>
      <section>
        ${sectionTitle(2, "Resumo funcional")}
        ${summaryLine("Função atual", currentFunction)}
        ${summaryLine("Centro de custo", currentCostCenter)}
        ${summaryLine("Gestor atual", cellText(baseRow, "gestorDiretoNome"))}
        ${summaryLine("Salário atual", cellText(baseRow, "salarioAtual"))}
        ${summaryLine("Última movimentação", latestMovement)}
      </section>
    </div>
    <div class="grid half">
      <section>
        ${sectionTitle(3, "Contato e dados pessoais")}
        <dl>
          ${infoItem("E-mail", cellText(baseRow, "email"))}
          ${infoItem("Telefone", cellText(baseRow, "telefone"))}
          ${infoItem("CPF", cellText(baseRow, "cpf"))}
          ${infoItem("Data nascimento", cellText(baseRow, "dataNascimento"))}
          ${infoItem("Sexo", cellText(baseRow, "sexo"))}
          ${infoItem("Estado civil", cellText(baseRow, "estadoCivil"))}
          ${infoItem("Grau instrução", cellText(baseRow, "grauInstrucao"))}
          ${infoItem("Nacionalidade", cellText(baseRow, "nacionalidade"))}
          ${infoItem("Nome do pai", cellText(baseRow, "nomePai"))}
          ${infoItem("Nome da mãe", cellText(baseRow, "nomeMae"))}
        </dl>
      </section>
      <section>
        ${sectionTitle(4, "Endereço e documentos")}
        <dl>
          ${infoItem("CEP", cellText(baseRow, "cep"))}
          ${infoItem("Logradouro", cellText(baseRow, "logradouro"))}
          ${infoItem("Número", cellText(baseRow, "numeroEndereco"))}
          ${infoItem("Bairro", cellText(baseRow, "bairro"))}
          ${infoItem("Cidade/UF", `${cellText(baseRow, "cidade")} / ${cellText(baseRow, "uf")}`)}
          ${infoItem("RG", cellText(baseRow, "rg"))}
          ${infoItem("CTPS", cellText(baseRow, "carteiraTrabalho"))}
          ${infoItem("PIS/PASEP", cellText(baseRow, "numeroPis"))}
        </dl>
      </section>
    </div>
    <section class="grid">
      ${sectionTitle(5, "Histórico de movimentações")}
      <table>
        <thead>
          <tr>
            <th>Mov. ID RM</th><th>Tipo</th><th>Abertura</th><th>Conclusão</th><th>Status</th>
            <th>Salário origem</th><th>Salário destino</th><th>Período</th><th>Tempo</th><th>Gestor hist.</th><th>Observação</th>
          </tr>
        </thead>
        <tbody>${movementRows}</tbody>
      </table>
    </section>
    <section class="grid">
      ${sectionTitle(6, "Timeline da carreira")}
      <div class="timeline">${timelineItems}</div>
    </section>
    <footer>Documento gerado a partir dos dados do relatório RM no Portal RH.</footer>
  </main>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 400));
  </script>
</body>
</html>`;
}

function openEmployeeSheetPrintTab(row: ReportRow, rows: ReportRow[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Não foi possível abrir a nova aba. Verifique o bloqueador de pop-ups do navegador.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildEmployeeSheetHtml(row, rows));
  printWindow.document.close();
}

export default function FuncionarioRmReportScreen() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const [somenteRm, setSomenteRm] = useState(true);
  const [incluirMovimentacoes, setIncluirMovimentacoes] = useState(false);
  const [take, setTake] = useState(DEFAULT_TAKE);
  const [dataSource, setDataSource] = useState<ReportDataSource>("portal");
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

      const endpoint = dataSource === "rm-live"
        ? "/api/reports/funcionarios-rm-live"
        : "/api/reports/funcionarios-rm";
      const res = await apiFetch(`${endpoint}?${params.toString()}`, {
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
  }, [dataSource, incluirMovimentacoes, q, somenteRm, status, take]);

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
            Dados de funcionários RM para conferência em HTML, com opção de consulta ao RM em tempo real.
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
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_160px_160px_160px_auto]">
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
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value as ReportDataSource)}
            title="Fonte dos dados"
          >
            <option value="portal">Portal sincronizado</option>
            <option value="rm-live">RM tempo real</option>
          </select>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Fonte: {dataSource === "rm-live" ? "Banco RM em tempo real" : "Portal sincronizado"}
          </p>
        </div>
      </div>

      {dataSource === "rm-live" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Modo RM tempo real: a API do Portal consulta diretamente o banco do RM e não usa os dados de funcionários/movimentações já sincronizados no Portal.
        </div>
      )}

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
                        onClick={() => openEmployeeSheetPrintTab(row, data?.rows ?? [])}
                        title="Abrir ficha do funcionário em nova aba"
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
    </section>
  );
}
