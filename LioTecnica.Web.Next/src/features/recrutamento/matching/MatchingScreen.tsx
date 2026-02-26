"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

const BASE = "/app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>;

interface VagaOption {
  id: string;
  titulo: string;
  codigo: string;
  label: string;
  createdAtUtc?: string;
}

interface RankItem {
  id: string;
  nome: string;
  email: string;
  score: number;
  pass: boolean;
  source?: string;
  scoreFiltros?: number;
  scoreRequisitos?: number;
  justificativa?: string;
}

interface VagaDetail {
  id: string;
  titulo: string;
  codigo: string;
  threshold: number;
  requisitos: Requisito[];
  matchingFiltrosRaw?: string | null;
  matchingFiltrosOriginaisRaw?: string | null;
}

interface Requisito {
  id: string;
  termo: string;
  peso: number;
  obrigatorio: boolean;
  sinonimos: string[];
}

interface CandidatoFull {
  id: string;
  nome: string;
  email: string;
  cvText?: string;
  resumoProfissional?: string;
  documentos?: { nome?: string; fileName?: string; url?: string; link?: string }[];
  updatedAt?: string;
}

interface MatchResult {
  score: number;
  pass: boolean;
  hits: Requisito[];
  missMandatory: Requisito[];
  totalPeso: number;
  hitPeso: number;
  threshold: number;
}

type TabKey = "suggestions" | "rejected";
type RankingStatus = "idle" | "loading" | "ready" | "processing" | "failed";

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function pk(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : v == null ? fb : String(v);
}
function pn(v: unknown, fb = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fb;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    // For ranking endpoints, return the body even on error (may contain stale data)
    if (url.includes("matching-ranking")) {
      try { return (await res.json()) as T; } catch { /* ignore */ }
    }
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

/* ═══════════════════════════════════════════════════════════════════
   MAPPERS
   ═══════════════════════════════════════════════════════════════════ */

function mapVagas(raw: unknown): VagaOption[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as AnyRec)?.items) ? (raw as AnyRec).items : [];
  return arr
    .map((x: AnyRec) => {
      const id = pk(x.id); if (!id) return null;
      const titulo = pk(x.titulo); const codigo = pk(x.codigo);
      return { id, titulo, codigo, label: codigo ? `${titulo} (${codigo})` : titulo, createdAtUtc: pk(x.createdAtUtc) };
    })
    .filter(Boolean) as VagaOption[];
}

function mapRankItem(x: AnyRec): RankItem {
  return {
    id: pk(x.candidatoId ?? x.id),
    nome: pk(x.nome),
    email: pk(x.email),
    score: clamp(pn(x.score), 0, 100),
    pass: typeof x.pass === "boolean" ? x.pass : pn(x.score) >= 70,
    source: pk(x.source, "candidato"),
    scoreFiltros: pn(x.scoreFiltros),
    scoreRequisitos: pn(x.scoreRequisitos),
    justificativa: pk(x.justificativa),
  };
}

function mapVagaDetail(d: AnyRec): VagaDetail {
  const reqs = Array.isArray(d.requisitos) ? d.requisitos : [];
  return {
    id: pk(d.id),
    titulo: pk(d.titulo),
    codigo: pk(d.codigo),
    threshold: clamp(pn(d.threshold ?? d.matchingThreshold), 0, 100),
    requisitos: reqs.map((r: AnyRec) => ({
      id: pk(r.id ?? r.termo),
      termo: pk(r.termo),
      peso: clamp(pn(r.peso), 0, 10),
      obrigatorio: !!r.obrigatorio,
      sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos.map(String) : [],
    })),
    matchingFiltrosRaw: d.matchingFiltrosRaw ?? null,
    matchingFiltrosOriginaisRaw: d.matchingFiltrosOriginaisRaw ?? null,
  };
}

