"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Chaves válidas para portalStatusKey (enum SolicitacaoStatus na API). */
const PORTAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "Rascunho", label: "Rascunho" },
  { value: "PendenteAprovacao", label: "Pendente aprovação" },
  { value: "Aprovada", label: "Aprovada" },
  { value: "Reprovada", label: "Reprovada" },
  { value: "AjustesNecessarios", label: "Ajustes necessários" },
  { value: "PendenteAprovacaoRh", label: "Pendente aprovação RH" },
  { value: "Cancelada", label: "Cancelada" },
  { value: "Suspensa", label: "Suspensa" },
  { value: "EmIntegracao", label: "Em integração" },
  { value: "Concluida", label: "Concluída" },
  { value: "PendenteAprovacaoAumentoHC", label: "Pendente aumento HC" },
  { value: "PendenteTriagem", label: "Pendente triagem" },
  { value: "EmTriagem", label: "Em triagem" },
  { value: "DevolvidaTriagemGestor", label: "Devolvida triagem ao gestor" },
  { value: "PendenteIntegracaoRm", label: "Pendente integração RM" },
  { value: "ErroIntegracaoRm", label: "Erro integração RM" },
  { value: "AguardandoReprocessamentoRm", label: "Aguardando reprocessamento RM" },
];

interface StatusMapRow {
  id: string;
  codStatusRm: number;
  portalStatusKey: string;
  priority?: number | null;
}

interface SyncSummary {
  totalLidos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagem?: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseProblemDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === "string" && o.detail.trim()) return o.detail;
  if (typeof o.title === "string" && o.title.trim()) return o.title;
  if (typeof o.message === "string" && o.message.trim()) return o.message;
  const err = o.errors;
  if (err && typeof err === "object") {
    const first = Object.values(err as Record<string, unknown>)[0];
    if (Array.isArray(first) && typeof first[0] === "string") return String(first[0]);
  }
  return undefined;
}

function parseGuidList(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const tokens = trimmed
    .split(/[\s,;]+/u)
    .map((x) => x.trim())
    .filter(Boolean);
  const invalid = tokens.filter((t) => !UUID_RE.test(t));
  if (invalid.length > 0) {
    toast.error(`GUID inválido: ${invalid[0]?.slice(0, 36) ?? "?"}…`);
    return null;
  }
  return tokens;
}

