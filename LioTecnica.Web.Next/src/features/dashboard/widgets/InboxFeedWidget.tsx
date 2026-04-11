"use client";

import { useEffect, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { Mail, Folder, Upload, CheckCircle, XCircle, Loader2, Clock, Wifi, WifiOff } from "lucide-react";
import { env } from "@/lib/env";
import type { InboxFeedItem, InboxOrigem, InboxStatus } from "../dashboardTypes";

const MAX_ITEMS = 20;

const ORIGEM_CONFIG: Record<InboxOrigem, { label: string; Icon: React.ElementType }> = {
  email: { label: "Email", Icon: Mail },
  pasta: { label: "Pasta", Icon: Folder },
  upload: { label: "Upload", Icon: Upload },
};

const STATUS_CONFIG: Record<InboxStatus, { label: string; Icon: React.ElementType; color: string }> = {
  novo: { label: "Novo", Icon: Clock, color: "text-slate-500" },
  processando: { label: "Processando", Icon: Loader2, color: "text-blue-500" },
  processado: { label: "Processado", Icon: CheckCircle, color: "text-green-600" },
  falha: { label: "Falha", Icon: XCircle, color: "text-red-600" },
  descartado: { label: "Descartado", Icon: XCircle, color: "text-muted-foreground" },
};

function formatTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function InboxFeedWidget({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<InboxFeedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const connRef = useRef<ReturnType<InstanceType<typeof HubConnectionBuilder>["build"]> | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const apiBase = (env.API_BASE || "").replace(/\/+$/, "");
    const url = `${apiBase}/hubs/inbox?tenantId=${encodeURIComponent(tenantId)}`;

    const conn = new HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    connRef.current = conn;

    function upsertItem(raw: unknown) {
      try {
        const r = raw as Record<string, unknown>;
        const item: InboxFeedItem = {
          id: String(r.id ?? ""),
          origem: (r.origem as InboxOrigem) ?? "upload",
          status: (r.status as InboxStatus) ?? "novo",
          recebidoEm: (r.recebidoEm as string) ?? null,
          remetente: (r.remetente as string) ?? null,
          assunto: (r.assunto as string) ?? null,
          processamento: r.processamento
            ? {
                pct: (r.processamento as Record<string, unknown>).pct as number | null,
                etapa: (r.processamento as Record<string, unknown>).etapa as string | null,
                ultimoErro: (r.processamento as Record<string, unknown>).ultimoErro as string | null,
              }
            : null,
        };
        if (!item.id) return;
        setItems((prev) => {
          const idx = prev.findIndex((x) => x.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = item;
            return next;
          }
          return [item, ...prev].slice(0, MAX_ITEMS);
        });
      } catch {
        // ignore malformed messages
      }
    }

    function removeItem(raw: unknown) {
      const id = String((raw as Record<string, unknown>).id ?? "");
      if (id) setItems((prev) => prev.filter((x) => x.id !== id));
    }

    conn.on("inbox.created", upsertItem);
    conn.on("inbox.updated", upsertItem);
    conn.on("inbox.processed", upsertItem);
    conn.on("inbox.failed", upsertItem);
    conn.on("inbox.deleted", removeItem);

    conn.onreconnecting(() => setConnected(false));
    conn.onreconnected(() => setConnected(true));
    conn.onclose(() => setConnected(false));

    conn.start().then(() => setConnected(true)).catch(() => setConnected(false));

    return () => {
      void conn.stop();
    };
  }, [tenantId]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">Feed de CVs</div>
          <div className="text-muted-foreground text-xs">Tempo real via SignalR</div>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
              <Wifi className="size-3.5 text-green-600" />
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-slate-400" />
              <WifiOff className="size-3.5 text-muted-foreground" />
            </>
          )}
        </div>
      </div>

      {!tenantId && (
        <div className="text-xs text-muted-foreground flex-1 flex items-center justify-center">
          Sem tenant configurado.
        </div>
      )}

      {tenantId && items.length === 0 && (
        <div className="text-xs text-muted-foreground flex-1 flex items-center justify-center">
          {connected ? "Aguardando eventos de CVs…" : "Conectando…"}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-1 overflow-auto flex-1">
          {items.map((item) => {
            const origemCfg = ORIGEM_CONFIG[item.origem] ?? ORIGEM_CONFIG.upload;
            const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.novo;
            const OrigemIcon = origemCfg.Icon;
            const StatusIcon = statusCfg.Icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
              >
                <OrigemIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{item.assunto ?? item.remetente ?? "—"}</div>
                  {item.processamento?.pct != null && item.status === "processando" && (
                    <div className="mt-0.5 h-1 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${item.processamento.pct}%` }}
                      />
                    </div>
                  )}
                  {item.processamento?.ultimoErro && item.status === "falha" && (
                    <div className="text-[10px] text-red-600 truncate">{item.processamento.ultimoErro}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusIcon className={`size-3.5 ${statusCfg.color} ${item.status === "processando" ? "animate-spin" : ""}`} />
                  <span className="text-[10px] text-muted-foreground">{formatTime(item.recebidoEm)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
