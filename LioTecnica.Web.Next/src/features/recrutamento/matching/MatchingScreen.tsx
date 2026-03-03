"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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
  mandatoryTotal?: number;
  missingMandatoryCount?: number;
  mandatoryCoverage?: number;
  hardPenalty?: number;
  ruleVersion?: string;
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
  source?: string;
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

interface ProcessingProgressState {
  startedAtMs: number;
  expectedTotalMs: number;
}

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
function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

function timingStorageKey(vagaId: string) {
  return `matching_timing_${vagaId}`;
}

function readExpectedTotalMs(vagaId: string) {
  if (!vagaId || typeof window === "undefined") return 45000;
  try {
    const raw = window.localStorage.getItem(timingStorageKey(vagaId));
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    const valid = arr.filter((x) => Number.isFinite(x) && x >= 5000 && x <= 300000);
    if (!valid.length) return 45000;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return clamp(Math.round(avg), 8000, 120000);
  } catch {
    return 45000;
  }
}

function saveObservedDurationMs(vagaId: string, durationMs: number) {
  if (!vagaId || typeof window === "undefined") return;
  if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 300000) return;
  try {
    const key = timingStorageKey(vagaId);
    const raw = window.localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as number[]) : [];
    const next = [...arr.filter((x) => Number.isFinite(x)), durationMs].slice(-8);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore local storage failures
  }
}
function parsePeso(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return clamp(v, 0, 10);
  const s = pk(v).trim().toLowerCase();
  if (!s) return 0;
  const parsed = Number(s.replace(",", "."));
  if (Number.isFinite(parsed)) return clamp(parsed, 0, 10);
  if (s === "um") return 1;
  if (s === "dois") return 2;
  if (s === "tres" || s === "três") return 3;
  if (s === "quatro") return 4;
  if (s === "cinco") return 5;
  return 0;
}
function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    // For ranking endpoints, return the body even on error (may contain stale data)
    if (url.includes("matching-ranking")) {
      try { return (await res.json()) as T; } catch { /* ignore */ }
    }
    const txt = await res.text().catch(() => "");
    let msg = txt;
    if (txt) {
      try {
        const parsed = JSON.parse(txt) as AnyRec;
        msg = pk(parsed?.message, txt);
      } catch {
        msg = txt;
      }
    }
    throw new Error(msg || `HTTP_${res.status}`);
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
    mandatoryTotal: pn(x.mandatoryTotal),
    missingMandatoryCount: pn(x.missingMandatoryCount),
    mandatoryCoverage: pn(x.mandatoryCoverage, 100),
    hardPenalty: pn(x.hardPenalty),
    ruleVersion: pk(x.ruleVersion),
  };
}