export default function AdminRmRequisicaoStatusScreen() {
  const [maps, setMaps] = useState<StatusMapRow[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCodRm, setDraftCodRm] = useState("");
  const [draftPortalKey, setDraftPortalKey] = useState("PendenteIntegracaoRm");
  const [draftPriority, setDraftPriority] = useState("");
  const [savingMap, setSavingMap] = useState(false);
  const [idsSyncRaw, setIdsSyncRaw] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null);

  const portalLabelLookup = useMemo(() => {
    const m = new Map<string, string>();
    PORTAL_STATUS_OPTIONS.forEach((o) => m.set(o.value, o.label));
    return m;
  }, []);

  const loadMaps = useCallback(async () => {
    setMapsLoading(true);
    try {
      const res = await apiFetch("/api/rm/requisicao-status-maps", { cache: "no-store" });
      const bodyUnknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = parseProblemDetail(bodyUnknown) ?? `Erro HTTP ${res.status}`;
        toast.error(msg);
        setMaps([]);
        return;
      }
      const rows = bodyUnknown as StatusMapRow[];
      setMaps(Array.isArray(rows) ? rows : []);
    } catch {
      toast.error("Falha ao carregar mapas.");
      setMaps([]);
    } finally {
      setMapsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  function openCreate() {
    setEditingId(null);
    setDraftCodRm("");
    setDraftPortalKey("PendenteIntegracaoRm");
    setDraftPriority("");
    setDialogOpen(true);
  }

  function openEdit(row: StatusMapRow) {
    setEditingId(row.id);
    setDraftCodRm(String(row.codStatusRm));
    setDraftPortalKey(row.portalStatusKey);
    setDraftPriority(row.priority != null ? String(row.priority) : "");
    setDialogOpen(true);
  }

  async function submitMapDialog() {
    const portalStatusKey = draftPortalKey.trim();
    if (!portalStatusKey) {
      toast.error("Selecione o status do portal.");
      return;
    }
    setSavingMap(true);
    try {
      if (editingId) {
        const priority =
          draftPriority.trim() === "" ? null : Number.parseInt(draftPriority, 10);
        if (draftPriority.trim() !== "" && Number.isNaN(priority)) {
          toast.error("Prioridade deve ser número inteiro.");
          return;
        }
        const res = await apiFetch(`/api/rm/requisicao-status-maps/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portalStatusKey,
            priority,
          }),
        });
        const b = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(parseProblemDetail(b) ?? "Não foi possível salvar o mapa.");
          return;
        }
        toast.success("Mapa atualizado.");
      } else {
        const cod = Number.parseInt(draftCodRm, 10);
        if (!Number.isFinite(cod) || cod < 0) {
          toast.error("CodStatus RM deve ser um número ≥ 0.");
          return;
        }
        const priority =
          draftPriority.trim() === "" ? null : Number.parseInt(draftPriority, 10);
        if (draftPriority.trim() !== "" && Number.isNaN(priority)) {
          toast.error("Prioridade deve ser número inteiro.");
          return;
        }
        const res = await apiFetch("/api/rm/requisicao-status-maps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codStatusRm: cod,
            portalStatusKey,
            priority,
          }),
        });
        const b = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(parseProblemDetail(b) ?? "Não foi possível criar o mapa.");
          return;
        }
        toast.success("Mapa criado.");
      }
      setDialogOpen(false);
      await loadMaps();
    } finally {
      setSavingMap(false);
    }
  }

  async function removeMap(row: StatusMapRow) {
    if (!window.confirm(`Remover mapa CODSTATUS ${row.codStatusRm}?`)) return;
    try {
      const res = await apiFetch(`/api/rm/requisicao-status-maps/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        toast.error(parseProblemDetail(b) ?? "Falha ao remover.");
        return;
      }
      toast.success("Mapa removido.");
      await loadMaps();
    } catch {
      toast.error("Falha ao remover mapa.");
    }
  }

  async function runManualSync() {
    const parsed = parseGuidList(idsSyncRaw);
    if (parsed === null) return;
    setSyncing(true);
    setLastSync(null);
    try {
      const body =
        parsed.length === 0 ? {} : { ids: parsed };
      const res = await apiFetch(
        "/api/rm/solicitacao-vaga/codstatus-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        120_000,
      );
      const b = (await res.json().catch(() => null)) as SyncSummary | null;
      if (!res.ok) {
        toast.error(parseProblemDetail(b) ?? `Sync falhou (HTTP ${res.status}).`);
        return;
      }
      if (b && typeof b === "object") {
        setLastSync({
          totalLidos: Number(b.totalLidos) || 0,
          atualizados: Number(b.atualizados) || 0,
          ignorados: Number(b.ignorados) || 0,
          erros: Number(b.erros) || 0,
          mensagem: typeof b.mensagem === "string" ? b.mensagem : null,
        });
      }
      toast.success("Sincronização concluída.");
    } catch {
      toast.error("Falha na sincronização (rede ou timeout).");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="space-y-8 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <ArrowRightLeft className="mt-0.5 size-6 text-primary" />
          <div>
            <h4 className="text-lg font-bold">Status RM ⇄ Requisição de pessoal</h4>
            <p className="text-muted-foreground text-sm">
              Mapas SYN-01 (CODSTATUS → status do portal) e execução manual do job de
              sincronização.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadMaps()} disabled={mapsLoading}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">Mapas CODSTATUS</h5>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="mr-2 size-4" />
            Novo mapa
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Um CODSTATUS do RM só pode ter um mapa por tenant. Sem mapa, o sync apenas grava texto
          de diagnóstico em cada solicitação.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">CODSTATUS RM</TableHead>
                <TableHead>Status portal</TableHead>
                <TableHead className="w-[100px]">Prioridade</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapsLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : maps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Nenhum mapa — adicione entradas para refletir o RM no fluxo da requisição.
                  </TableCell>
                </TableRow>
              ) : (
                maps.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.codStatusRm}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{m.portalStatusKey}</span>
                      {portalLabelLookup.has(m.portalStatusKey) && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({portalLabelLookup.get(m.portalStatusKey)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{m.priority ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(m)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => void removeMap(m)}
                        aria-label="Remover"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="size-4 text-amber-500" />
          <h5 className="text-sm font-semibold">Sincronização manual</h5>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Executa o mesmo processamento do job em background (até o limite configurado na API
          quando vazio). Opcional: informe IDs de solicitações (GUIDs, um por linha ou separados
          por vírgula).
        </p>
        <Textarea
          className="mb-3 min-h-[88px] font-mono text-xs"
          placeholder="Deixe vazio para lote padrão, ou cole GUIDs…"
          value={idsSyncRaw}
          onChange={(e) => setIdsSyncRaw(e.target.value)}
          disabled={syncing}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void runManualSync()} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sincronizando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 size-4" />
                Executar sync agora
              </>
            )}
          </Button>
        </div>

        {lastSync && (
          <div className="bg-muted/40 mt-4 rounded-md border p-3 font-mono text-xs">
            <div className="grid gap-1 sm:grid-cols-2">
              <span>
                Lidos: <strong>{lastSync.totalLidos}</strong>
              </span>
              <span>
                Atualizados: <strong>{lastSync.atualizados}</strong>
              </span>
              <span>
                Ignorados: <strong>{lastSync.ignorados}</strong>
              </span>
              <span>
                Erros: <strong>{lastSync.erros}</strong>
              </span>
            </div>
            {lastSync.mensagem && (
              <p className="text-destructive mt-2 whitespace-pre-wrap">{lastSync.mensagem}</p>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar mapa" : "Novo mapa"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Altere o status do portal ou a prioridade. O código RM não pode ser mudado — exclua e crie outro se necessário."
                : "Associe um CODSTATUS do RM (COLIGADA + requisição já refletidos na leitura SQL) ao nome do membro do enum de status da solicitação."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
                CODSTATUS RM
              </label>
              <Input
                type="number"
                min={0}
                value={draftCodRm}
                onChange={(e) => setDraftCodRm(e.target.value)}
                disabled={!!editingId}
                placeholder="ex.: 12"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
                Status portal (enum)
              </label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draftPortalKey}
                onChange={(e) => setDraftPortalKey(e.target.value)}
              >
                {PORTAL_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.value})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
                Prioridade (opcional)
              </label>
              <Input
                type="number"
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value)}
                placeholder="Menor número vence se houver colisão"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submitMapDialog()} disabled={savingMap}>
              {savingMap && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
