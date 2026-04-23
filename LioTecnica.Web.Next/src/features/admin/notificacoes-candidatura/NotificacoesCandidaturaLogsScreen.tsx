"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Mail,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  BanIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  type CanalNotificacao,
  type EtapaMacroCandidatura,
  type NotificacaoCandidaturaLogItem,
  type NotificacaoStatus,
  listarNotificacoesCandidaturaLogs,
  resolveCanal,
  resolveEtapa,
  resolveStatusNotificacao,
} from "@/features/recrutamento/candidaturas/candidaturaApi";

const ETAPAS: EtapaMacroCandidatura[] = [
  "Aplicada",
  "EmTriagem",
  "Entrevista",
  "Teste",
  "Proposta",
  "Contratado",
  "Recusado",
  "Desistiu",
];

const CANAIS: CanalNotificacao[] = ["Email", "WhatsApp"];
const STATUSES: NotificacaoStatus[] = [
  "Enviado",
  "Falhou",
  "IgnoradoSemDestino",
  "IgnoradoSemOptIn",
];

const STATUS_LABELS: Record<NotificacaoStatus, string> = {
  Enviado: "Enviado",
  Falhou: "Falhou",
  IgnoradoSemDestino: "Sem destino",
  IgnoradoSemOptIn: "Sem opt-in",
};

const STATUS_COLORS: Record<NotificacaoStatus, string> = {
  Enviado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Falhou: "bg-red-100 text-red-800 border-red-200",
  IgnoradoSemDestino: "bg-amber-100 text-amber-800 border-amber-200",
  IgnoradoSemOptIn: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

function statusIcon(status: NotificacaoStatus) {
  switch (status) {
    case "Enviado":
      return <CheckCircle2 className="h-4 w-4" />;
    case "Falhou":
      return <AlertTriangle className="h-4 w-4" />;
    case "IgnoradoSemDestino":
      return <BanIcon className="h-4 w-4" />;
    case "IgnoradoSemOptIn":
      return <MinusCircle className="h-4 w-4" />;
  }
}

function canalIcon(canal: CanalNotificacao) {
  return canal === "WhatsApp" ? (
    <MessageSquare className="h-4 w-4 text-emerald-600" />
  ) : (
    <Mail className="h-4 w-4 text-sky-600" />
  );
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 25;

export default function NotificacoesCandidaturaLogsScreen() {
  const [items, setItems] = useState<NotificacaoCandidaturaLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [canal, setCanal] = useState<CanalNotificacao | "">("");
  const [status, setStatus] = useState<NotificacaoStatus | "">("");
  const [etapa, setEtapa] = useState<EtapaMacroCandidatura | "">("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [candidatoId, setCandidatoId] = useState<string>("");

  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listarNotificacoesCandidaturaLogs({
        page,
        pageSize: PAGE_SIZE,
        canal: canal || null,
        status: status || null,
        etapa: etapa || null,
        dataInicioUtc: dataInicio ? new Date(dataInicio).toISOString() : null,
        dataFimUtc: dataFim ? new Date(dataFim).toISOString() : null,
        candidatoId: candidatoId.trim() || null,
      });
      setItems(resp.items ?? []);
      setTotal(resp.total ?? 0);
      setTotalPages(resp.totalPages ?? 0);
    } catch {
      toast.error("Falha ao carregar logs de notificação.");
    } finally {
      setLoading(false);
    }
  }, [page, canal, status, etapa, dataInicio, dataFim, candidatoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const aplicarFiltros = () => {
    setPage(1);
    void load();
  };

  const limparFiltros = () => {
    setCanal("");
    setStatus("");
    setEtapa("");
    setDataInicio("");
    setDataFim("");
    setCandidatoId("");
    setPage(1);
  };

  const resumo = useMemo(() => {
    const base = { enviado: 0, falhou: 0, ignorado: 0 };
    items.forEach((item) => {
      const s = resolveStatusNotificacao(item.status);
      if (s === "Enviado") base.enviado++;
      else if (s === "Falhou") base.falhou++;
      else base.ignorado++;
    });
    return base;
  }, [items]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BellRing className="h-6 w-6 text-sky-600" />
          <div>
            <h1 className="text-2xl font-semibold">Notificações de Candidaturas</h1>
            <p className="text-sm text-zinc-600">
              Auditoria dos disparos por mudança de etapa macro (e-mail + WhatsApp).
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="text-xs font-medium text-zinc-600">Canal</label>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalNotificacao | "")}
          >
            <option value="">Todos</option>
            {CANAIS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Status</label>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as NotificacaoStatus | "")}
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Etapa</label>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            value={etapa}
            onChange={(e) => setEtapa(e.target.value as EtapaMacroCandidatura | "")}
          >
            <option value="">Todas</option>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">De</label>
          <Input
            type="datetime-local"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Até</label>
          <Input
            type="datetime-local"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Candidato ID</label>
          <Input
            placeholder="Guid..."
            value={candidatoId}
            onChange={(e) => setCandidatoId(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-6">
          <Button size="sm" onClick={aplicarFiltros}>
            Aplicar filtros
          </Button>
          <Button size="sm" variant="ghost" onClick={limparFiltros}>
            Limpar
          </Button>
          <div className="ml-auto flex items-center gap-4 text-xs text-zinc-600">
            <span>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {resumo.enviado} enviados
              </Badge>
            </span>
            <span>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                {resumo.falhou} falharam
              </Badge>
            </span>
            <span>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                {resumo.ignorado} ignorados
              </Badge>
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Data</TableHead>
              <TableHead className="w-28">Canal</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-32">Etapa</TableHead>
              <TableHead>Candidato</TableHead>
              <TableHead>Vaga</TableHead>
              <TableHead>Destino</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                  Nenhum log encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              const canalResolved = resolveCanal(item.canal);
              const statusResolved = resolveStatusNotificacao(item.status);
              const etapaResolved = resolveEtapa(item.etapaMacro);
              const isExpanded = expanded === item.id;
              return (
                <Fragment key={item.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                  >
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(item.criadoEmUtc)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        {canalIcon(canalResolved)}
                        {canalResolved}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[statusResolved]}>
                        <span className="flex items-center gap-1">
                          {statusIcon(statusResolved)}
                          {STATUS_LABELS[statusResolved]}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{etapaResolved}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{item.candidatoNome ?? "—"}</div>
                      <div className="text-xs text-zinc-500">{item.candidatoEmail ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.vagaTitulo ?? "—"}
                      {item.vagaCodigo ? (
                        <span className="ml-1 text-xs text-zinc-500">({item.vagaCodigo})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-600">
                      {item.destino ?? "—"}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-zinc-50/60">
                      <TableCell colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Mensagem
                            </div>
                            <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-3 text-sm text-zinc-800 ring-1 ring-zinc-200">
                              {item.mensagem ?? "(sem mensagem registrada)"}
                            </pre>
                          </div>
                          <div>
                            {item.erroMensagem && (
                              <>
                                <div className="text-xs font-semibold uppercase tracking-wide text-red-600">
                                  Erro
                                </div>
                                <pre className="mt-1 whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
                                  {item.erroMensagem}
                                </pre>
                              </>
                            )}
                            <div className="mt-3 text-xs text-zinc-500">
                              <div>
                                Candidatura: <span className="font-mono">{item.candidaturaId}</span>
                              </div>
                              <div>
                                Candidato: <span className="font-mono">{item.candidatoId}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-600">
        <div>
          Mostrando {items.length} de {total} (página {page} de {Math.max(totalPages, 1)})
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
