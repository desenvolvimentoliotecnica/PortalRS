"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
  codcolrequisitante: number | null;
  chaparequisitante: string | null;
  nomeRequisitante: string | null;
  chapaFuncionario: string | null;
  nomeFuncionarioEnvolvido: string | null;
  nomeFuncionarioSubstituto: string | null;
  nomeFuncao: string | null;
  vlrsalario: string | number | null;
}

interface RmRequisicaoListResponse {
  items: RmRequisicaoRow[];
  totalCount: number;
}

function formatDt(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR");
}

export default function AdminRmRequisicoesScreen() {
  const [rows, setRows] = useState<RmRequisicaoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [tipo, setTipo] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

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

      const res = await apiFetch(`/api/rm/requisicoes?${params}`, { cache: "no-store" });
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
    } catch {
      toast.error("Falha ao carregar requisições do RM.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, tipo, dataDe, dataAte, qDebounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 size-6 text-primary" />
          <div>
            <h4 className="text-lg font-bold">Requisições RM</h4>
            <p className="text-muted-foreground text-sm">
              Lista consolidada do CORPORERM (somente leitura).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                <TableHead>Abertura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requisitante</TableHead>
                <TableHead>Envolvido / substituto</TableHead>
                <TableHead>Função / salário</TableHead>
                <TableHead>Justificativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                    Nenhuma requisição encontrada (ou integração RM não configurada).
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={`${r.tipoRequisicao}-${r.idreq}-${r.codcolrequisicao ?? ""}`}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDt(r.dataabertura)}
                    </TableCell>
                    <TableCell className="max-w-[140px] text-xs font-medium">
                      {r.tipoRequisicao}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.idreq}</TableCell>
                    <TableCell className="max-w-[160px] text-xs">
                      {r.statusDescricao ?? (r.codstatus != null ? String(r.codstatus) : "—")}
                    </TableCell>
                    <TableCell className="max-w-[180px] text-xs">
                      <div className="truncate" title={r.nomeRequisitante ?? ""}>
                        {r.nomeRequisitante ?? r.chaparequisitante ?? "—"}
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
                      <div className="truncate">{r.nomeFuncao ?? "—"}</div>
                      {r.vlrsalario != null && r.vlrsalario !== "" && (
                        <div className="text-muted-foreground text-[11px]">
                          {typeof r.vlrsalario === "number"
                            ? r.vlrsalario.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : String(r.vlrsalario)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-xs">
                      <div className="line-clamp-2">{r.justificativa ?? "—"}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
