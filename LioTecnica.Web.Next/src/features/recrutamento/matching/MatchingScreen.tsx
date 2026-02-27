"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

type VagaOption = { id: string; label: string };

type RankItem = {
  id: string;
  nome: string;
  email: string;
  score: number;
  pass: boolean;
  justificativa?: string | null;
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapVagaOptions(payload: unknown): VagaOption[] {
  const list = Array.isArray(payload)
    ? (payload as unknown[])
    : Array.isArray(asRecord(payload)?.items)
      ? ((asRecord(payload)!.items as unknown[]) ?? [])
      : [];
  return list
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      const titulo = pickString(r.titulo, "");
      const codigo = pickString(r.codigo, "");
      if (!id) return null;
      return { id, label: codigo ? `${titulo} (${codigo})` : titulo };
    })
    .filter(Boolean) as VagaOption[];
}

function mapRankList(payload: unknown): { meta: Record<string, unknown> | null; items: RankItem[] } {
  if (Array.isArray(payload)) {
    const items = (payload as unknown[]).map(mapRankItem).filter(Boolean) as RankItem[];
    return { meta: null, items };
  }
  const r = asRecord(payload);
  const arr =
    (Array.isArray(r?.items) ? (r!.items as unknown[]) : null) ??
    (Array.isArray(r?.candidatos) ? (r!.candidatos as unknown[]) : null) ??
    (Array.isArray(r?.candidates) ? (r!.candidates as unknown[]) : null) ??
    [];
  const items = arr.map(mapRankItem).filter(Boolean) as RankItem[];
  return { meta: r ?? null, items };
}

function mapRankItem(x: unknown): RankItem | null {
  const r = asRecord(x);
  if (!r) return null;
  const id = pickString(r.candidatoId ?? r.id, "");
  if (!id) return null;
  const score = clamp(pickNumber(r.score, 0), 0, 100);
  const pass = (typeof r.pass === "boolean" ? r.pass : score >= 70) as boolean;
  return {
    id,
    nome: pickString(r.nome, ""),
    email: pickString(r.email, ""),
    score,
    pass,
    justificativa: pickString(r.justificativa, "") || null,
  };
}