function mapVagaDetail(d: AnyRec): VagaDetail {
  const reqs = Array.isArray(d.requisitos) ? d.requisitos : [];
  return {
    id: pk(d.id),
    titulo: pk(d.titulo),
    codigo: pk(d.codigo),
    threshold: clamp(pn(d.threshold ?? d.matchingThreshold ?? d.matchMinimoPercentual), 0, 100),
    requisitos: reqs.map((r: AnyRec) => ({
      id: pk(r.id ?? r.nome ?? r.termo),
      termo: pk(r.termo ?? r.nome),
      peso: parsePeso(r.peso),
      obrigatorio: !!r.obrigatorio,
      sinonimos: Array.isArray(r.sinonimos)
        ? r.sinonimos.map(String)
        : pk(r.sinonimosRaw)
            .split(/[;,]/)
            .map((x) => x.trim())
            .filter(Boolean),
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
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgressState | null>(null);
  const [processingNowMs, setProcessingNowMs] = useState(() => Date.now());

  const pollRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(1200);
  const detailAbortRef = useRef<AbortController | null>(null);

  // Caches
  const sugCacheRef = useRef<RankItem[] | null>(null);
  const rejCacheRef = useRef<RankItem[] | null>(null);
  const detailCacheRef = useRef<Map<string, CandidatoFull>>(new Map());

  // Stats
  const thresholdForList = useMemo(
    () => clamp(pn(vagaDetail?.threshold, 70), 0, 100),
    [vagaDetail?.threshold],
  );
  const stats = useMemo(() => {
    const total = items.length;
    const inside = tab === "rejected" ? 0 : items.filter((x) => x.score >= thresholdForList).length;
    const fail = total - inside;
    const avg = total ? Math.round(items.reduce((a, b) => a + b.score, 0) / total) : 0;
    return { total, inside, fail, avg };
  }, [items, tab, thresholdForList]);

  // Filtered
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(x => `${x.nome} ${x.email}`.toLowerCase().includes(qq));
  }, [items, q]);

  const selected = useMemo(() => selectedId ? items.find(x => x.id === selectedId) ?? null : null, [items, selectedId]);
  const selectedOfficialPass = useMemo(
    () => !!selected && tab !== "rejected" && selected.score >= thresholdForList,
    [selected, tab, thresholdForList],
  );

  const processingComputed = useMemo(() => {
    if (!processingProgress) return null;
    const elapsedMs = Math.max(0, processingNowMs - processingProgress.startedAtMs);
    const expectedMs = Math.max(8000, processingProgress.expectedTotalMs);
    const progressPct = clamp(Math.round((elapsedMs / expectedMs) * 100), 5, 95);
    const remainingMs = Math.max(0, expectedMs - elapsedMs);
    return { elapsedMs, expectedMs, progressPct, remainingMs };
  }, [processingNowMs, processingProgress]);

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
        const startedAtMs = Date.parse(pk(snap.startedAtUtc));
        const computedAtMs = Date.parse(pk(snap.computedAtUtc));
        if (Number.isFinite(startedAtMs) && Number.isFinite(computedAtMs) && computedAtMs > startedAtMs) {
          saveObservedDurationMs(id, computedAtMs - startedAtMs);
        }
        setProcessingProgress(null);
        pollDelayRef.current = 800;
      } else if (snap?.status === "processing") {
        const stale = mapItems(snap.staleItems);
        if (stale.length) { sugCacheRef.current = stale; setItems(stale); setSelectedId(stale[0]?.id ?? null); }
        setRankStatus("processing");
        const startedAtMs = Date.parse(pk(snap.startedAtUtc));
        const expectedMs = readExpectedTotalMs(id);
        setProcessingNowMs(Date.now());
        setProcessingProgress({
          startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : Date.now(),
          expectedTotalMs: expectedMs,
        });
        const delay = pollDelayRef.current;
        pollDelayRef.current = Math.min(4000, Math.round(delay * 1.2));
        pollTimerRef.current = setTimeout(() => {
          if (pollRef.current !== token) return;
          loadSuggestions(id, true);
        }, delay);
      } else if (snap?.status === "failed") {
        const stale = mapItems(snap.staleItems);
        if (stale.length) { sugCacheRef.current = stale; setItems(stale); setSelectedId(stale[0]?.id ?? null); }
        setRankStatus("failed");
        setProcessingProgress(null);
        toast.error(pk(snap.lastError, "Falha ao carregar ranking."));
      } else {
        // Try to parse as array (simple response)
        const mapped = mapItems(snap?.items ?? snap);
        sugCacheRef.current = mapped.length ? mapped : null;
        setItems(mapped);
        setRankStatus(mapped.length ? "ready" : "failed");
        setSelectedId(mapped[0]?.id ?? null);
        setProcessingProgress(null);
      }
    } catch (e) {
      if (token !== pollRef.current) return;
      setRankStatus("failed");
      setProcessingProgress(null);
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
    setProcessingProgress(null);
    detailCacheRef.current.clear();
    if (detailAbortRef.current) detailAbortRef.current.abort();
    if (!id) return;
    await loadVagaDetail(id);
    if (nextTab === "rejected") await loadRejected(id);
    else await loadSuggestions(id);
  }, [tab, loadVagaDetail, loadSuggestions, loadRejected]);

  // ─── Select candidate ───
  const onSelectCandidate = useCallback(async (id: string) => {
    setSelectedId(id);
    const row = items.find((x) => x.id === id) ?? null;
    if (!row) return;

    const cached = detailCacheRef.current.get(id);
    if (cached) {
      setCandidatoFull(cached);
      setCvText(cached.cvText ?? "");
      return;
    }

    // Preenche instantaneamente com dados já disponíveis da linha para reduzir sensação de lentidão.
    setCandidatoFull({
      id: row.id,
      nome: row.nome,
      email: row.email,
      source: row.source,
      cvText: "",
      resumoProfissional: "",
      documentos: [],
      updatedAt: "",
    });
    setCvText("");

    try {
      if (detailAbortRef.current) detailAbortRef.current.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      let data: AnyRec | null = null;
      if (row.source === "talento") {
        data = await api<AnyRec>(`${BASE}/api/talentos/${encodeURIComponent(id)}`, { signal: controller.signal });
      } else {
        data = await api<AnyRec>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`, { signal: controller.signal });
      }

      if (controller.signal.aborted || !data) return;

      const full: CandidatoFull = {
        id: pk(data.id),
        nome: pk(data.nome, row.nome),
        email: pk(data.email, row.email),
        source: row.source,
        cvText: pk(data.cvText),
        resumoProfissional: pk(data.resumoProfissional),
        documentos: Array.isArray(data.documentos) ? data.documentos : [],
        updatedAt: pk(data.updatedAt ?? data.updatedAtUtc),
      };
      detailCacheRef.current.set(id, full);
      setCandidatoFull(full);
      setCvText(full.cvText ?? "");
    } catch {
      // mantém os dados rápidos da linha se falhar
    }
  }, [items]);

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
    const payloadRaw = (raw ?? "").trim();
    if (!payloadRaw) {
      toast.error("Preencha ao menos 1 filtro de matching antes de salvar.");
      return;
    }
    try {
      const data = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/matching-filtros`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchingFiltrosRaw: payloadRaw }),
      });
      if (data) setVagaDetail(mapVagaDetail(data));
      toast.success("Filtros salvos.");
      setShowFilterModal(false);
      sugCacheRef.current = null;
      detailCacheRef.current.clear();
      setRankStatus("processing");
      setProcessingNowMs(Date.now());
      setProcessingProgress({
        startedAtMs: Date.now(),
        expectedTotalMs: readExpectedTotalMs(vagaId),
      });
      await loadSuggestions(vagaId, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar filtros.");
    }
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
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (detailAbortRef.current) detailAbortRef.current.abort();
    };
  }, []);

  // Tick visual de progresso durante processamento.
  useEffect(() => {
    if (rankStatus !== "processing") return;
    const timer = setInterval(() => setProcessingNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rankStatus]);

  // Auto-select vaga when fixedVagaId is provided (navigated from Vagas screen).
  // Do not depend on the initial vagas list, since this route may open with no preloaded options.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (fixedVagaId && !didAutoSelect.current) {
      didAutoSelect.current = true;
      void onSelectVaga(fixedVagaId, "suggestions");
    }
  }, [fixedVagaId, onSelectVaga]);

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
          <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[12px] text-blue-700">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-medium">🔄 Atualizando ranking…</span>
              {processingComputed && (
                <span className="text-[11px] font-semibold">
                  {processingComputed.progressPct}% • decorrido {formatDuration(processingComputed.elapsedMs)} • falta ~{formatDuration(processingComputed.remainingMs)}
                </span>
              )}
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${processingComputed?.progressPct ?? 8}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-blue-600/85">
              ETA pela média real dos últimos recálculos desta vaga.
            </div>
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
                          {tab === "rejected" ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                              Reprovado
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                r.score >= thresholdForList ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {r.score >= thresholdForList ? "Dentro" : "Abaixo"}
                            </span>
                          )}
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${selectedOfficialPass ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {selected.score}% • {selectedOfficialPass ? "Dentro" : "Abaixo"}
                        </span>
                        <div className="text-muted-foreground text-xs mt-1">Mínimo: <span className="font-mono font-semibold">{matchResult.threshold}%</span></div>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: "var(--lt-primary, #105290)" }}>{selected.score}%</div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-[var(--lt-primary,#105290)] h-2 rounded-full transition-all" style={{ width: `${selected.score}%` }} />
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
                          {selected.ruleVersion ? <span className="badge-soft text-xs">🧠 Regra: <strong className="ml-1">{selected.ruleVersion}</strong></span> : null}
                        </>
                      )}
                    </div>

                    {/* Official IA breakdown */}
                    <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                      <div className="font-bold mb-2">Composição oficial do score (IA)</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">Score filtros</div>
                        <div className="text-right font-semibold">{Math.round(selected.scoreFiltros ?? 0)}%</div>
                        <div className="text-muted-foreground">Score requisitos</div>
                        <div className="text-right font-semibold">{Math.round(selected.scoreRequisitos ?? 0)}%</div>
                        <div className="text-muted-foreground">Cobertura obrigatórios</div>
                        <div className="text-right font-semibold">{Math.round(selected.mandatoryCoverage ?? 100)}%</div>
                        <div className="text-muted-foreground">Obrigatórios faltando</div>
                        <div className="text-right font-semibold">{Math.round(selected.missingMandatoryCount ?? 0)}</div>
                        <div className="text-muted-foreground">Penalidade rígida</div>
                        <div className="text-right font-semibold">-{Math.round(selected.hardPenalty ?? 0)}</div>
                      </div>
                      {selected.justificativa ? (
                        <div className="text-muted-foreground text-xs mt-2">
                          <span className="font-semibold">Justificativa IA:</span> {selected.justificativa}
                        </div>
                      ) : null}
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
                      <div className="font-bold mb-2">Simulação local por texto (apoio)</div>
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
const MODALIDADE_OPTIONS = [
  { code: "Presencial", label: "Presencial" },
  { code: "Remoto", label: "Remoto" },
  { code: "Hibrido", label: "Híbrido" },
];
const SENIORIDADE_OPTIONS = ["Junior", "Pleno", "Senior", "Especialista"];
const ESCOLARIDADE_OPTIONS = ["Fundamental", "Medio", "Tecnico", "Superior", "PosGraduacao"];
const TEMPO_EXP_OPTIONS = [
  { code: "0", label: "Sem experiência" },
  { code: "0-1", label: "0 a 1 ano" },
  { code: "1-3", label: "1 a 3 anos" },
  { code: "3-5", label: "3 a 5 anos" },
  { code: "5+", label: "5 ou mais anos" },
];