function calcMatch(cvText: string, reqs: Requisito[], threshold: number): MatchResult {
  const text = (cvText || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const totalPeso = reqs.reduce((a, r) => a + r.peso, 0) || 1;
  let hitPeso = 0;
  const hits: Requisito[] = [];
  const missMandatory: Requisito[] = [];

  for (const r of reqs) {
    const bag = [r.termo, ...r.sinonimos].map(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).filter(Boolean);
    const found = bag.some(t => t && text.includes(t));
    if (found) { hitPeso += r.peso; hits.push(r); }
    else if (r.obrigatorio) missMandatory.push(r);
  }

  let score = Math.round((hitPeso / totalPeso) * 100);
  if (missMandatory.length) score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
  const pass = score >= threshold;
  return { score, pass, hits, missMandatory, totalPeso, hitPeso, threshold };
}

/* ═══════════════════════════════════════════════════════════════════
   SCORE CIRCLE
   ═══════════════════════════════════════════════════════════════════ */

function ScoreCircle({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 60 ? "#16a34a" : score >= 30 ? "#eab308" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        className="text-[0.65rem] font-bold" fill={color}>{score}%</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function MatchingScreen({ initialVagas, fixedVagaId }: { initialVagas: unknown; fixedVagaId?: string | null }) {
  const vagas = useMemo(() => mapVagas(initialVagas).sort((a, b) => {
    const ta = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0;
    const tb = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0;
    return tb - ta;
  }), [initialVagas]);

  // Core state
  const [vagaId, setVagaId] = useState("");
  const [tab, setTab] = useState<TabKey>("suggestions");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<RankItem[]>([]);
  const [rankStatus, setRankStatus] = useState<RankingStatus>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vagaDetail, setVagaDetail] = useState<VagaDetail | null>(null);
  const [candidatoFull, setCandidatoFull] = useState<CandidatoFull | null>(null);
  const [cvText, setCvText] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const pollRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(1200);

  // Caches
  const sugCacheRef = useRef<RankItem[] | null>(null);
  const rejCacheRef = useRef<RankItem[] | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const inside = items.filter(x => x.pass).length;
    const fail = total - inside;
    const avg = total ? Math.round(items.reduce((a, b) => a + b.score, 0) / total) : 0;
    return { total, inside, fail, avg };
  }, [items]);

  // Filtered
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(x => `${x.nome} ${x.email}`.toLowerCase().includes(qq));
  }, [items, q]);

  const selected = useMemo(() => selectedId ? items.find(x => x.id === selectedId) ?? null : null, [items, selectedId]);

  // ─── Load vaga detail ───
  const loadVagaDetail = useCallback(async (id: string) => {
    try {
      const d = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
      if (d) { const det = mapVagaDetail(d); setVagaDetail(det); return det; }
    } catch { /* ignore */ }
    return null;
  }, []);

  // ─── Load ranking snapshot ───
  const loadSuggestions = useCallback(async (id: string, force = false) => {
    if (!force && sugCacheRef.current) {
      setItems(sugCacheRef.current);
      setRankStatus("ready");
      setSelectedId(sugCacheRef.current[0]?.id ?? null);
      return;
    }
    const token = ++pollRef.current;
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    setRankStatus("loading");

    try {
      const snap = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(id)}/matching-ranking?take=20`);
      if (token !== pollRef.current) return;

      const mapItems = (arr: unknown) => (Array.isArray(arr) ? arr.map(mapRankItem) : []);

      if (snap?.status === "ready") {
        const mapped = mapItems(snap.items);
        sugCacheRef.current = mapped;
        setItems(mapped);
        setRankStatus("ready");
        setSelectedId(mapped[0]?.id ?? null);
        pollDelayRef.current = 1200;
      } else if (snap?.status === "processing") {
        const stale = mapItems(snap.staleItems);
        if (stale.length) { sugCacheRef.current = stale; setItems(stale); setSelectedId(stale[0]?.id ?? null); }
        setRankStatus("processing");
        const delay = pollDelayRef.current;
        pollDelayRef.current = Math.min(10000, Math.round(delay * 1.35));
        pollTimerRef.current = setTimeout(() => {
          if (pollRef.current !== token) return;
          loadSuggestions(id, true);
        }, delay);
      } else if (snap?.status === "failed") {
        const stale = mapItems(snap.staleItems);
        if (stale.length) { sugCacheRef.current = stale; setItems(stale); setSelectedId(stale[0]?.id ?? null); }
        setRankStatus("failed");
        toast.error(pk(snap.lastError, "Falha ao carregar ranking."));
      } else {
        // Try to parse as array (simple response)
        const mapped = mapItems(snap?.items ?? snap);
        sugCacheRef.current = mapped.length ? mapped : null;
        setItems(mapped);
        setRankStatus(mapped.length ? "ready" : "failed");
        setSelectedId(mapped[0]?.id ?? null);
      }
    } catch (e) {
      if (token !== pollRef.current) return;
      setRankStatus("failed");
      toast.error(e instanceof Error ? e.message : "Falha ao carregar ranking.");
    }
  }, []);

  // ─── Load rejected ───
  const loadRejected = useCallback(async (id: string, force = false) => {
    if (!force && rejCacheRef.current) {
      setItems(rejCacheRef.current);
      setRankStatus("ready");
      setSelectedId(rejCacheRef.current[0]?.id ?? null);
      return;
    }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Reprovado&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => {
        const cid = pk(x.id); if (!cid) return null;
        const lm = x.lastMatch ?? {};
        return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: false, source: "candidato" } as RankItem;
      }).filter(Boolean) as RankItem[];
      rejCacheRef.current = mapped;
      setItems(mapped);
      setRankStatus("ready");
      setSelectedId(mapped[0]?.id ?? null);
    } catch {
      setRankStatus("failed");
      toast.error("Falha ao carregar reprovados.");
    }
  }, []);

  // ─── Select vaga ───
  const onSelectVaga = useCallback(async (id: string, nextTab: TabKey = tab) => {
    setVagaId(id);
    setSelectedId(null);
    setCandidatoFull(null);
    setItems([]);
    setRankStatus("idle");
    if (!id) return;
    await loadVagaDetail(id);
    if (nextTab === "rejected") await loadRejected(id);
    else await loadSuggestions(id);
  }, [tab, loadVagaDetail, loadSuggestions, loadRejected]);

  // ─── Select candidate ───
  const onSelectCandidate = useCallback(async (id: string) => {
    setSelectedId(id);
    setCandidatoFull(null);
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      if (data) {
        const full: CandidatoFull = {
          id: pk(data.id), nome: pk(data.nome), email: pk(data.email),
          cvText: pk(data.cvText), resumoProfissional: pk(data.resumoProfissional),
          documentos: Array.isArray(data.documentos) ? data.documentos : [],
          updatedAt: pk(data.updatedAt ?? data.updatedAtUtc),
        };
        setCandidatoFull(full);
        setCvText(full.cvText ?? "");
      }
    } catch { /* keep displaying summary from rank item */ }
  }, []);

  // ─── Actions ───
  async function recalcSelected() {
    if (!vagaId || !selectedId) return;
    try {
      await api(`${BASE}/api/matching/recalculate?candidatoId=${selectedId}&vagaId=${vagaId}`, { method: "POST" });
      toast.success("Recalcular solicitado.");
      sugCacheRef.current = null;
      await loadSuggestions(vagaId, true);
    } catch { toast.error("Falha ao recalcular."); }
  }

  async function reprove(id: string, source?: string) {
    if (!confirm("Tem certeza que deseja reprovar este candidato?")) return;
    if (!vagaId) return;
    try {
      if (source === "talento") {
        const item = items.find(x => x.id === id);
        await api(`${BASE}/api/candidatos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talentoId: id, vagaId, status: "Reprovado", nome: item?.nome ?? "Talento", email: item?.email ?? "" }),
        });
      } else {
        const cand = await api<AnyRec>(`${BASE}/api/candidatos/${id}`);
        if (cand) {
          cand.status = "Reprovado";
          await api(`${BASE}/api/candidatos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand) });
        }
      }
      toast.success("Candidato reprovado.");
      sugCacheRef.current = null;
      rejCacheRef.current = null;
      await (tab === "rejected" ? loadRejected(vagaId, true) : loadSuggestions(vagaId, true));
    } catch (e) { toast.error("Erro ao reprovar: " + (e instanceof Error ? e.message : String(e))); }
  }

  async function saveCvText() {
    if (!selectedId || !candidatoFull) return;
    try {
      const cand = await api<AnyRec>(`${BASE}/api/candidatos/${selectedId}`);
      if (cand) {
        cand.cvText = cvText;
        await api(`${BASE}/api/candidatos/${selectedId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand) });
        toast.success("Texto do CV salvo. Recalcule para atualizar o score.");
      }
    } catch { toast.error("Falha ao salvar texto do CV."); }
  }

  async function saveFiltros(raw: string | null) {
    if (!vagaId) return;
    try {
      const data = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/matching-filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchingFiltrosRaw: raw }),
      });
      if (data) setVagaDetail(mapVagaDetail(data));
      toast.success("Filtros salvos.");
      setShowFilterModal(false);
      sugCacheRef.current = null;
      await loadSuggestions(vagaId, true);
    } catch { toast.error("Falha ao salvar filtros."); }
  }

  async function revertFiltros() {
    if (!vagaId || !vagaDetail) return;
    const raw = vagaDetail.matchingFiltrosOriginaisRaw ?? "";
    await saveFiltros(raw || null);
  }

  // Match calc for detail panel
  const matchResult: MatchResult | null = useMemo(() => {
    if (!vagaDetail || !candidatoFull) return null;
    return calcMatch(candidatoFull.cvText ?? "", vagaDetail.requisitos, vagaDetail.threshold);
  }, [vagaDetail, candidatoFull]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  // Auto-select vaga when fixedVagaId is provided (navigated from Vagas screen)
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (fixedVagaId && vagas.length > 0 && !didAutoSelect.current) {
      didAutoSelect.current = true;
      void onSelectVaga(fixedVagaId, "suggestions");
    }
  }, [fixedVagaId, vagas, onSelectVaga]);

  /* ═══════════ RENDER ═══════════ */

  // Find the selected vaga label for the header
  const selectedVaga = vagas.find(v => v.id === vagaId);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold">Matching{selectedVaga ? `: ${selectedVaga.titulo}` : ""}</h4>
          <div className="text-muted-foreground text-sm">Pontuação automática por palavras-chave + pesos + requisitos obrigatórios.</div>
        </div>
        {vagaId && vagaDetail && (
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" type="button" onClick={() => setShowFilterModal(true)}>
              ✏️ Editar filtros de matching por IA
            </button>
            {vagaDetail.matchingFiltrosOriginaisRaw != null &&
              vagaDetail.matchingFiltrosOriginaisRaw !== (vagaDetail.matchingFiltrosRaw ?? "") && (
                <button className="btn-ghost text-sm" type="button" onClick={() => void revertFiltros()}>
                  ↩ Reverter para filtros da criação
                </button>
              )}
          </div>
        )}
      </div>

      {/* Compact filter bar: search + tabs only */}
      <div className="card-soft p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input className="form-control w-[260px]" placeholder="Buscar por nome ou email…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="flex overflow-hidden rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60">
            <button type="button"
              className={`px-4 py-2 text-sm font-semibold transition ${tab === "suggestions" ? "bg-white/90 text-[var(--lt-primary,#105290)]" : "text-muted-foreground hover:bg-white/40"}`}
              onClick={() => { setTab("suggestions"); if (vagaId) void onSelectVaga(vagaId, "suggestions"); }}>
              Sugestões
            </button>
            <button type="button"
              className={`px-4 py-2 text-sm font-semibold transition ${tab === "rejected" ? "bg-white/90 text-[var(--lt-primary,#105290)]" : "text-muted-foreground hover:bg-white/40"}`}
              onClick={() => { setTab("rejected"); if (vagaId) void onSelectVaga(vagaId, "rejected"); }}>
              Reprovados
            </button>
          </div>
        </div>
      </div>

      {/* Ranking panel */}
      <div className="card-soft p-3" style={{ borderLeft: "4px solid var(--lt-primary, #105290)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="mini-title mb-0">Ranking por IA</p>
            <div className="font-bold mt-1">Candidatos</div>
            <div className="text-muted-foreground text-sm">Selecione uma vaga para ver o ranking. Clique na linha ou em Abrir para ver detalhes.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge rounded-full bg-[var(--lt-primary,#105290)] px-2.5 py-1 text-white text-xs font-semibold">👥 {stats.total} total</span>
            <span className="badge rounded-full bg-green-600 px-2.5 py-1 text-white text-xs font-semibold">✅ {stats.inside} dentro</span>
            <span className="badge rounded-full bg-amber-500 px-2.5 py-1 text-black text-xs font-semibold">⚠ {stats.fail} abaixo</span>
            <span className="badge rounded-full bg-[rgba(16,82,144,.15)] px-2.5 py-1 text-[var(--lt-primary,#105290)] text-xs font-semibold">📊 média {stats.avg}%</span>
          </div>
        </div>

        {/* Status banners */}
        {rankStatus === "processing" && (
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            🔄 Atualizando ranking em segundo plano…
          </div>
        )}
        {rankStatus === "failed" && items.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠ Falha ao atualizar ranking. Exibindo último resultado disponível.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
          {/* Left: table */}
          <div>
            {rankStatus === "loading" && items.length === 0 ? (
              <div className="text-muted-foreground text-sm py-8 text-center">Carregando ranking…</div>
            ) : !vagaId ? (
              <div className="text-muted-foreground text-sm py-8 text-center">
                <span className="block text-3xl mb-2">🔍</span>
                Selecione uma vaga no filtro acima para ver o ranking de candidatos por pontos.
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-muted-foreground text-sm py-8 text-center">
                {tab === "rejected" ? "Nenhum candidato reprovado." : "Nenhuma sugestão encontrada."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(16,82,144,.12)] text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="py-2 pr-2 w-10"></th>
                      <th className="py-2 pr-2 text-left">Nome</th>
                      <th className="py-2 pr-2 text-left">E-mail</th>
                      <th className="py-2 pr-2 w-20">Match</th>
                      <th className="py-2 pr-2 text-right w-28">Ações</th>
                      <th className="py-2 text-right w-16">Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id}
                        className={`border-b border-[rgba(16,82,144,.06)] cursor-pointer transition hover:bg-white/70 ${selectedId === r.id ? "bg-white/90" : ""}`}
                        onClick={() => void onSelectCandidate(r.id)}>
                        <td className="py-2.5 pr-2">
                          <div className="avatar avatar-sm flex items-center justify-center w-8 h-8 rounded-full bg-[var(--lt-primary,#105290)] text-white text-xs font-bold">
                            {initials(r.nome)}
                          </div>
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="font-semibold">{r.nome || "—"}</span>
                          {r.source && (
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${r.source === "talento" ? "bg-sky-100 text-sky-700" : "bg-[var(--lt-primary,#105290)] text-white"}`}>
                              {r.source === "talento" ? "Talento" : "Candidato"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2 text-muted-foreground text-xs">{r.email || "—"}</td>
                        <td className="py-2.5 pr-2 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.pass ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.pass ? "Dentro" : "Abaixo"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="btn-ghost p-1 rounded" type="button" title="Abrir Detalhes"
                              onClick={e => { e.stopPropagation(); void onSelectCandidate(r.id); }}>
                              <span className="text-base">👁</span>
                            </button>
                            {tab === "suggestions" && (
                              <button className="btn-ghost p-1 rounded text-red-500 hover:bg-red-50" type="button" title="Reprovar"
                                onClick={e => { e.stopPropagation(); void reprove(r.id, r.source); }}>
                                <span className="text-base">✕</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <ScoreCircle score={r.score} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          <aside className="card-soft p-4" style={{ boxShadow: "none" }}>
            {!selected ? (
              <div className="text-muted-foreground text-sm py-10 text-center">
                <span className="block text-2xl mb-2">ℹ️</span>
                Selecione um candidato para ver detalhes.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--lt-primary,#105290)] text-white font-bold text-sm shrink-0">
                    {initials(selected.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-extrabold truncate">{selected.nome || "—"}</div>
                    <div className="text-muted-foreground text-sm truncate">{selected.email || ""}</div>
                    {candidatoFull?.updatedAt && (
                      <div className="text-muted-foreground text-xs mt-0.5">
                        🕐 Atualizado: {new Date(candidatoFull.updatedAt).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-brand w-full text-sm py-2 rounded-xl" type="button" onClick={() => void recalcSelected()}>
                  🔄 Recalcular matching
                </button>

                {/* Score + progress */}
                {matchResult ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${matchResult.pass ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {matchResult.score}% • {matchResult.pass ? "Dentro" : "Abaixo"}
                        </span>
                        <div className="text-muted-foreground text-xs mt-1">Mínimo: <span className="font-mono font-semibold">{matchResult.threshold}%</span></div>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: "var(--lt-primary, #105290)" }}>{matchResult.score}%</div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-[var(--lt-primary,#105290)] h-2 rounded-full transition-all" style={{ width: `${matchResult.score}%` }} />
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {vagaDetail && (
                        <>
                          <span className="badge-soft text-xs">💼 {vagaDetail.titulo}</span>
                          <span className="badge-soft text-xs font-mono">{vagaDetail.codigo}</span>
                          <span className="badge-soft text-xs">📋 Requisitos: <strong className="ml-1">{vagaDetail.requisitos.length}</strong></span>
                          <span className="badge-soft text-xs">✅ Encontrados: <strong className="ml-1">{matchResult.hits.length}</strong></span>
                          <span className="badge-soft text-xs">⚠ Obrig. faltando: <strong className="ml-1">{matchResult.missMandatory.length}</strong></span>
                        </>
                      )}
                    </div>

                    {/* Requirements detail */}
                    {vagaDetail && vagaDetail.requisitos.length > 0 && (
                      <div>
                        <div className="font-bold mb-2">Requisitos (detalhado)</div>
                        <div className="space-y-2">
                          {vagaDetail.requisitos.map(r => {
                            const isHit = matchResult.hits.some(h => h.id === r.id);
                            const isMiss = matchResult.missMandatory.some(m => m.id === r.id);
                            return (
                              <div key={r.id} className={`rounded-xl border p-2 text-sm ${isHit ? "border-green-200 bg-green-50" : isMiss ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold">
                                      {isHit ? "✅" : isMiss ? "❌" : "➖"} {r.termo}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      Peso: <span className="font-mono">{r.peso}</span> •{" "}
                                      <span className={r.obrigatorio ? "text-red-600 font-semibold" : ""}>{r.obrigatorio ? "obrigatório" : "desejável"}</span>
                                    </div>
                                    {r.sinonimos.length > 0 && (
                                      <div className="text-muted-foreground text-xs mt-0.5">Sinônimos: {r.sinonimos.join(", ")}</div>
                                    )}
                                  </div>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isHit ? "bg-green-200 text-green-800" : isMiss ? "bg-red-200 text-red-800" : "bg-gray-200 text-gray-600"}`}>
                                    {isHit ? "OK" : isMiss ? "Faltando" : "Não achou"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Calculation explanation */}
                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="font-bold mb-2">Explicação do cálculo</div>
                      <div className="text-muted-foreground text-xs space-y-1">
                        <div><span className="font-mono">score = (peso_encontrado / peso_total) × 100</span></div>
                        <div>Penalidade: <span className="font-mono">-15 pontos</span> por obrigatório faltando (máx. <span className="font-mono">-40</span>).</div>
                        <div>Critério: <span className="font-mono">score ≥ threshold</span> → "Dentro".</div>
                      </div>
                      <hr className="my-3 border-[rgba(16,82,144,.14)]" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Peso encontrado</span>
                        <span className="font-bold font-mono">{matchResult.hitPeso}/{matchResult.totalPeso}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Penalidade (obrigatórios)</span>
                        <span className="font-bold font-mono">{matchResult.missMandatory.length ? `-${Math.min(40, matchResult.missMandatory.length * 15)}` : "0"}</span>
                      </div>

                      {/* Quick action */}
                      <div className="mt-3 rounded-xl border border-[rgba(16,82,144,.25)] bg-[rgba(173,200,220,.22)] p-3">
                        <div className="font-semibold text-sm" style={{ color: "var(--lt-primary, #105290)" }}>⚡ Ação rápida</div>
                        <div className="text-muted-foreground text-xs mt-1">Recalcule o match após atualizar o texto do CV ou requisitos da vaga.</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button className="btn-ghost text-xs" type="button" onClick={() => void recalcSelected()}>🔄 Recalcular este candidato</button>
                        </div>
                      </div>
                    </div>

                    {/* Resumo profissional */}
                    {candidatoFull && (
                      <div>
                        <div className="font-bold mb-1">Resumo profissional</div>
                        <div className="text-muted-foreground text-sm">{candidatoFull.resumoProfissional?.trim() || "—"}</div>
                      </div>
                    )}

                    {/* Documentos */}
                    {candidatoFull?.documentos && candidatoFull.documentos.length > 0 && (
                      <div>
                        <div className="font-bold mb-1">Documentos</div>
                        {candidatoFull.documentos.map((d, i) => {
                          const name = d.nome ?? d.fileName ?? "Documento";
                          const link = d.url ?? d.link;
                          return link ? (
                            <a key={i} href={link} target="_blank" rel="noopener" className="block text-sm text-blue-600 hover:underline">{name}</a>
                          ) : (<div key={i} className="text-sm text-muted-foreground">{name}</div>);
                        })}
                      </div>
                    )}

                    {/* CV text */}
                    <div>
                      <div className="font-bold mb-1">Trecho do CV (texto)</div>
                      <div className="text-muted-foreground text-xs mb-2">O texto vem do parser (PDF/Word) e é usado para matching.</div>
                      <textarea className="form-control w-full" rows={6} value={cvText}
                        onChange={e => setCvText(e.target.value)} />
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button className="btn-ghost text-xs" type="button" onClick={() => void saveCvText()}>💾 Salvar texto do CV</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-sm py-4 text-center">
                    {candidatoFull === null && selectedId ? "Carregando detalhes…" : "Sem dados de vaga para calcular matching."}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Edit Filters Modal */}
      {showFilterModal && vagaDetail && (
        <FilterModal
          vagaDetail={vagaDetail}
          onClose={() => setShowFilterModal(false)}
          onSave={raw => void saveFiltros(raw)}
        />
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILTER MODAL
   ═══════════════════════════════════════════════════════════════════ */

const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

function FilterModal({ vagaDetail, onClose, onSave }: { vagaDetail: VagaDetail; onClose: () => void; onSave: (raw: string | null) => void }) {
  const parsed = useMemo(() => parseMatchingFiltrosRaw(vagaDetail.matchingFiltrosRaw ?? ""), [vagaDetail]);

  const [modalidade, setModalidade] = useState(parsed.modalidade);
  const [senioridade, setSenioridade] = useState(parsed.senioridade);
  const [escolaridade, setEscolaridade] = useState(parsed.escolaridade);
  const [formacaoArea, setFormacaoArea] = useState(parsed.formacaoArea);
  const [cidade, setCidade] = useState(parsed.cidade);
  const [uf, setUf] = useState(parsed.uf);
  const [tempoExp, setTempoExp] = useState(parsed.tempoExp);
  const [sexo, setSexo] = useState(parsed.sexo);
  const [pcd, setPcd] = useState(parsed.pcd);
  const [idadeMin, setIdadeMin] = useState(parsed.idadeMin);
  const [idadeMax, setIdadeMax] = useState(parsed.idadeMax);
  const [requerCnh, setRequerCnh] = useState(parsed.requerCnh);
  const [cnhCategoria, setCnhCategoria] = useState(parsed.cnhCategoria);
  const [habilidades, setHabilidades] = useState(parsed.habilidades);
  const [observacoes, setObservacoes] = useState(parsed.observacoes);

  function buildRaw(): string | null {
    const parts: string[] = [];
    if (modalidade) parts.push(`Modalidade: ${modalidade}`);
    if (senioridade) parts.push(`Senioridade: ${senioridade}`);
    if (escolaridade) parts.push(`Escolaridade: ${escolaridade}`);
    if (formacaoArea) parts.push(`Formacao: ${formacaoArea}`);
    if (cidade) parts.push(`Cidade: ${cidade}`);
    if (uf) parts.push(`UF: ${uf}`);
    if (tempoExp) parts.push(`TempoExperiencia: ${tempoExp}`);
    if (sexo) parts.push(`Sexo: ${sexo === "M" ? "Masculino" : sexo === "F" ? "Feminino" : "Outro"}`);
    if (pcd) parts.push(`PCD: ${pcd === "S" ? "Sim" : "Nao"}`);
    if (idadeMin) parts.push(`IdadeMin: ${idadeMin}`);
    if (idadeMax) parts.push(`IdadeMax: ${idadeMax}`);
    if (requerCnh) parts.push("RequerCNH: Sim");
    if (requerCnh && cnhCategoria) parts.push(`CategoriaCNH: ${cnhCategoria}`);
    if (habilidades) parts.push(`Habilidades: ${habilidades}`);
    if (observacoes) parts.push(`Observacoes: ${observacoes}`);
    return parts.length ? parts.join(". ") : null;
  }

  const sel = "form-select w-full text-sm py-1.5";
  const inp = "form-control w-full text-sm py-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="font-bold">Filtros de matching (IA)</div>
          <button type="button" className="text-xl opacity-50 hover:opacity-100" onClick={onClose}>✕</button>
        </div>
        <div className="px-5 py-4">
          <div className="font-semibold text-sm">Regras de matching por IA</div>
          <div className="text-muted-foreground text-xs mb-4">Preencha os critérios do candidato ideal. Esses dados serão usados como contexto para o matching (e para a IA).</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-xs text-muted-foreground">Modalidade</label><select className={sel} value={modalidade} onChange={e => setModalidade(e.target.value)}><option value="">Qualquer</option><option value="Presencial">Presencial</option><option value="Remoto">Remoto</option><option value="Hibrido">Híbrido</option></select></div>
            <div><label className="text-xs text-muted-foreground">Senioridade</label><select className={sel} value={senioridade} onChange={e => setSenioridade(e.target.value)}><option value="">Qualquer</option><option value="Junior">Júnior</option><option value="Pleno">Pleno</option><option value="Senior">Sênior</option><option value="Especialista">Especialista</option></select></div>
            <div><label className="text-xs text-muted-foreground">Escolaridade</label><select className={sel} value={escolaridade} onChange={e => setEscolaridade(e.target.value)}><option value="">Qualquer</option><option value="Fundamental">Fundamental</option><option value="Medio">Médio</option><option value="Tecnico">Técnico</option><option value="Superior">Superior</option><option value="PosGraduacao">Pós-graduação</option></select></div>
            <div><label className="text-xs text-muted-foreground">Formação (área)</label><input className={inp} value={formacaoArea} onChange={e => setFormacaoArea(e.target.value)} placeholder="Ex.: Engenharia" /></div>
            <div><label className="text-xs text-muted-foreground">Cidade</label><input className={inp} value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: São Paulo" /></div>
            <div><label className="text-xs text-muted-foreground">UF</label><select className={sel} value={uf} onChange={e => setUf(e.target.value)}><option value="">Qualquer</option>{UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">Tempo de experiência</label><select className={sel} value={tempoExp} onChange={e => setTempoExp(e.target.value)}><option value="">Qualquer</option><option value="0">Sem experiência</option><option value="0-1">0 a 1 ano</option><option value="1-3">1 a 3 anos</option><option value="3-5">3 a 5 anos</option><option value="5+">5 ou mais anos</option></select></div>
            <div><label className="text-xs text-muted-foreground">Sexo</label><select className={sel} value={sexo} onChange={e => setSexo(e.target.value)}><option value="">Qualquer</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="O">Outro</option></select></div>
            <div><label className="text-xs text-muted-foreground">PCD</label><select className={sel} value={pcd} onChange={e => setPcd(e.target.value)}><option value="">Qualquer</option><option value="S">Sim (preferência PCD)</option><option value="N">Não</option></select></div>
            <div><label className="text-xs text-muted-foreground">Idade min.</label><input type="number" className={inp} value={idadeMin} onChange={e => setIdadeMin(e.target.value)} min={14} max={100} placeholder="-" /></div>
            <div><label className="text-xs text-muted-foreground">Idade max.</label><input type="number" className={inp} value={idadeMax} onChange={e => setIdadeMax(e.target.value)} min={14} max={100} placeholder="-" /></div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={requerCnh} onChange={e => setRequerCnh(e.target.checked)} /> Requer CNH</label>
              {requerCnh && (
                <select className={sel} style={{ width: "auto" }} value={cnhCategoria} onChange={e => setCnhCategoria(e.target.value)}>
                  {["A", "B", "AB", "C", "D", "E"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="mt-3"><label className="text-xs text-muted-foreground">Habilidades desejadas</label><input className={inp} value={habilidades} onChange={e => setHabilidades(e.target.value)} placeholder="Ex.: .NET, SQL, APIs REST (separadas por vírgula)" /></div>
          <div className="mt-3"><label className="text-xs text-muted-foreground">Observações adicionais (opcional)</label><textarea className={`${inp} resize-none`} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Outros critérios em texto livre" /></div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-brand" onClick={() => onSave(buildRaw())}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PARSE matchingFiltrosRaw
   ═══════════════════════════════════════════════════════════════════ */

interface ParsedFiltros {
  modalidade: string; senioridade: string; escolaridade: string; formacaoArea: string;
  cidade: string; uf: string; tempoExp: string; sexo: string; pcd: string;
  idadeMin: string; idadeMax: string; requerCnh: boolean; cnhCategoria: string;
  habilidades: string; observacoes: string;
}

function parseMatchingFiltrosRaw(raw: string): ParsedFiltros {
  const out: ParsedFiltros = {
    modalidade: "", senioridade: "", escolaridade: "", formacaoArea: "",
    cidade: "", uf: "", tempoExp: "", sexo: "", pcd: "", idadeMin: "", idadeMax: "",
    requerCnh: false, cnhCategoria: "", habilidades: "", observacoes: "",
  };
  if (!raw?.trim()) return out;
  const parts = raw.split(/\s*\.\s*/).filter(Boolean);
  const re = /^(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observac[oõ]es)\s*:\s*(.+)$/i;
  const obs: string[] = [];
  for (const part of parts) {
    const m = part.match(re);
    if (!m) { obs.push(part); continue; }
    const label = m[1].toLowerCase().replace(/[çõ]/g, c => c === "ç" ? "c" : "o");
    const val = m[2].trim();
    if (label === "modalidade") out.modalidade = val;
    else if (label === "senioridade") out.senioridade = val;
    else if (label === "escolaridade") out.escolaridade = val;
    else if (label === "formacao") out.formacaoArea = val;
    else if (label === "cidade") out.cidade = val;
    else if (label === "uf") out.uf = val;
    else if (label === "tempoexperiencia") out.tempoExp = val;
    else if (label === "sexo") out.sexo = val === "Masculino" ? "M" : val === "Feminino" ? "F" : "O";
    else if (label === "pcd") out.pcd = val === "Sim" ? "S" : "N";
    else if (label === "idademin") out.idadeMin = val;
    else if (label === "idademax") out.idadeMax = val;
    else if (label === "requercnh") out.requerCnh = val === "Sim";
    else if (label === "categoriacnh") out.cnhCategoria = val;
    else if (label === "habilidades") out.habilidades = val;
    else if (label === "observacoes") out.observacoes = val;
  }
  if (obs.length) out.observacoes = [out.observacoes, ...obs].filter(Boolean).join(". ");
  return out;
}
