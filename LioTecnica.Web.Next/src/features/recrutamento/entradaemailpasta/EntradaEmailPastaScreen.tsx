"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { toast } from "sonner";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";

const BASE = "/app";

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

function clampInt(v: unknown, min: number, max: number) {
  const n = Math.trunc(pickNumber(v, min));
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
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

function attachmentIcon(tipo?: string | null) {
  const t = (tipo || "").toLowerCase();
  if (t === "pdf") return "📄";
  if (t === "doc" || t === "docx") return "📝";
  if (t === "txt") return "📃";
  return "📎";
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
  const simTimerRef = useRef<number | null>(null);
  const inboxRef = useRef(inbox);
  const vagasRef = useRef(vagas);

  useEffect(() => {
    inboxRef.current = inbox;
  }, [inbox]);

  useEffect(() => {
    vagasRef.current = vagas;
  }, [vagas]);

  function clearSimTimer() {
    if (simTimerRef.current) window.clearInterval(simTimerRef.current);
    simTimerRef.current = null;
  }

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

  useEffect(() => {
    return () => {
      clearSimTimer();
    };
  }, []);

  const vagaById = useMemo(() => {
    return new Map(vagas.map((v) => [v.id, v]));
  }, [vagas]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return inbox.filter((x) => {
      if (origem !== "all" && x.origem !== origem) return false;
      if (status !== "all" && x.status !== status) return false;
      if (!qq) return true;
      const vaga = x.vagaId ? vagaById.get(x.vagaId) : null;
      const blob = [
        x.remetente,
        x.assunto,
        x.destinatario,
        vaga?.titulo,
        vaga?.codigo,
        ...(x.anexos?.map((a) => a.nome) ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [inbox, origem, q, status, vagaById]);

  const filteredSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = a.recebidoEm ? new Date(a.recebidoEm).getTime() : 0;
      const tb = b.recebidoEm ? new Date(b.recebidoEm).getTime() : 0;
      return tb - ta;
    });
  }, [filtered]);

  /* pagination (client-side) */
  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filteredSorted.length, {
    initialPageSize: 20,
    resetDeps: [q, origem, status],
  });
  const pagedSorted = useMemo(() => filteredSorted.slice(slice.start, slice.end), [filteredSorted, slice.end, slice.start]);

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

  async function createInboxItem(payload: unknown) {
    const saved = await fetchJson<unknown>(`${BASE}/EntradaEmailPasta/_api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const mapped = mapInbox(saved);
    if (mapped) {
      setInbox((list) => [mapped, ...list]);
      setSelectedId(mapped.id);
    }
    return mapped;
  }

  async function runProcess(itemId: string, force: boolean) {
    const cur = inboxRef.current.find((x) => x.id === itemId);
    if (!cur) return;

    clearSimTimer();

    let item: InboxItem = { ...cur };

    const tentativasBase = item.processamento?.tentativas ?? 0;
    if (force) {
      item = {
        ...item,
        status: "novo",
        processamento: {
          pct: 0,
          etapa: "Aguardando",
          log: [],
          tentativas: tentativasBase,
          ultimoErro: null,
        },
      };
    }

    if (item.status === "processado") {
      toast.error("Já está processado. Use Reprocessar se precisar.");
      return;
    }
    if (item.status === "descartado") {
      toast.error("Item descartado. Não é possível processar.");
      return;
    }

    item = {
      ...item,
      status: "processando",
      processamento: {
        pct: item.processamento?.pct ?? 0,
        etapa: item.processamento?.etapa ?? "Aguardando",
        log: [...(item.processamento?.log ?? []), "Processamento iniciado."],
        tentativas: (item.processamento?.tentativas ?? 0) + 1,
        ultimoErro: null,
      },
    };

    setInbox((list) => list.map((x) => (x.id === item.id ? item : x)));
    try {
      await saveInboxItem(item);
    } catch {
      toast.error("Falha ao iniciar processamento.");
      return;
    }

    const steps: Array<{ pct: number; etapa: string; log: string }> = [
      { pct: 15, etapa: "Validando anexos", log: "Anexos validados." },
      { pct: 35, etapa: "Armazenando arquivo", log: "Arquivo armazenado (demo)." },
      { pct: 60, etapa: "Extraindo texto", log: "Texto extraído (demo)." },
      { pct: 85, etapa: "Normalizando conteúdo", log: "Normalização concluída." },
      { pct: 100, etapa: "Concluído", log: "Processamento finalizado." },
    ];

    let idx = 0;
    let busy = false;

    simTimerRef.current = window.setInterval(() => {
      if (busy) return;
      busy = true;

      const s = steps[idx++];
      if (!s) {
        clearSimTimer();
        busy = false;
        return;
      }

      const current = inboxRef.current.find((x) => x.id === itemId) ?? item;
      item = {
        ...current,
        processamento: {
          pct: s.pct,
          etapa: s.etapa,
          log: [...(current.processamento?.log ?? []), s.log],
          tentativas: current.processamento?.tentativas ?? 1,
          ultimoErro: current.processamento?.ultimoErro ?? null,
        },
      };

      setInbox((list) => list.map((x) => (x.id === item.id ? item : x)));

      void saveInboxItem(item)
        .then(async () => {
          if (s.pct !== 100) return;

          const subj = (item.assunto || "").toLowerCase();
          const remet = item.remetente || "";
          const fail = subj.includes("senha") || remet.includes("carlos");

          if (fail && (item.processamento?.tentativas ?? 0) < 3) {
            const failed: InboxItem = {
              ...item,
              status: "falha",
              processamento: {
                pct: 100,
                etapa: "Falha",
                log: [...(item.processamento?.log ?? []), "Falha detectada: arquivo protegido/ inválido."],
                tentativas: item.processamento?.tentativas ?? 1,
                ultimoErro: "Falha na extração: documento protegido / inválido (demo).",
              },
            };
            setInbox((list) => list.map((x) => (x.id === failed.id ? failed : x)));
            await saveInboxItem(failed);
            toast.error("Falha ao processar (demo).");
            clearSimTimer();
            return;
          }

          const done: InboxItem = {
            ...item,
            status: "processado",
            processamento: {
              pct: 100,
              etapa: "Concluído",
              log: item.processamento?.log ?? ["Processamento finalizado."],
              tentativas: item.processamento?.tentativas ?? 1,
              ultimoErro: null,
            },
            previewText: (item.previewText || "").trim() ? item.previewText : "Resumo (demo): experiência com excel, dashboards, comunicação e relatórios.",
          };
          setInbox((list) => list.map((x) => (x.id === done.id ? done : x)));
          await saveInboxItem(done);
          toast.success("Processamento concluído.");
          clearSimTimer();
        })
        .catch(() => {
          // mantém UI local; próximos ticks podem tentar salvar de novo.
        })
        .finally(() => {
          busy = false;
        });
    }, 700);
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
      const res = await apiFetch(`${BASE}/EntradaEmailPasta/_api/inbox/${encodeURIComponent(itemId)}/add-to-talentos`, {
        method: "POST",
        headers: { Accept: "application/json" },
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
          <button
            className="btn-brand"
            type="button"
            onClick={() => {
              const vagaId = vagasRef.current[0]?.id ?? null;
              const payload = {
                origem: "email",
                status: "novo",
                recebidoEm: new Date().toISOString(),
                remetente: "amostra@empresa.com",
                assunto: "Currículo enviado",
                destinatario: "rh@liotecnica.com.br",
                vagaId,
                anexos: [
                  {
                    nome: "Amostra_CV.pdf",
                    tipo: "pdf",
                    tamanhoKB: 220,
                    hash: `sim-${Math.random().toString(16).slice(2, 8)}`,
                  },
                ],
                processamento: { pct: 0, etapa: "Aguardando", log: ["Simulação de coleta."], tentativas: 0, ultimoErro: null },
                previewText: "",
              };
              void createInboxItem(payload)
                .then(() => toast.success("Item simulado criado."))
                .catch(() => toast.error("Falha ao simular coleta."));
            }}
          >
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
            {filteredSorted.length ? (
              pagedSorted.map((x) => {
                const st = statusTag(x.status);
                const pct = x.status === "processando" ? clampInt(x.processamento?.pct, 0, 100) : null;
                const vaga = x.vagaId ? vagaById.get(x.vagaId) : null;
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
                          <span className="pill">
                            Vaga:{" "}
                            <strong className="ms-1">
                              {vaga ? (vaga.codigo ? `${vaga.titulo} (${vaga.codigo})` : vaga.titulo) : "não definida"}
                            </strong>
                          </span>
                        </div>
                        <div className="mt-1 font-extrabold truncate">{x.assunto || x.anexos?.[0]?.nome || "Entrada"}</div>
                        <div className="text-muted-foreground text-sm truncate">
                          {x.remetente || "—"} {x.destinatario ? `• ${x.destinatario}` : ""}
                        </div>
                        {x.anexos?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {x.anexos.slice(0, 4).map((a, idx) => (
                              <span key={idx} className="pill">
                                {attachmentIcon(a.tipo)} {a.nome}{" "}
                                <span className="mono text-muted-foreground">({pickNumber(a.tamanhoKB, 0)}KB)</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {pct != null ? (
                          <div className="mt-2">
                            <div className="h-2 w-full rounded-full bg-[rgba(16,82,144,.12)]">
                              <div
                                className="h-2 rounded-full bg-[rgb(var(--lt-primary))] transition-[width] duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs text-right">
                        <div className="mono">{x.recebidoEm ? new Date(x.recebidoEm).toLocaleString("pt-BR") : "—"}</div>
                        {pct != null ? <div className="mt-1">{pct}%</div> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-muted-foreground text-sm py-6 text-center">Nenhum item encontrado com os filtros atuais.</div>
            )}

            <PaginationBar
              page={page}
              pageSize={pageSize}
              totalItems={filteredSorted.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
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
                  {selected.remetente || "—"}
                </div>
                  <div className="text-muted-foreground text-sm">
                    Destino: <span className="mono">{selected.destinatario || "—"}</span>
                  </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`status-tag ${statusTag(selected.status).cls}`}>{statusTag(selected.status).label}</span>
                  <span className="pill">Origem: {origemTag(selected.origem)}</span>
                    <span className="pill">
                      Recebido em:{" "}
                      <strong className="ms-1 mono">
                        {selected.recebidoEm ? new Date(selected.recebidoEm).toLocaleString("pt-BR") : "—"}
                      </strong>
                    </span>
                  <span className="pill">
                    Tentativas: <strong className="ms-1">{selected.processamento?.tentativas ?? 0}</strong>
                  </span>
                  <span className="pill">
                    Anexos: <strong className="ms-1">{selected.anexos?.length ?? 0}</strong>
                  </span>
                </div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>

            {(() => {
              const vaga = selected.vagaId ? vagaById.get(selected.vagaId) : null;
              const pct = clampInt(selected.processamento?.pct, 0, 100);
              const step = selected.processamento?.etapa || "—";
              const log = selected.processamento?.log ?? [];
              const ultimoErro = selected.processamento?.ultimoErro || "";
              const hasAssigned = !!selected.vagaId;
              const suggested = [...(selected.suggestedVagas ?? [])].map((s) => ({
                ...s,
                isAssigned: selected.vagaId === s.vagaId,
              }));
              suggested.sort((a, b) => {
                if (a.isAssigned === b.isAssigned) return 0;
                return a.isAssigned ? 1 : -1;
              });

              return (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-3">
                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="fw-bold mb-2">Vagas sugeridas</div>
                      {suggested.length ? (
                        <div className="space-y-2">
                          {suggested.slice(0, 12).map((s) => {
                            const isAssigned = s.isAssigned;
                            const vv = vagaById.get(s.vagaId);
                            const disabled = !isAssigned && hasAssigned;
                            return (
                              <div
                                key={s.vagaId}
                                className={`rounded-2xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3 ${
                                  isAssigned ? "ring-2 ring-emerald-400/40" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="fw-semibold truncate">{vv?.titulo || s.titulo || "Vaga sugerida"}</div>
                                    <div className="text-muted-foreground text-xs">
                                      <span className="mono">{vv?.codigo || s.vagaId}</span> • score{" "}
                                      <span className="mono">{pickNumber(s.score, 0)}</span>
                                    </div>
                                  </div>
                                  <button
                                    className={isAssigned ? "btn-ghost px-3 py-2 text-red-700" : "btn-ghost px-3 py-2"}
                                    type="button"
                                    disabled={disabled}
                                    title={disabled ? "Já existe uma vaga vinculada" : undefined}
                                    onClick={() => {
                                      const next: InboxItem = { ...selected, vagaId: isAssigned ? null : s.vagaId };
                                      setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                                      void saveInboxItem(next)
                                        .then(() => toast.success(isAssigned ? "Vaga desvinculada." : "Vaga vinculada."))
                                        .catch(() => toast.error(isAssigned ? "Falha ao desvincular vaga." : "Falha ao vincular vaga."));
                                    }}
                                  >
                                    {isAssigned ? "Desvincular" : "Vincular"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">Sem sugestões ainda.</div>
                      )}
                    </div>

                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="fw-bold mb-2">Anexos</div>
                      {selected.anexos?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selected.anexos.map((a, idx) => (
                            <span key={idx} className="pill">
                              {attachmentIcon(a.tipo)} {a.nome}{" "}
                              <span className="mono text-muted-foreground">({pickNumber(a.tamanhoKB, 0)}KB)</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">Sem anexos</div>
                      )}
                    </div>

                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="fw-bold mb-2">Preview (texto extraído)</div>
                      <textarea
                        className="form-control"
                        rows={8}
                        value={selected.previewText ?? ""}
                        onChange={(e) => {
                          const next = { ...selected, previewText: e.target.value };
                          setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                        }}
                      />
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            const cur = inboxRef.current.find((x) => x.id === selected.id);
                            if (!cur) return;
                            void saveInboxItem(cur)
                              .then(() => toast.success("Preview salvo."))
                              .catch(() => toast.error("Falha ao salvar preview."));
                          }}
                        >
                          Salvar preview
                        </button>
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            const first = vagasRef.current[0];
                            if (!first) return;
                            const next = { ...selected, vagaId: first.id };
                            setInbox((list) => list.map((x) => (x.id === next.id ? next : x)));
                            void saveInboxItem(next).then(() => toast.success("Vaga atribuída (demo)."));
                          }}
                        >
                          Auto-atribuir vaga (demo)
                        </button>
                      </div>

                      {ultimoErro ? (
                        <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-800">
                          <div className="fw-semibold mb-1">Erro</div>
                          <div className="mono">{ultimoErro}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="fw-bold mb-2">Processamento</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="mini-title">Etapa</div>
                          <div className="text-sm text-muted-foreground">{step}</div>
                        </div>
                        <div className="fw-bold text-[rgb(var(--lt-primary))]">{pct}%</div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-[rgba(16,82,144,.12)]">
                        <div className="h-2 rounded-full bg-[rgb(var(--lt-primary))]" style={{ width: `${pct}%` }} />
                      </div>

                      <div className="mt-3">
                        <div className="fw-semibold">Logs</div>
                        {log.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {log.slice(-12).map((l, idx) => (
                              <li key={idx}>{l}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-2 text-muted-foreground text-sm">Sem logs ainda.</div>
                        )}
                      </div>
                    </div>

                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="fw-bold mb-2">Ações</div>

                      <div className="space-y-2">
                        <label className="mini-title mb-1 block">Vaga vinculada</label>
                        <div className="flex flex-wrap gap-2">
                          <span className="pill">{vaga ? (vaga.codigo ? `${vaga.titulo} (${vaga.codigo})` : vaga.titulo) : "Vaga não definida"}</span>
                          {selected.vagaId ? <span className="pill mono">{selected.vagaId}</span> : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            className="btn-brand"
                            type="button"
                            onClick={() => void runProcess(selected.id, false)}
                          >
                            {selected.status === "processando" ? "Continuar" : "Processar"}
                          </button>
                          <button className="btn-ghost" type="button" onClick={() => void runProcess(selected.id, true)}>
                            Reprocessar
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button className="btn-ghost" type="button" onClick={() => void addToTalentos(selected.id)}>
                            Adicionar à base de talentos
                          </button>
                          <button className="btn-ghost" type="button" onClick={() => void createCandidateFromInbox(selected)}>
                            Criar candidato
                          </button>
                        </div>

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
                            void saveInboxItem(next)
                              .then(() => toast.success("Item descartado."))
                              .catch(() => toast.error("Falha ao descartar item."));
                          }}
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </section>
  );
}