export default function MatchingScreen({ initialVagas }: { initialVagas: unknown }) {
  const vagas = useMemo(() => mapVagaOptions(initialVagas), [initialVagas]);

  const [vagaId, setVagaId] = useState<string>("");
  const [tab, setTab] = useState<"suggestions" | "rejected">("suggestions");
  const [q, setQ] = useState("");

  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<RankItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => (selectedId ? items.find((x) => x.id === selectedId) ?? null : null), [items, selectedId]);

  const stats = useMemo(() => {
    const total = items.length;
    const inside = items.filter((x) => x.pass).length;
    const fail = total - inside;
    const avg = total ? Math.round(items.reduce((a, b) => a + b.score, 0) / total) : 0;
    return { total, inside, fail, avg };
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x) => `${x.nome} ${x.email}`.toLowerCase().includes(qq));
  }, [items, q]);

  async function loadSuggestions(id: string) {
    const data = await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(id)}/matching-ranking?take=20`);
    const mapped = mapRankList(data);
    setMeta(mapped.meta);
    setItems(mapped.items);
    setSelectedId(mapped.items[0]?.id ?? null);
  }

  async function loadRejected(id: string) {
    const data = await fetchJson<unknown>(
      `${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Reprovado&pageSize=100`,
    );
    const r = asRecord(data);
    const arr = Array.isArray(r?.items) ? (r!.items as unknown[]) : Array.isArray(data) ? (data as unknown[]) : [];
    const mapped = arr
      .map((x) => {
        const it = asRecord(x) ?? {};
        const cid = pickString(it.id, "");
        if (!cid) return null;
        const lm = asRecord(it.lastMatch);
        const score = clamp(pickNumber(lm?.score, 0), 0, 100);
        return { id: cid, nome: pickString(it.nome, ""), email: pickString(it.email, ""), score, pass: false } as RankItem;
      })
      .filter(Boolean) as RankItem[];
    setMeta(null);
    setItems(mapped);
    setSelectedId(mapped[0]?.id ?? null);
  }

  async function onSelectVaga(id: string, nextTab = tab) {
    setVagaId(id);
    setSelectedId(null);
    setItems([]);
    if (!id) return;
    try {
      if (nextTab === "rejected") await loadRejected(id);
      else await loadSuggestions(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar ranking.");
    }
  }

  async function recalcSelected() {
    if (!vagaId || !selectedId) return;
    const qs = new URLSearchParams({ candidatoId: selectedId, vagaId });
    try {
      await fetchJson(`${BASE}/api/matching/recalculate?${qs.toString()}`, { method: "POST" });
      toast.success("Recalcular solicitado.");
      await onSelectVaga(vagaId, tab);
    } catch {
      toast.error("Falha ao recalcular.");
    }
  }

  async function recalcVaga() {
    if (!vagaId) return;
    try {
      await fetchJson(`${BASE}/api/matching/recalculate?vagaId=${encodeURIComponent(vagaId)}`, { method: "POST" });
      toast.success("Recalcular solicitado.");
      await onSelectVaga(vagaId, tab);
    } catch {
      toast.error("Falha ao recalcular.");
    }
  }

  async function saveFiltrosRaw(raw: string) {
    if (!vagaId) return;
    try {
      await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/matching-filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchingFiltrosRaw: raw }),
      });
      toast.success("Filtros salvos.");
      await onSelectVaga(vagaId, tab);
    } catch {
      toast.error("Falha ao salvar filtros.");
    }
  }

  const filtrosRaw = pickString(meta?.matchingFiltrosRaw, "");

  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-lg font-bold">Matching</h4>
        <div className="text-muted-foreground text-sm">
          Pontuação automática por palavras-chave + pesos + requisitos obrigatórios.
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-grow min-w-[160px]">
            <p className="mini-title mb-0">Filtros</p>
            <div className="text-sm font-semibold mt-1">Vaga e candidatos</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="form-control w-[220px]" placeholder="Nome, email…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select
              className="form-select w-[260px]"
              value={vagaId}
              onChange={(e) => void onSelectVaga(e.target.value, tab)}
            >
              <option value="">Selecione uma vaga…</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60">
              <button
                type="button"
                className={`px-3 py-2 text-sm font-semibold ${tab === "suggestions" ? "bg-white/90" : ""}`}
                onClick={() => {
                  setTab("suggestions");
                  if (vagaId) void onSelectVaga(vagaId, "suggestions");
                }}
              >
                Sugestões
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-sm font-semibold ${tab === "rejected" ? "bg-white/90" : ""}`}
                onClick={() => {
                  setTab("rejected");
                  if (vagaId) void onSelectVaga(vagaId, "rejected");
                }}
              >
                Reprovados
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mini-title mb-0">Ranking</p>
            <div className="fw-bold mt-1">Candidatos</div>
            <div className="text-muted-foreground text-sm">
              Selecione uma vaga e clique em um candidato para ver detalhes.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-soft">
              <span className="mono">{stats.total}</span> total
            </span>
            <span className="badge-soft">
              <span className="mono">{stats.inside}</span> dentro
            </span>
            <span className="badge-soft">
              <span className="mono">{stats.fail}</span> abaixo
            </span>
            <span className="badge-soft">
              média <span className="mono">{stats.avg}%</span>
            </span>
            <button className="btn-ghost" type="button" disabled={!vagaId} onClick={() => void recalcVaga()}>
              Recalcular
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_420px]">
          <div className="space-y-2">
            {vagaId ? (
              filtered.length ? (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full rounded-2xl border border-[rgba(16,82,144,.14)] p-3 text-left transition ${
                      selectedId === c.id ? "bg-white/90" : "bg-white/55 hover:bg-white/90"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="avatar">{initials(c.nome)}</div>
                        <div className="min-w-0">
                          <div className="fw-bold truncate">{c.nome || "—"}</div>
                          <div className="text-muted-foreground text-xs truncate">{c.email || ""}</div>
                        </div>
                      </div>
                      <span className={`status-tag ${c.pass ? "ok" : "bad"}`}>
                        <span className="mono">{c.score}%</span>
                      </span>
                    </div>
                    {c.justificativa ? (
                      <div className="text-muted-foreground text-xs mt-2 line-clamp-2">{c.justificativa}</div>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="text-muted-foreground text-sm py-8 text-center">Nenhum candidato com os filtros atuais.</div>
              )
            ) : (
              <div className="text-muted-foreground text-sm py-8 text-center">Selecione uma vaga para ver o ranking.</div>
            )}
          </div>

          <aside className="card-soft p-3" style={{ boxShadow: "none" }}>
            {!selected ? (
              <div className="text-muted-foreground text-sm py-10 text-center">Selecione um candidato.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="avatar" style={{ width: 52, height: 52 }}>
                      {initials(selected.nome)}
                    </div>
                    <div>
                      <div className="text-lg font-extrabold">{selected.nome || "—"}</div>
                      <div className="text-muted-foreground text-sm">{selected.email || ""}</div>
                    </div>
                  </div>
                  <button className="btn-ghost" type="button" disabled={!vagaId} onClick={() => void recalcSelected()}>
                    Recalcular
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`status-tag ${selected.pass ? "ok" : "bad"}`}>
                    <span className="mono">{selected.score}%</span> • {selected.pass ? "Dentro" : "Abaixo"}
                  </span>
                </div>

                {tab === "suggestions" ? (
                  <div className="space-y-2">
                    <div className="fw-semibold">Filtros IA (raw)</div>
                    <textarea
                      className="form-control"
                      rows={6}
                      value={filtrosRaw}
                      onChange={(e) => setMeta((m) => ({ ...(m ?? {}), matchingFiltrosRaw: e.target.value }))}
                      placeholder="matchingFiltrosRaw…"
                    />
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" type="button" onClick={() => void saveFiltrosRaw(filtrosRaw)}>
                        Salvar filtros
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

