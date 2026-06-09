"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer, RefreshCw, Search } from "lucide-react";
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

function escapeTsv(value: unknown, key?: string) {
  return formatCell(value, key).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function exportTsv(data: ReportResponse) {
  const lines = [
    data.columns.map((c) => c.label).join("\t"),
    ...data.rows.map((row) => data.columns.map((c) => escapeTsv(row[c.key], c.key)).join("\t")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-funcionarios-rm-${new Date().toISOString().slice(0, 10)}.tsv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FuncionarioRmReportScreen() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const [somenteRm, setSomenteRm] = useState(true);
  const [incluirMovimentacoes, setIncluirMovimentacoes] = useState(false);
  const [take, setTake] = useState(DEFAULT_TAKE);

  const load = useCallback(async () => {
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
      setData(await res.json() as ReportResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar relatório de funcionários RM.");
      setData(null);
    } finally {
      setLoading(false);
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
          <Button variant="outline" onClick={() => data && exportTsv(data)} disabled={!data || loading}>
            <Download className="size-4" /> Exportar TSV
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
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={data?.columns.length || 1}>
                    Carregando relatório...
                  </td>
                </tr>
              ) : data?.rows.length ? (
                data.rows.map((row, idx) => (
                  <tr key={`${row.matriculaRm ?? row.cdnFuncionario ?? idx}`} className={idx % 2 ? "bg-muted/25" : ""}>
                    {data.columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap border-b border-r px-3 py-2">
                        {formatCell(row[column.key], column.key)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={data?.columns.length || 1}>
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
