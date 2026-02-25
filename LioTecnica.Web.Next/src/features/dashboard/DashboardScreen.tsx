"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { toast } from "sonner";

const BASE = "/app";

type Kpis = {
  openVagas: number;
  cvsHoje: number;
  pendentesMatch: number;
  aprovados7Dias: number;
  vagasForaSla: number;
};

type Funil = {
  recebidos: number;
  triagem: number;
  entrevista: number;
  aprovados: number;
};

type Series = { labels: string[]; values: number[] };

type VagaLookup = { id: string; titulo: string; codigo: string; cidade?: string | null; uf?: string | null };
type AreaLookup = { id: string; nome: string };

type TopMatchRow = {
  vagaId: string;
  vagaCodigo: string;
  vagaTitulo: string;
  candidatoId: string;
  candidatoNome: string;
  origem: string;
  matchScore: number;
  etapa: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapKpis(payload: unknown): Kpis {
  const r = asRecord(payload) ?? {};
  return {
    openVagas: pickNumber(r.openVagas, 0),
    cvsHoje: pickNumber(r.cvsHoje, 0),
    pendentesMatch: pickNumber(r.pendentesMatch, 0),
    aprovados7Dias: pickNumber(r.aprovados7Dias, 0),
    vagasForaSla: pickNumber(r.vagasForaSla, 0),
  };
}

function mapFunil(payload: unknown): Funil {
  const r = asRecord(payload) ?? {};
  return {
    recebidos: pickNumber(r.recebidos, 0),
    triagem: pickNumber(r.triagem, 0),
    entrevista: pickNumber(r.entrevista, 0),
    aprovados: pickNumber(r.aprovados, 0),
  };
}

function mapSeries(payload: unknown): Series {
  const r = asRecord(payload) ?? {};
  const labels = Array.isArray(r.labels) ? (r.labels as unknown[]).map((x) => pickString(x, "")) : [];
  const values = Array.isArray(r.values) ? (r.values as unknown[]).map((x) => pickNumber(x, 0)) : [];
  return { labels, values };
}

function mapVagas(payload: unknown): VagaLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      if (!id) return null;
      return {
        id,
        titulo: pickString(r.titulo, ""),
        codigo: pickString(r.codigo, ""),
        cidade: pickString(r.cidade, "") || null,
        uf: pickString(r.uf, "") || null,
      };
    })
    .filter(Boolean) as VagaLookup[];
}

function mapAreas(payload: unknown): AreaLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      if (!id) return null;
      return { id, nome: pickString(r.nome, "") };
    })
    .filter(Boolean) as AreaLookup[];
}

function mapTopMatches(payload: unknown): TopMatchRow[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const vagaId = pickString(r.vagaId, "");
      const candidatoId = pickString(r.candidatoId, "");
      if (!vagaId || !candidatoId) return null;
      return {
        vagaId,
        vagaCodigo: pickString(r.vagaCodigo, "-"),
        vagaTitulo: pickString(r.vagaTitulo, "-"),
        candidatoId,
        candidatoNome: pickString(r.candidatoNome, "-"),
        origem: pickString(r.origem, "-"),
        matchScore: clamp(pickNumber(r.matchScore, 0), 0, 100),
        etapa: pickString(r.etapa, "Triagem"),
      };
    })
    .filter(Boolean) as TopMatchRow[];
}

function BadgeEtapa({ etapa }: { etapa: string }) {
  const e = (etapa || "").toLowerCase();
  const cls =
    e.includes("reprov") ? "bad" : e.includes("aprov") ? "ok" : e.includes("entrev") ? "warn" : e.includes("triag") ? "warn" : "";
  return <span className={`status-tag ${cls}`}>{etapa}</span>;
}

