"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

const BASE = "/app";

type Stage = "triagem" | "pendente" | "aprovado" | "reprovado";

type TriagemCandidate = {
  id: string;
  nome: string;
  email: string;
  vagaId: string | null;
  status: Stage;
  updatedAt?: string | null;
  lastMatch?: { score?: number | null; pass?: boolean | null; at?: string | null; vagaId?: string | null } | null;
  applicationRecruiterUserName?: string | null;
};

type TriagemVaga = { id: string; titulo: string; codigo: string; threshold: number; requisitos?: unknown[] };

type StatusHistoryItem = {
  from?: string | null;
  to?: string | null;
  atUtc?: string | null;
  reason?: string | null;
  note?: string | null;
  source?: string | null;
};

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function stageLabel(s: Stage) {
  if (s === "triagem") return "Em triagem";
  if (s === "pendente") return "Pendente";
  if (s === "aprovado") return "Aprovado";
  if (s === "reprovado") return "Reprovado";
  return s;
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

function mapVaga(api: unknown): TriagemVaga | null {
  const r = asRecord(api);
  if (!r) return null;
  const id = pickString(r.id, "");
  if (!id) return null;
  return {
    id,
    codigo: pickString(r.codigo, ""),
    titulo: pickString(r.titulo, ""),
    threshold: clamp(pickNumber(r.matchMinimoPercentual ?? r.threshold, 0), 0, 100),
    requisitos: Array.isArray(r.requisitos) ? r.requisitos : [],
  };
}

function mapCandidate(api: unknown): TriagemCandidate | null {
  const r = asRecord(api);
  if (!r) return null;
  const id = pickString(r.id, "");
  if (!id) return null;
  const statusRaw = pickString(r.status, "triagem").trim().toLowerCase();
  const status: Stage =
    statusRaw === "pendente" ? "pendente" : statusRaw === "aprovado" ? "aprovado" : statusRaw === "reprovado" ? "reprovado" : "triagem";
  const lm = asRecord(r.lastMatch);
  return {
    id,
    nome: pickString(r.nome, ""),
    email: pickString(r.email, ""),
    vagaId: pickString(r.vagaId, "") || null,
    status,
    updatedAt: pickString(r.updatedAtUtc ?? r.updatedAt, "") || null,
    lastMatch: lm
      ? {
          score: typeof lm.score === "number" ? lm.score : Number(lm.score),
          pass: typeof lm.pass === "boolean" ? lm.pass : null,
          at: pickString(lm.atUtc ?? lm.at, "") || null,
          vagaId: pickString(lm.vagaId, "") || null,
        }
      : null,
    applicationRecruiterUserName: pickString(r.applicationRecruiterUserName, "") || null,
  };
}

export default function TriagemScreen({
  initialVagas,
  initialCands,
}: {
  initialVagas: unknown;
  initialCands: unknown;
}) {
  const initialVagaList = Array.isArray(initialVagas) ? (initialVagas as unknown[]) : [];
  const initialCandList = Array.isArray(initialCands) ? (initialCands as unknown[]) : [];

  const [loading, setLoading] = useState(false);
  const [vagas, setVagas] = useState<TriagemVaga[]>(
    initialVagaList.map(mapVaga).filter(Boolean) as TriagemVaga[],
  );
  const [cands, setCands] = useState<TriagemCandidate[]>(
    initialCandList.map(mapCandidate).filter(Boolean) as TriagemCandidate[],
  );
  const [history, setHistory] = useState<Record<string, StatusHistoryItem[]>>({});

  const [dragId, setDragId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionStage, setDecisionStage] = useState<Stage>("aprovado");
  const [decisionReason, setDecisionReason] = useState("Decisão");
  const [decisionNote, setDecisionNote] = useState("");

  async function refreshBoard() {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        fetchJson<unknown>(`${BASE}/Triagem/_api/vagas`),
        fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos`),
      ]);
      setVagas((Array.isArray(v) ? v.map(mapVaga).filter(Boolean) : []) as TriagemVaga[]);
      setCands((Array.isArray(c) ? c.map(mapCandidate).filter(Boolean) : []) as TriagemCandidate[]);
      toast.success("Triagem atualizada.");
    } catch {
      toast.error("Falha ao atualizar triagem.");
    } finally {
      setLoading(false);
    }
  }

  const vagaById = useMemo(() => {
    const m: Record<string, TriagemVaga> = {};
    for (const v of vagas) m[v.id] = v;
    return m;
  }, [vagas]);

  const grouped = useMemo(() => {
    const g: Record<Stage, TriagemCandidate[]> = { triagem: [], pendente: [], aprovado: [], reprovado: [] };
    for (const c of cands) g[c.status]?.push(c);
    for (const k of Object.keys(g) as Stage[]) {
      g[k].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
    return g;
  }, [cands]);

  const selected = useMemo(() => (selectedId ? cands.find((c) => c.id === selectedId) ?? null : null), [cands, selectedId]);
  const selectedVaga = selected?.vagaId ? vagaById[selected.vagaId] : null;

  async function loadHistory(candId: string) {
    try {
      const list = await fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos/${encodeURIComponent(candId)}/status-history`);
      const items = Array.isArray(list) ? (list as unknown[]) : [];
      setHistory((h) => ({ ...h, [candId]: items.map((x) => (asRecord(x) ?? {}) as StatusHistoryItem) }));
    } catch {
      setHistory((h) => ({ ...h, [candId]: [] }));
    }
  }

  async function moveStage(candId: string, newStage: Stage, meta: { reason: string; note: string; source: string }) {
    const c = cands.find((x) => x.id === candId);
    if (!c) return;
    const prev = c.status;
    if (prev === newStage) return;

    const payload = {
      ...c,
      status: newStage,
      updatedAt: new Date().toISOString(),
      statusChange: { reason: meta.reason || null, note: meta.note || null, source: meta.source || "triagem" },
    };
    try {
      const saved = await fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos/${encodeURIComponent(candId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const mapped = mapCandidate(saved) ?? { ...c, status: newStage };
      setCands((list) => list.map((x) => (x.id === mapped.id ? mapped : x)));
      await loadHistory(mapped.id);
      setSelectedId(mapped.id);
      toast.success(`Movido: ${stageLabel(prev)} → ${stageLabel(newStage)}`);
    } catch {
      toast.error("Falha ao salvar candidato.");
    }
  }

  async function autoTriage() {
    const tri = grouped.triagem;
    if (!tri.length) {
      toast.info("Sem candidatos em triagem.");
      return;
    }
    for (const c of tri) {
      const v = c.vagaId ? vagaById[c.vagaId] : null;
      const thr = v?.threshold ?? 0;
      const score = clamp(pickNumber(c.lastMatch?.score, 0), 0, 100);
      const pass = c.lastMatch?.pass ?? (thr ? score >= thr : score >= 70);
      const action: Stage = pass ? "aprovado" : "reprovado";
      await moveStage(c.id, action, { reason: "Auto-triagem", note: `Score=${score}% thr=${thr}%`, source: "auto" });
    }
  }

  function openDetail(candId: string) {
    setSelectedId(candId);
    setDetailOpen(true);
    void loadHistory(candId);
  }

  function openDecision(candId: string) {
    setSelectedId(candId);
    setDecisionStage("aprovado");
    setDecisionReason("Decisão");
    setDecisionNote("");
    setDecisionOpen(true);
    void loadHistory(candId);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Triagem</h4>
          <div className="text-muted-foreground text-sm">Pipeline (drag & drop) + decisão</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              const payload = { exportedAt: new Date().toISOString(), candidatos: cands, vagas };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `triagem-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success("Exportação iniciada.");
            }}
          >
            Exportar
          </button>
          <button className="btn-brand" type="button" disabled={loading} onClick={() => void autoTriage()}>
            Auto-triagem
          </button>
          <button className="btn-ghost" type="button" disabled={loading} onClick={() => void refreshBoard()}>
            Atualizar
          </button>
        </div>
      </div>

      {loading ? <div className="text-muted-foreground">Carregando…</div> : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {(["triagem", "pendente", "aprovado", "reprovado"] as Stage[]).map((stage) => (
          <div key={stage} className="card-soft p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="fw-bold">{stageLabel(stage)}</div>
                <div className="text-muted-foreground text-sm">
                  <span className="mono">{grouped[stage].length}</span> candidatos
                </div>
              </div>
              <span className="pill">arraste</span>
            </div>

            <div
              className="mt-3 space-y-2 min-h-[220px]"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (!id) return;
                void moveStage(id, stage, { reason: "Drag&Drop", note: "Movido no board.", source: "board" });
              }}
            >
              {grouped[stage].length ? (
                grouped[stage].map((c) => {
                  const v = c.vagaId ? vagaById[c.vagaId] : null;
                  const thr = v?.threshold ?? 0;
                  const score = clamp(pickNumber(c.lastMatch?.score, 0), 0, 100);
                  const pass = c.lastMatch?.pass ?? (thr ? score >= thr : null);
                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3"
                      draggable
                      onDragStart={(ev) => {
                        setDragId(c.id);
                        ev.dataTransfer.setData("text/plain", c.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="avatar">{initials(c.nome)}</div>
                          <div className="min-w-0">
                            <div className="font-extrabold truncate">{c.nome || "—"}</div>
                            <div className="text-muted-foreground text-xs truncate">{c.email || ""}</div>
                          </div>
                        </div>
                        <button className="btn-ghost px-3 py-2" type="button" onClick={() => openDetail(c.id)} title="Detalhes">
                          Detalhes
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="pill mono">{v?.codigo || "—"}</div>
                        <div className="text-muted-foreground text-xs text-right line-clamp-2">{v?.titulo || ""}</div>
                      </div>

                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                            <div
                              className={`h-full ${pass === true ? "bg-emerald-500" : pass === false ? "bg-red-500" : "bg-slate-500"}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <div className="mono font-extrabold text-sm w-[52px] text-right">{score}%</div>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1">
                          mínimo: <span className="mono">{thr}%</span> •{" "}
                          <span className="font-semibold">{pass === null ? "—" : pass ? "passou" : "abaixo"}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {c.applicationRecruiterUserName ? <span className="badge-soft">{c.applicationRecruiterUserName}</span> : null}
                        <button className="btn-ghost px-3 py-2 ms-auto" type="button" onClick={() => openDecision(c.id)}>
                          Decisão
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted-foreground text-sm py-6 text-center">-</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {detailOpen && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-4xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="avatar" style={{ width: 52, height: 52 }}>
                  {initials(selected.nome)}
                </div>
                <div>
                  <div className="text-lg font-extrabold">{selected.nome || "—"}</div>
                  <div className="text-muted-foreground text-sm">{selected.email || ""}</div>
                  <div className="text-muted-foreground text-xs">
                    Atualizado:{" "}
                    <span className="mono">
                      {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString("pt-BR") : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="status-tag warn">{stageLabel(selected.status)}</span>
              <span className="pill">
                Vaga: <strong className="ms-1">{selectedVaga?.titulo || "—"}</strong>
              </span>
              <span className="pill mono">{selectedVaga?.codigo || "—"}</span>
              <span className="pill">
                Min.: <strong className="ms-1">{selectedVaga?.threshold ?? 0}%</strong>
              </span>
            </div>

            <div className="mt-4">
              <div className="fw-semibold mb-2">Histórico (últimos)</div>
              <div className="space-y-2">
                {(history[selected.id] ?? []).slice(0, 10).map((h, idx) => (
                  <div key={idx} className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3">
                    <div className="text-sm font-semibold">
                      {pickString(h.from, "—")} → {pickString(h.to, "—")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {h.atUtc ? new Date(h.atUtc).toLocaleString("pt-BR") : "—"} • {pickString(h.source, "")}
                    </div>
                    {h.note ? <div className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">{h.note}</div> : null}
                  </div>
                ))}
                {Array.isArray(history[selected.id]) && history[selected.id]!.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Sem histórico.</div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => openDecision(selected.id)}>
                Decisão
              </button>
              <button className="btn-brand" type="button" onClick={() => setDetailOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {decisionOpen && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Decisão</p>
                <div className="text-lg font-extrabold">{selected.nome || "—"}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDecisionOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mini-title mb-1 block">Ação</label>
                <select className="form-select" value={decisionStage} onChange={(e) => setDecisionStage(e.target.value as Stage)}>
                  <option value="triagem">Em triagem</option>
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Motivo</label>
                <input className="form-control" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Nota</label>
                <textarea className="form-control" rows={4} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setDecisionOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-brand"
                type="button"
                onClick={() => {
                  void moveStage(selected.id, decisionStage, {
                    reason: decisionReason || "Decisão",
                    note: decisionNote || "",
                    source: "decision",
                  }).finally(() => setDecisionOpen(false));
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

