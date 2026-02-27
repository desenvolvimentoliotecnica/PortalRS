"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { toast } from "sonner";

import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

type InboxStatus = "novo" | "processando" | "processado" | "falha" | "descartado";
type InboxOrigem = "email" | "pasta" | "upload";

type InboxItem = {
  id: string;
  origem: InboxOrigem;
  status: InboxStatus;
  recebidoEm?: string | null;
  remetente?: string | null;
  assunto?: string | null;
  destinatario?: string | null;
  vagaId?: string | null;
  previewText?: string | null;
  processamento?: {
    pct?: number | null;
    etapa?: string | null;
    log?: string[] | null;
    tentativas?: number | null;
    ultimoErro?: string | null;
  } | null;
  anexos?: Array<{
    id?: string | null;
    nome: string;
    tipo?: string | null;
    tamanhoKB?: number | null;
    hash?: string | null;
  }> | null;
  suggestedVagas?: Array<{ vagaId: string; titulo?: string | null; score?: number | null }> | null;
};

type Vaga = { id: string; titulo: string; codigo: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function pickNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapVaga(v: unknown): Vaga | null {
  const r = asRecord(v);
  if (!r) return null;
  const id = pickString(r.id, "");
  if (!id) return null;
  return { id, titulo: pickString(r.titulo, ""), codigo: pickString(r.codigo, "") };
}

function mapInbox(x: unknown): InboxItem | null {
  const r = asRecord(x);
  if (!r) return null;
  const id = pickString(r.id, "");
  if (!id) return null;
  return {
    id,
    origem: (pickString(r.origem, "upload").toLowerCase() as InboxOrigem) || "upload",
    status: (pickString(r.status, "novo").toLowerCase() as InboxStatus) || "novo",
    recebidoEm: pickString(r.recebidoEm, "") || null,
    remetente: pickString(r.remetente, "") || null,
    assunto: pickString(r.assunto, "") || null,
    destinatario: pickString(r.destinatario, "") || null,
    vagaId: pickString(r.vagaId, "") || null,
    previewText: pickString(r.previewText, "") || null,
    processamento: asRecord(r.processamento)
      ? {
          pct: pickNumber(asRecord(r.processamento)?.pct, 0),
          etapa: pickString(asRecord(r.processamento)?.etapa, "") || null,
          log: Array.isArray(asRecord(r.processamento)?.log) ? (asRecord(r.processamento)!.log as string[]) : null,
          tentativas: pickNumber(asRecord(r.processamento)?.tentativas, 0),
          ultimoErro: pickString(asRecord(r.processamento)?.ultimoErro, "") || null,
        }
      : null,
    anexos: Array.isArray(r.anexos)
      ? (r.anexos as unknown[]).map((a) => {
          const ar = asRecord(a) ?? {};
          return {
            id: pickString(ar.id, "") || null,
            nome: pickString(ar.nome, ""),
            tipo: pickString(ar.tipo, "") || null,
            tamanhoKB: pickNumber(ar.tamanhoKB, 0),
            hash: pickString(ar.hash, "") || null,
          };
        })
      : null,
    suggestedVagas: Array.isArray(r.suggestedVagas)
      ? (r.suggestedVagas as unknown[]).map((s) => {
          const sr = asRecord(s) ?? {};
          return {
            vagaId: pickString(sr.vagaId, ""),
            titulo: pickString(sr.titulo, "") || null,
            score: pickNumber(sr.score, 0),
          };
        })
      : null,
  };
}

function statusTag(s: InboxStatus) {
  if (s === "processado") return { cls: "ok", label: "Processado" };
  if (s === "processando") return { cls: "warn", label: "Processando" };
  if (s === "falha") return { cls: "bad", label: "Falha" };
  if (s === "descartado") return { cls: "bad", label: "Descartado" };
  return { cls: "", label: "Novo" };
}

function origemTag(o: InboxOrigem) {
  if (o === "email") return "Email";
  if (o === "pasta") return "Pasta";
  return "Upload";
}

export default function EntradaEmailPastaScreen({
  tenantId,
  initialVagas,
  initialInbox,
}: {
  tenantId: string;
  initialVagas: unknown;
  initialInbox: unknown;
}) {
  const initV = Array.isArray(initialVagas) ? (initialVagas as unknown[]) : [];
  const initI = Array.isArray(initialInbox) ? (initialInbox as unknown[]) : [];

  const [vagas, setVagas] = useState<Vaga[]>(initV.map(mapVaga).filter(Boolean) as Vaga[]);
  const [inbox, setInbox] = useState<InboxItem[]>(initI.map(mapInbox).filter(Boolean) as InboxItem[]);

  const [q, setQ] = useState("");
  const [origem, setOrigem] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [selectedId, setSelectedId] = useState<string | null>(inbox[0]?.id ?? null);
  const selected = useMemo(() => (selectedId ? inbox.find((x) => x.id === selectedId) ?? null : null), [inbox, selectedId]);

  const [detailOpen, setDetailOpen] = useState(false);

  const hubDebounceRef = useRef<number | null>(null);

  async function refreshAll(silent?: boolean) {
    try {
      const [v, i] = await Promise.all([
        fetchJson<unknown>(`${BASE}/EntradaEmailPasta/_api/vagas`),
        fetchJson<unknown>(`${BASE}/EntradaEmailPasta/_api/inbox`, {
          headers: silent ? { "X-LT-Silent": "1" } : undefined,
        }),
      ]);
      setVagas((Array.isArray(v) ? v.map(mapVaga).filter(Boolean) : []) as Vaga[]);
      const mapped = (Array.isArray(i) ? i.map(mapInbox).filter(Boolean) : []) as InboxItem[];
      setInbox(mapped);
      setSelectedId((cur) => cur ?? mapped[0]?.id ?? null);
    } catch {
      if (!silent) toast.error("Falha ao atualizar inbox.");
    }
  }

  useEffect(() => {
    // SignalR: atualiza a fila automaticamente.
    const url = `${BASE}/hubs/inbox?tenantId=${encodeURIComponent(tenantId)}`;
    const conn = new HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    const onAny = () => {
      // debounce leve
      if (hubDebounceRef.current) window.clearTimeout(hubDebounceRef.current);
      hubDebounceRef.current = window.setTimeout(() => {
        void refreshAll(true);
      }, 400);
    };

    conn.on("inbox.created", onAny);
    conn.on("inbox.updated", onAny);
    conn.on("inbox.processed", onAny);
    conn.on("inbox.failed", onAny);
    conn.on("inbox.deleted", onAny);

    void conn.start().then(
      () => {
      },
      () => {},
    );

    return () => {
      if (hubDebounceRef.current) window.clearTimeout(hubDebounceRef.current);
      void conn.stop().catch(() => {});
    };
  }, [tenantId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return inbox.filter((x) => {
      if (origem !== "all" && x.origem !== origem) return false;
      if (status !== "all" && x.status !== status) return false;
      if (!qq) return true;
      const blob = [x.remetente, x.assunto, x.destinatario, ...(x.anexos?.map((a) => a.nome) ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [inbox, origem, q, status]);

  const kpis = useMemo(() => {
    const queue = inbox.filter((x) => x.status === "novo" || x.status === "processando").length;
    const today = new Date();
    const isSameDay = (iso?: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };
    const done = inbox.filter((x) => x.status === "processado" && isSameDay(x.recebidoEm)).length;
    const fail = inbox.filter((x) => x.status === "falha").length;
    return { queue, done, fail, connect: 2 };
  }, [inbox]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    for (const f of list) {
      try {
        const data = new FormData();
        data.append("file", f, f.name);
        await fetchJson(`${BASE}/EntradaEmailPasta/_api/upload`, { method: "POST", body: data });
      } catch {
        toast.error("Falha ao enviar upload.");
      }
    }
    toast.success("Upload concluído.");
    await refreshAll(true);
  }

  async function saveInboxItem(item: InboxItem) {
    const payload = {
      origem: item.origem,
      status: item.status,
      recebidoEm: item.recebidoEm,
      remetente: item.remetente,
      assunto: item.assunto,
      destinatario: item.destinatario,
      vagaId: item.vagaId,
      previewText: item.previewText || null,
      processamento: item.processamento ?? null,
      anexos: item.anexos ?? [],
      suggestedVagas: item.suggestedVagas ?? [],
    };
    const saved = await fetchJson<unknown>(`${BASE}/EntradaEmailPasta/_api/inbox/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const mapped = mapInbox(saved);
    if (mapped) setInbox((list) => list.map((x) => (x.id === mapped.id ? mapped : x)));
    return mapped;
  }

  async function createCandidateFromInbox(item: InboxItem) {
    if (!item.vagaId) {
      toast.error("Selecione uma vaga antes de criar o candidato.");
      return;
    }
    const firstAtt = item.anexos?.[0]?.nome || "Candidato";
    const base = firstAtt.replace(/\.(pdf|doc|docx|txt)$/i, "").replaceAll("_", " ").replaceAll("-", " ");
    const nome = base.length >= 4 ? base : "Novo Candidato";
    const fonte = item.origem === "email" ? "Email" : item.origem === "pasta" ? "Pasta" : "Site";
    const email = item.remetente && item.remetente.includes("@") ? item.remetente : "";
    if (!email) {
      toast.error("Informe um email válido antes de criar o candidato.");
      return;
    }
    const payload = {
      nome,
      email,
      fone: null,
      cidade: null,
      uf: null,
      fonte,
      status: "Triagem",
      vagaId: item.vagaId,
      obs: "Criado a partir da Entrada.",
      cvText: (item.previewText || "").trim() || null,
      lastMatch: null,
      documentos: null,
    };
    try {
      await fetchJson(`${BASE}/EntradaEmailPasta/_api/candidatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updated: InboxItem = {
        ...item,
        status: "processado",
        processamento: {
          pct: 100,
          etapa: "Concluído",
          log: [...(item.processamento?.log ?? []), "Candidato criado a partir da entrada."],
          tentativas: (item.processamento?.tentativas ?? 0) + 1,
          ultimoErro: null,
        },
      };
      await saveInboxItem(updated);
      toast.success("Candidato criado.");
    } catch {
      toast.error("Falha ao criar candidato.");
    }
  }

  async function addToTalentos(itemId: string) {
    try {
      const res = await fetch(`${BASE}/EntradaEmailPasta/_api/inbox/${encodeURIComponent(itemId)}/add-to-talentos`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as unknown;
        const msg = pickString(asRecord(err)?.message, "");
        toast.error(msg || `Falha ao adicionar (${res.status}).`);
        return;
      }
      toast.success("Adicionado à base de talentos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar à base de talentos.");
    }
  }

  function exportJson() {
    const payload = { exportedAt: new Date().toISOString(), inbox };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inbox_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportação iniciada.");
  }

  async function importJson(file: File) {
    const text = await file.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const r = asRecord(parsed);
    const list = Array.isArray(r?.inbox) ? (r!.inbox as unknown[]) : null;
    if (!list) {
      toast.error("JSON inválido (esperado: { inbox: [...] }).");
      return;
    }
    for (const x of list) {
      await fetchJson(`${BASE}/EntradaEmailPasta/_api/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(x),
      });
    }
    toast.success("Importação concluída.");
    await refreshAll(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Entrada (Email / Pasta)</h4>
          <div className="text-muted-foreground text-sm">Fila de entrada + upload + ações</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" type="button" onClick={() => void refreshAll()}>
            Atualizar
          </button>
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Exportar
          </button>
          <label className="btn-ghost cursor-pointer">
            Importar
            <input
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (!f) return;
                void importJson(f).finally(() => (e.currentTarget.value = ""));
              }}
            />
          </label>
          <button className="btn-brand" type="button" onClick={() => toast.info("Simulação no Next: use upload manual + APIs do legado.")}>
            Simular coleta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Fila de Entrada</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.queue}</div>
          <div className="text-muted-foreground text-sm">itens</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Processados hoje</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.done}</div>
          <div className="text-muted-foreground text-sm">ok</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Falhas</div>
          <div className="text-2xl font-extrabold text-red-700">{kpis.fail}</div>
          <div className="text-muted-foreground text-sm">atenção</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Integrações</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.connect}</div>
          <div className="text-muted-foreground text-sm">ativas</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="card-soft p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="fw-bold">Upload manual</div>
              <div className="text-muted-foreground text-sm">Arraste PDFs/DOCs aqui ou selecione arquivos.</div>
            </div>
            <label className="btn-ghost cursor-pointer">
              Selecionar arquivo
              <input
                className="hidden"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const files = e.currentTarget.files;
                  if (!files || !files.length) return;
                  void uploadFiles(files).finally(() => (e.currentTarget.value = ""));
                }}
              />
            </label>
          </div>

          <div
            className="mt-3 rounded-2xl border border-dashed border-[rgba(16,82,144,.35)] bg-white/55 p-4"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (!files || !files.length) return;
              void uploadFiles(files);
            }}
          >
            <div className="fw-semibold">Solte seus arquivos aqui</div>
            <div className="text-muted-foreground text-sm">Tipos comuns: .pdf, .doc, .docx, .txt</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="pill">PDF</span>
              <span className="pill">Word</span>
              <span className="pill">TXT</span>
              <span className="pill">LGPD</span>
            </div>
          </div>
        </div>

        <div className="card-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="fw-bold">Fila de entrada</div>
              <div className="text-muted-foreground text-sm">Selecione um item para ver detalhes e executar ações.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input className="form-control w-[260px]" placeholder="Remetente, assunto, arquivo..." value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="form-select w-[180px]" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                <option value="all">Todas origens</option>
                <option value="email">Email</option>
                <option value="pasta">Pasta</option>
                <option value="upload">Upload</option>
              </select>
              <select className="form-select w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">Todos status</option>
                <option value="novo">Novo</option>
                <option value="processando">Processando</option>
                <option value="processado">Processado</option>
                <option value="falha">Falha</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {filtered.length ? (
              filtered.map((x) => {
                const st = statusTag(x.status);
                return (
                  <button
                    key={x.id}
                    type="button"
                    className="w-full rounded-2xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3 text-left hover:bg-white/90"
                    onClick={() => {
                      setSelectedId(x.id);
                      setDetailOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`status-tag ${st.cls}`}>{st.label}</span>
                          <span className="pill">{origemTag(x.origem)}</span>
                          {x.vagaId ? (
                            <span className="pill">
                              Vaga:{" "}
                              <strong className="ms-1">
                                {vagas.find((v) => v.id === x.vagaId)?.codigo || "—"}
                              </strong>
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 font-extrabold truncate">{x.assunto || x.anexos?.[0]?.nome || "Entrada"}</div>
                        <div className="text-muted-foreground text-sm truncate">
                          {x.remetente || "—"} {x.destinatario ? `• ${x.destinatario}` : ""}
                        </div>
                        {x.anexos?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {x.anexos.slice(0, 4).map((a, idx) => (
                              <span key={idx} className="pill">
                                {a.nome} <span className="mono text-muted-foreground">({pickNumber(a.tamanhoKB, 0)}KB)</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs text-right">
                        <div className="mono">{x.recebidoEm ? new Date(x.recebidoEm).toLocaleString("pt-BR") : "—"}</div>
                        {x.processamento?.pct != null ? <div className="mt-1">{x.processamento.pct}%</div> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-muted-foreground text-sm py-6 text-center">Sem itens.</div>
            )}
          </div>
        </div>
      </div>

      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-5xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Detalhe da entrada</div>
                <div className="text-lg font-extrabold">{selected.assunto || selected.anexos?.[0]?.nome || "Inbox"}</div>
                <div className="text-muted-foreground text-sm">
                  {selected.remetente || "—"} {selected.destinatario ? `• ${selected.destinatario}` : ""}
                </div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="fw-semibold mb-2">Preview</div>
                <textarea
                  className="form-control"
                  rows={10}
                  value={selected.previewText ?? ""}
                  onChange={(e) => {
                    const next = { ...selected, previewText: e.target.value };
                    setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                  }}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      const cur = inbox.find((x) => x.id === selected.id);
                      if (!cur) return;
                      void saveInboxItem(cur)
                        .then(() => toast.success("Preview salvo."))
                        .catch(() => toast.error("Falha ao salvar preview."));
                    }}
                  >
                    Salvar preview
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                  <div className="fw-semibold mb-2">Ações</div>
                  <div className="space-y-2">
                    <label className="mini-title mb-1 block">Vaga</label>
                    <select
                      className="form-select"
                      value={selected.vagaId ?? ""}
                      onChange={(e) => {
                        const next = { ...selected, vagaId: e.target.value || null };
                        setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                      }}
                    >
                      <option value="">Selecione…</option>
                      {vagas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.codigo ? `${v.titulo} (${v.codigo})` : v.titulo}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => {
                        const first = vagas[0];
                        if (!first) return;
                        const next = { ...selected, vagaId: first.id };
                        setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                        void saveInboxItem(next).then(() => toast.success("Vaga atribuída (demo)."));
                      }}
                    >
                      Auto-atribuir (demo)
                    </button>

                    <button className="btn-brand" type="button" onClick={() => void createCandidateFromInbox(selected)}>
                      Criar candidato
                    </button>

                    <button className="btn-ghost" type="button" onClick={() => void addToTalentos(selected.id)}>
                      Adicionar ao Talentos
                    </button>

                    <button
                      className="btn-ghost text-red-700"
                      type="button"
                      onClick={() => {
                        if (!confirm("Descartar este item?")) return;
                        const next: InboxItem = {
                          ...selected,
                          status: "descartado",
                          processamento: {
                            pct: 100,
                            etapa: "Descartado",
                            log: [...(selected.processamento?.log ?? []), "Item descartado manualmente."],
                            tentativas: selected.processamento?.tentativas ?? 0,
                            ultimoErro: selected.processamento?.ultimoErro ?? null,
                          },
                        };
                        setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                        void saveInboxItem(next).then(() => toast.success("Item descartado."));
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>

                {selected.suggestedVagas?.length ? (
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="fw-semibold mb-2">Sugestões de vaga</div>
                    <div className="space-y-2">
                      {selected.suggestedVagas.slice(0, 8).map((s) => {
                        const isAssigned = selected.vagaId === s.vagaId;
                        const v = vagas.find((x) => x.id === s.vagaId);
                        return (
                          <div
                            key={s.vagaId}
                            className={`rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-2 ${isAssigned ? "ring-2 ring-emerald-400/40" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="fw-semibold truncate">{v?.titulo || s.titulo || "Vaga"}</div>
                                <div className="text-muted-foreground text-xs">
                                  <span className="mono">{v?.codigo || ""}</span> • score{" "}
                                  <span className="mono">{pickNumber(s.score, 0)}</span>
                                </div>
                              </div>
                              <button
                                className="btn-ghost px-3 py-2"
                                type="button"
                                disabled={isAssigned}
                                onClick={() => {
                                  const next = { ...selected, vagaId: s.vagaId };
                                  setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                                  void saveInboxItem(next).then(() => toast.success("Vaga atribuída."));
                                }}
                              >
                                {isAssigned ? "Atribuída" : "Atribuir"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