export default function DashboardScreen({
  initialKpis,
  initialFunil,
  initialSeries,
  initialVagas,
  initialAreas,
  initialTopMatches,
}: {
  initialKpis: unknown;
  initialFunil: unknown;
  initialSeries: unknown;
  initialVagas: unknown;
  initialAreas: unknown;
  initialTopMatches: unknown;
}) {
  const [kpis, setKpis] = useState<Kpis>(() => mapKpis(initialKpis));
  const [funil, setFunil] = useState<Funil>(() => mapFunil(initialFunil));
  const [series, setSeries] = useState<Series>(() => mapSeries(initialSeries));
  const [vagas, setVagas] = useState<VagaLookup[]>(() => mapVagas(initialVagas));
  const [areas, setAreas] = useState<AreaLookup[]>(() => mapAreas(initialAreas));
  const [topMatches, setTopMatches] = useState<TopMatchRow[]>(() => mapTopMatches(initialTopMatches));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const [vagaId, setVagaId] = useState<string>("all");
  const [minMatch, setMinMatch] = useState<number>(0);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [quickArea, setQuickArea] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current;
    if (!ctx) return;
    if (chartRef.current) {
      chartRef.current.data.labels = series.labels;
      chartRef.current.data.datasets[0]!.data = series.values;
      chartRef.current.update();
      return;
    }
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: "CVs recebidos",
            data: series.values,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "rgba(16,82,144,.10)" }, ticks: { precision: 0 } },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.labels.join("|"), series.values.join("|")]);

  const funnelBase = funil.recebidos > 0 ? funil.recebidos : 1;
  const funnelBars = useMemo(() => {
    return {
      recebidos: 100,
      triagem: Math.round((funil.triagem / funnelBase) * 100),
      entrevista: Math.round((funil.entrevista / funnelBase) * 100),
      aprovados: Math.round((funil.aprovados / funnelBase) * 100),
    };
  }, [funil, funnelBase]);

  async function refreshAll() {
    try {
      const [k, f, s, v, a] = await Promise.all([
        fetchJson<unknown>(`${BASE}/Dashboard/_api/kpis`),
        fetchJson<unknown>(`${BASE}/Dashboard/_api/funil`),
        fetchJson<unknown>(`${BASE}/Dashboard/_api/recebidos-series?days=14`),
        fetchJson<unknown>(`${BASE}/Dashboard/_api/vagas`),
        fetchJson<unknown>(`${BASE}/Dashboard/_api/areas`),
      ]);
      setKpis(mapKpis(k));
      setFunil(mapFunil(f));
      setSeries(mapSeries(s));
      setVagas(mapVagas(v));
      setAreas(mapAreas(a));
      toast.success("Dashboard atualizado.");
    } catch {
      toast.error("Falha ao atualizar dashboard.");
    }
  }

  async function refreshTopMatches() {
    const params = new URLSearchParams();
    params.set("minMatch", String(clamp(minMatch, 0, 100)));
    params.set("take", "15");
    if (vagaId && vagaId !== "all") params.set("vagaId", vagaId);
    if (from) params.set("from", new Date(`${from}T00:00:00Z`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59Z`).toISOString());
    try {
      const rows = await fetchJson<unknown>(`${BASE}/Dashboard/_api/top-matches?${params.toString()}`);
      setTopMatches(mapTopMatches(rows));
      toast.success("Tabela atualizada.");
    } catch {
      toast.error("Falha ao carregar top matches.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Dashboard</h4>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" type="button" onClick={() => setFiltersOpen(true)}>
            Filtros
          </button>
          <button className="btn-brand" type="button" onClick={() => setQuickOpen(true)}>
            Ações
          </button>
          <button className="btn-ghost" type="button" onClick={() => void refreshAll()}>
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Vagas abertas</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.openVagas}</div>
          <div className="text-muted-foreground text-sm">em aberto</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">CVs hoje</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.cvsHoje}</div>
          <div className="text-muted-foreground text-sm">recebidos</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Pendentes match</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.pendentesMatch}</div>
          <div className="text-muted-foreground text-sm">aguardando</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Aprovados 7 dias</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.aprovados7Dias}</div>
          <div className="text-muted-foreground text-sm">últimos 7 dias</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Vagas fora SLA</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.vagasForaSla}</div>
          <div className="text-muted-foreground text-sm">atenção</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="card-soft p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="fw-bold">Resumo</div>
              <div className="text-muted-foreground text-sm">Últimos 14 dias</div>
            </div>
            <span className="badge-soft">Tendência</span>
          </div>
          <canvas ref={canvasRef} height={110} />
        </div>

        <div className="card-soft p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="fw-bold">Funil</div>
              <div className="text-muted-foreground text-sm">Pipeline</div>
            </div>
            <button className="btn-ghost px-3 py-2" type="button" onClick={() => setFiltersOpen(true)}>
              Filtros
            </button>
          </div>

          <div className="space-y-3 mt-2">
            {[
              { key: "recebidos", label: "Recebidos", value: funil.recebidos, pct: funnelBars.recebidos },
              { key: "triagem", label: "Triagem", value: funil.triagem, pct: funnelBars.triagem },
              { key: "entrevista", label: "Entrevista", value: funil.entrevista, pct: funnelBars.entrevista },
              { key: "aprovados", label: "Aprovados", value: funil.aprovados, pct: funnelBars.aprovados },
            ].map((x) => (
              <div key={x.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{x.label}</span>
                  <span className="font-semibold">{x.value}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full bg-[rgb(var(--lt-primary))]" style={{ width: `${clamp(x.pct, 0, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-muted-foreground text-sm">
            Dica: use filtros para ver diferentes períodos/vagas.
          </div>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <div className="fw-bold">Melhores matches</div>
            <div className="text-muted-foreground text-sm">Top 15 por score</div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" type="button" onClick={() => toast.info("Export (legado): implemente se precisar.")}>
              Exportar
            </button>
            <button className="btn-brand" type="button" onClick={() => toast.info("Nova vaga: use a tela Vagas.")}>
              Nova vaga
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Vaga</th>
                <th style={{ minWidth: 200 }}>Candidato</th>
                <th style={{ minWidth: 170 }}>Origem</th>
                <th style={{ minWidth: 240 }}>Match</th>
                <th style={{ minWidth: 170 }}>Etapa</th>
                <th className="text-end" style={{ minWidth: 150 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {topMatches.length ? (
                topMatches.map((x) => (
                  <tr key={`${x.vagaId}|${x.candidatoId}`}>
                    <td>
                      <div className="fw-semibold">{x.vagaTitulo || "-"}</div>
                      <div className="text-muted-foreground text-sm">Código: {x.vagaCodigo || "-"}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">{x.candidatoNome || "-"}</div>
                      <div className="text-muted-foreground text-sm">ID: {x.candidatoId || "-"}</div>
                    </td>
                    <td>
                      <span className="badge-soft">{x.origem || "-"}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                          <div className="h-full bg-[rgb(var(--lt-primary))]" style={{ width: `${x.matchScore}%` }} />
                        </div>
                        <div className="font-extrabold mono w-[52px] text-right">{x.matchScore}%</div>
                      </div>
                      <div className="text-muted-foreground text-sm mt-1">Match calculado pela API.</div>
                    </td>
                    <td>
                      <BadgeEtapa etapa={x.etapa || "Triagem"} />
                    </td>
                    <td className="text-end">
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => {
                          window.location.href = `${BASE}/vagas`;
                        }}
                      >
                        Ver vaga
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Sem dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/40" role="dialog" aria-modal="true">
          <div className="ml-auto h-dvh w-full max-w-md bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Filtros</div>
                <div className="text-lg font-extrabold">Dashboard</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setFiltersOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mini-title mb-1 block">Vaga</label>
                <select className="form-select" value={vagaId} onChange={(e) => setVagaId(e.target.value)}>
                  <option value="all">Todas</option>
                  {vagas
                    .slice()
                    .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo || "-"} ({v.codigo || "-"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mini-title mb-1 block">Match mínimo</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={100}
                  value={minMatch}
                  onChange={(e) => setMinMatch(clamp(Number(e.target.value), 0, 100))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mini-title mb-1 block">De</label>
                  <input className="form-control" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="mini-title mb-1 block">Até</label>
                  <input className="form-control" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setFiltersOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-brand"
                type="button"
                onClick={() => {
                  void refreshTopMatches().finally(() => setFiltersOpen(false));
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quickOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/40" role="dialog" aria-modal="true">
          <div className="ml-auto h-dvh w-full max-w-md bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Ações rápidas</div>
                <div className="text-lg font-extrabold">Criar vaga (atalho)</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setQuickOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mini-title mb-1 block">Área</label>
                <select className="form-select" value={quickArea} onChange={(e) => setQuickArea(e.target.value)}>
                  <option value="">Selecionar área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-muted-foreground text-sm">
                Atalho: no Razor esse drawer abre criação rápida. Aqui, por enquanto, direcionamos para a tela de Vagas.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setQuickOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-brand"
                type="button"
                onClick={() => {
                  window.location.href = `${BASE}/vagas`;
                }}
              >
                Ir para Vagas
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