function normalizeToken(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

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
    const modalidadeLabel = MODALIDADE_OPTIONS.find((x) => x.code === modalidade)?.label ?? modalidade;
    const tempoExpLabel = TEMPO_EXP_OPTIONS.find((x) => x.code === tempoExp)?.label ?? tempoExp;
    if (modalidade) parts.push(`Modalidade: ${modalidadeLabel}`);
    if (senioridade) parts.push(`Senioridade: ${senioridade}`);
    if (escolaridade) parts.push(`Escolaridade: ${escolaridade}`);
    if (formacaoArea) parts.push(`Formacao: ${formacaoArea}`);
    if (cidade) parts.push(`Cidade: ${cidade}`);
    if (uf) parts.push(`UF: ${uf}`);
    if (tempoExp) parts.push(`TempoExperiencia: ${tempoExpLabel}`);
    if (sexo) parts.push(`Sexo: ${sexo === "M" ? "Masculino" : sexo === "F" ? "Feminino" : "Outro / Não informar"}`);
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
            <div><label className="text-xs text-muted-foreground">Modalidade</label><select className={sel} value={modalidade} onChange={e => setModalidade(e.target.value)}><option value="">Qualquer</option>{MODALIDADE_OPTIONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">Senioridade</label><select className={sel} value={senioridade} onChange={e => setSenioridade(e.target.value)}><option value="">Qualquer</option>{SENIORIDADE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">Escolaridade</label><select className={sel} value={escolaridade} onChange={e => setEscolaridade(e.target.value)}><option value="">Qualquer</option>{ESCOLARIDADE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">Formação (área)</label><input className={inp} value={formacaoArea} onChange={e => setFormacaoArea(e.target.value)} placeholder="Ex.: Engenharia" /></div>
            <div><label className="text-xs text-muted-foreground">Cidade</label><input className={inp} value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: São Paulo" /></div>
            <div><label className="text-xs text-muted-foreground">UF</label><select className={sel} value={uf} onChange={e => setUf(e.target.value)}><option value="">Qualquer</option>{UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><label className="text-xs text-muted-foreground">Tempo de experiência</label><select className={sel} value={tempoExp} onChange={e => setTempoExp(e.target.value)}><option value="">Qualquer</option>{TEMPO_EXP_OPTIONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}</select></div>
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
  const full = raw.trim();
  const keyRe = /(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observac[oõ]es)\s*:/gi;
  const matches: Array<{ label: string; value: string }> = [];
  const found = Array.from(full.matchAll(keyRe));
  for (let i = 0; i < found.length; i++) {
    const curr = found[i];
    const next = found[i + 1];
    const label = curr[1] ?? "";
    const start = (curr.index ?? 0) + curr[0].length;
    const end = next?.index ?? full.length;
    const value = full.slice(start, end).replace(/^\s*[\.\-]?\s*/, "").replace(/\s*[\.\-]?\s*$/, "").trim();
    matches.push({ label, value });
  }

  if (!matches.length) {
    out.observacoes = full;
    return out;
  }

  for (const part of matches) {
    const label = part.label.toLowerCase().replace(/[çõ]/g, (c) => (c === "ç" ? "c" : "o"));
    const val = part.value.trim();
    if (label === "modalidade") {
      const nv = normalizeToken(val);
      if (nv === "presencial") out.modalidade = "Presencial";
      else if (nv === "remoto") out.modalidade = "Remoto";
      else if (nv === "hibrido" || nv === "hibrida") out.modalidade = "Hibrido";
      else out.modalidade = val;
    }
    else if (label === "senioridade") {
      const nv = normalizeToken(val);
      if (nv === "junior") out.senioridade = "Junior";
      else if (nv === "pleno") out.senioridade = "Pleno";
      else if (nv === "senior") out.senioridade = "Senior";
      else if (nv === "especialista") out.senioridade = "Especialista";
      else out.senioridade = val;
    }
    else if (label === "escolaridade") {
      const nv = normalizeToken(val);
      if (nv === "fundamental") out.escolaridade = "Fundamental";
      else if (nv === "medio") out.escolaridade = "Medio";
      else if (nv === "tecnico") out.escolaridade = "Tecnico";
      else if (nv === "superior") out.escolaridade = "Superior";
      else if (nv === "pos-graduacao" || nv === "pos graduacao") out.escolaridade = "PosGraduacao";
      else out.escolaridade = val;
    }
    else if (label === "formacao") out.formacaoArea = val;
    else if (label === "cidade") out.cidade = val;
    else if (label === "uf") out.uf = val;
    else if (label === "tempoexperiencia") {
      const nv = normalizeToken(val);
      if (nv === "sem experiencia") out.tempoExp = "0";
      else if (nv === "0 a 1 ano") out.tempoExp = "0-1";
      else if (nv === "1 a 3 anos") out.tempoExp = "1-3";
      else if (nv === "3 a 5 anos") out.tempoExp = "3-5";
      else if (nv === "5 ou mais anos") out.tempoExp = "5+";
      else out.tempoExp = val;
    }
    else if (label === "sexo") {
      const nv = normalizeToken(val);
      out.sexo = nv === "masculino" ? "M" : nv === "feminino" ? "F" : "O";
    }
    else if (label === "pcd") out.pcd = normalizeToken(val).startsWith("sim") ? "S" : "N";
    else if (label === "idademin") out.idadeMin = val;
    else if (label === "idademax") out.idadeMax = val;
    else if (label === "requercnh") out.requerCnh = val === "Sim";
    else if (label === "categoriacnh") out.cnhCategoria = val;
    else if (label === "habilidades") out.habilidades = val;
    else if (label === "observacoes") out.observacoes = val;
  }
  return out;
}
