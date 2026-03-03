"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  type AnyRec, type VagaOption, type RankItem, type VagaDetail, type CandidatoFull, type TabKey,
  BASE, pk, pn, clamp, initials, formatDuration,
  readExpectedTotalMs, saveObservedDurationMs,
  api, mapVagas, mapRankItem, mapVagaDetail,
} from "./matchingHelpers";
import FilterModal from "./FilterModal";
import CandidateDetailModal from "./CandidateDetailModal";

/* ── Score mini ring for cards ── */
function ScoreCircle({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, offset = circ - (score / 100) * circ;
  const color = score >= 60 ? "#16a34a" : score >= 30 ? "#eab308" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="text-[0.6rem] font-bold" fill={color}>{score}%</text>
    </svg>
  );
}

/* ── CSS injection for modal anim ── */
const STYLE_ID = "matching-modal-keyframes";
function ensureStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style"); s.id = STYLE_ID;
  s.textContent = `@keyframes modalIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`;
  document.head.appendChild(s);
}

type RankingStatus = "idle" | "loading" | "ready" | "processing" | "failed";
interface ProcessingProgress { startedAtMs: number; expectedTotalMs: number; }
const MATCHING_LAST_VAGA_KEY = "renderrh.matching.lastVagaId";

function readClientVagaId(): string {
  if (typeof window === "undefined") return "";
  try {
    const qs = new URLSearchParams(window.location.search || "");
    const fromQuery = (qs.get("vagaId") ?? qs.get("id") ?? "").trim();
    if (fromQuery) return fromQuery;
    const fromSession = (sessionStorage.getItem(MATCHING_LAST_VAGA_KEY) ?? "").trim();
    if (fromSession) return fromSession;
    const fromLocal = (localStorage.getItem(MATCHING_LAST_VAGA_KEY) ?? "").trim();
    if (fromLocal) return fromLocal;
  } catch {
    // ignore
  }
  return "";
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export default function MatchingScreen({ initialVagas, fixedVagaId }: { initialVagas: unknown; fixedVagaId?: string | null }) {
  useEffect(ensureStyles, []);

  const initialVagaOptions = useMemo(() => mapVagas(initialVagas).sort((a, b) => {
    const ta = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0;
    const tb = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0;
    return tb - ta;
  }), [initialVagas]);

  // State
  const [vagaId, setVagaId] = useState<string>(() => readClientVagaId());
  const [tab, setTab] = useState<TabKey>("suggestions");
  const [vagas, setVagas] = useState<VagaOption[]>(initialVagaOptions);
  const [items, setItems] = useState<RankItem[]>([]);
  const [rankStatus, setRankStatus] = useState<RankingStatus>(() => vagaId ? "loading" : "idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetTab, setDropTargetTab] = useState<TabKey | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [vagaDetail, setVagaDetail] = useState<VagaDetail | null>(null);
  const [candidatoFull, setCandidatoFull] = useState<CandidatoFull | null>(null);
  const [cvText, setCvText] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingNowMs, setProcessingNowMs] = useState(() => Date.now());

  const pollRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(1200);
  const loadSuggestionsRef = useRef<(id: string, force?: boolean) => void>(() => { });
  const detailAbortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  // Caches
  const sugCacheRef = useRef<RankItem[] | null>(null);
  const rejCacheRef = useRef<RankItem[] | null>(null);
  const appCacheRef = useRef<RankItem[] | null>(null);
  const pendCacheRef = useRef<RankItem[] | null>(null);
  const detailCacheRef = useRef<Map<string, CandidatoFull>>(new Map());

  // Derived
  const thresholdForList = useMemo(() => clamp(pn(vagaDetail?.threshold, 70), 0, 100), [vagaDetail?.threshold]);
  const selected = useMemo(() => selectedId ? items.find(x => x.id === selectedId) ?? null : null, [items, selectedId]);
  const vagaOptions = useMemo(() => vagas.length ? vagas : initialVagaOptions, [vagas, initialVagaOptions]);

  const processingComputed = useMemo(() => {
    if (!processingProgress) return null;
    const elapsedMs = Math.max(0, processingNowMs - processingProgress.startedAtMs);
    const expectedMs = Math.max(8000, processingProgress.expectedTotalMs);
    return { elapsedMs, expectedMs, progressPct: clamp(Math.round((elapsedMs / expectedMs) * 100), 5, 95), remainingMs: Math.max(0, expectedMs - elapsedMs) };
  }, [processingNowMs, processingProgress]);

  // ─── API loaders ───
  const loadVagaOptions = useCallback(async () => {
    try { const p = await api<AnyRec>(`${BASE}/api/vagas`); setVagas(mapVagas(p).sort((a, b) => { const ta = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0; const tb = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0; return tb - ta; })); } catch { /* keep prev */ }
  }, []);

  const loadVagaDetail = useCallback(async (id: string) => {
    try { const d = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(id)}`); if (d) { const det = mapVagaDetail(d); setVagaDetail(det); return det; } } catch { /* */ }
    return null;
  }, []);

  // Helper: collect IDs of approved+rejected+pending so we can exclude them from triagem
  const loadExcludedIds = useCallback(async (vid: string): Promise<Set<string>> => {
    const ids = new Set<string>();
    try {
      const [appData, rejData, pendData] = await Promise.all([
        api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(vid)}&status=Aprovado&pageSize=200`),
        api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(vid)}&status=Reprovado&pageSize=200`),
        api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(vid)}&status=Pendente&pageSize=200`),
      ]);
      const extract = (d: AnyRec | null) => { const arr = Array.isArray(d?.items) ? d!.items : Array.isArray(d) ? d : []; arr.forEach((x: AnyRec) => { const cid = pk(x.id); if (cid) ids.add(cid); }); };
      extract(appData); extract(rejData); extract(pendData);
    } catch { /* best effort */ }
    return ids;
  }, []);

  const loadSuggestions = useCallback(async (id: string, force = false) => {
    if (!force && sugCacheRef.current) { setItems(sugCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    if (busyRef.current) return;
    const token = ++pollRef.current;
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    setRankStatus("loading");
    try {
      // Load ranking + excluded IDs in parallel
      const [snap, excludedIds] = await Promise.all([
        api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(id)}/matching-ranking?take=20`),
        loadExcludedIds(id),
      ]);
      if (token !== pollRef.current) return;
      const mapItems = (arr: unknown) => (Array.isArray(arr) ? arr.map(mapRankItem).filter(r => !excludedIds.has(r.id)) : []);
      if (snap?.status === "ready") {
        const mapped = mapItems(snap.items); sugCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
        const s = Date.parse(pk(snap.startedAtUtc)), c = Date.parse(pk(snap.computedAtUtc));
        if (Number.isFinite(s) && Number.isFinite(c) && c > s) saveObservedDurationMs(id, c - s);
        setProcessingProgress(null); pollDelayRef.current = 800;
      } else if (snap?.status === "processing") {
        const stale = mapItems(snap.staleItems); if (stale.length) { sugCacheRef.current = stale; setItems(stale); }
        setRankStatus("processing");
        const s = Date.parse(pk(snap.startedAtUtc)); setProcessingNowMs(Date.now());
        setProcessingProgress({ startedAtMs: Number.isFinite(s) ? s : Date.now(), expectedTotalMs: readExpectedTotalMs(id) });
        const delay = pollDelayRef.current; pollDelayRef.current = Math.min(4000, Math.round(delay * 1.2));
        pollTimerRef.current = setTimeout(() => { if (pollRef.current === token) loadSuggestionsRef.current(id, true); }, delay);
      } else if (snap?.status === "failed") {
        const stale = mapItems(snap.staleItems); if (stale.length) { sugCacheRef.current = stale; setItems(stale); }
        setRankStatus("failed"); setProcessingProgress(null); toast.error(pk(snap.lastError, "Falha ao carregar ranking."));
      } else {
        const mapped = mapItems(snap?.items ?? snap); sugCacheRef.current = mapped.length ? mapped : null;
        setItems(mapped); setRankStatus(mapped.length ? "ready" : "failed"); setSelectedId(null); setProcessingProgress(null);
      }
    } catch (e) { if (token !== pollRef.current) return; setRankStatus("failed"); setProcessingProgress(null); toast.error(e instanceof Error ? e.message : "Falha ao carregar ranking."); }
  }, [loadExcludedIds]);

  useEffect(() => { loadSuggestionsRef.current = (id, force = false) => { void loadSuggestions(id, force); }; }, [loadSuggestions]);

  const loadRejected = useCallback(async (id: string, force = false) => {
    if (!force && rejCacheRef.current) { setItems(rejCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Reprovado&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: false, source: "candidato" } as RankItem; }).filter(Boolean) as RankItem[];
      rejCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
    } catch { setRankStatus("failed"); toast.error("Falha ao carregar reprovados."); }
  }, []);

  const loadApproved = useCallback(async (id: string, force = false) => {
    if (!force && appCacheRef.current) { setItems(appCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Aprovado&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: true, source: "candidato" } as RankItem; }).filter(Boolean) as RankItem[];
      appCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
    } catch { setRankStatus("failed"); toast.error("Falha ao carregar aprovados."); }
  }, []);

  const loadPending = useCallback(async (id: string, force = false) => {
    if (!force && pendCacheRef.current) { setItems(pendCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Pendente&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: false, source: "candidato", obs: pk(x.obs) } as RankItem; }).filter(Boolean) as RankItem[];
      pendCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
    } catch { setRankStatus("failed"); toast.error("Falha ao carregar pendentes."); }
  }, []);

  // ─── Select vaga ───
  const onSelectVaga = useCallback(async (id: string, nextTab: TabKey = tab) => {
    setVagaId(id); setSelectedId(null); setCandidatoFull(null); setItems([]); setRankStatus("idle"); setProcessingProgress(null);
    detailCacheRef.current.clear(); sugCacheRef.current = null; rejCacheRef.current = null; appCacheRef.current = null; pendCacheRef.current = null;
    if (detailAbortRef.current) detailAbortRef.current.abort();
    if (!id) return;
    await loadVagaDetail(id);
    if (nextTab === "rejected") await loadRejected(id);
    else if (nextTab === "approved") await loadApproved(id);
    else if (nextTab === "pending") await loadPending(id);
    else await loadSuggestions(id);
  }, [tab, loadVagaDetail, loadSuggestions, loadRejected, loadApproved, loadPending]);

  // ─── Select candidate ───
  const onSelectCandidate = useCallback(async (id: string) => {
    setSelectedId(id);
    const row = items.find(x => x.id === id); if (!row) return;
    const cached = detailCacheRef.current.get(id);
    if (cached) { setCandidatoFull(cached); setCvText(cached.cvText ?? ""); return; }
    setCandidatoFull({ id: row.id, nome: row.nome, email: row.email, source: row.source, cvText: "", resumoProfissional: "", documentos: [], updatedAt: "" }); setCvText("");
    try {
      if (detailAbortRef.current) detailAbortRef.current.abort();
      const controller = new AbortController(); detailAbortRef.current = controller;
      const data = row.source === "talento"
        ? await api<AnyRec>(`${BASE}/api/talentos/${encodeURIComponent(id)}`, { signal: controller.signal })
        : await api<AnyRec>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (controller.signal.aborted || !data) return;
      const full: CandidatoFull = { id: pk(data.id), nome: pk(data.nome, row.nome), email: pk(data.email, row.email), source: row.source, cvText: pk(data.cvText), resumoProfissional: pk(data.resumoProfissional), documentos: Array.isArray(data.documentos) ? data.documentos : [], updatedAt: pk(data.updatedAt ?? data.updatedAtUtc) };
      detailCacheRef.current.set(id, full); setCandidatoFull(full); setCvText(full.cvText ?? "");
    } catch { /* keep row data */ }
  }, [items]);

  // ─── Actions ───
  async function recalcSelected() {
    if (!vagaId || !selectedId) return;
    try { await api(`${BASE}/api/matching/recalculate?candidatoId=${selectedId}&vagaId=${vagaId}`, { method: "POST" }); toast.success("Recalcular solicitado."); sugCacheRef.current = null; await loadSuggestions(vagaId, true); } catch { toast.error("Falha ao recalcular."); }
  }

  async function changeStatus(id: string, source: string | undefined, newStatus: string, obs?: string) {
    if (!vagaId) return;
    const row = items.find((x) => x.id === id) ?? null;
    const targetTab: TabKey = newStatus === "Aprovado" ? "approved" : newStatus === "Reprovado" ? "rejected" : newStatus === "Pendente" ? "pending" : "suggestions";
    const targetPass = targetTab === "approved" ? true : targetTab === "rejected" ? false : (row?.score ?? 0) >= thresholdForList;

    // Optimistic update: remove from ALL caches
    const removeById = (list: RankItem[] | null) => list === null ? null : list.filter((x) => x.id !== id);

    // Get the target cache ref
    const targetCacheRef = targetTab === "approved" ? appCacheRef : targetTab === "rejected" ? rejCacheRef : targetTab === "pending" ? pendCacheRef : sugCacheRef;
    // Check if target tab was never loaded BEFORE we touch caches
    const wasNeverLoaded = targetCacheRef.current === null;

    sugCacheRef.current = removeById(sugCacheRef.current);
    rejCacheRef.current = removeById(rejCacheRef.current);
    appCacheRef.current = removeById(appCacheRef.current);
    pendCacheRef.current = removeById(pendCacheRef.current);

    // If target cache was never loaded, pre-load it from API first
    if (wasNeverLoaded && targetTab !== "suggestions") {
      try {
        const statusParam = newStatus;
        const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&status=${statusParam}&pageSize=100`);
        const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: targetPass, source: "candidato", obs: pk(x.obs) } as RankItem; }).filter(Boolean) as RankItem[];
        targetCacheRef.current = mapped.filter((x) => x.id !== id); // ensure no duplicate of moved item
      } catch { targetCacheRef.current = []; }
    }

    // Add the moved item to the top of the target cache
    if (row) {
      const moved: RankItem = { ...row, pass: targetPass };
      targetCacheRef.current = [moved, ...(targetCacheRef.current ?? [])];
    }

    // Switch to target tab instantly, highlight the moved card
    setTab(targetTab);
    setSelectedId(null);
    setCandidatoFull(null);
    setRankStatus("ready");
    setHighlightId(id);
    setItems(targetCacheRef.current ?? []);
    // Clear highlight after a moment
    setTimeout(() => setHighlightId(null), 2000);

    // Fire API in background
    try {
      if (source === "talento") {
        const item = row;
        void api(`${BASE}/api/candidatos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ talentoId: id, vagaId, status: newStatus, nome: item?.nome ?? "Talento", email: item?.email ?? "", fonte: "Site", obs: obs ?? null }) });
      } else {
        const cand = await api<AnyRec>(`${BASE}/api/candidatos/${id}`);
        if (cand) {
          const updateBody = {
            nome: pk(cand.nome, row?.nome ?? ""),
            email: pk(cand.email, row?.email ?? ""),
            fone: cand.fone ?? null,
            cidade: cand.cidade ?? null,
            uf: cand.uf ?? null,
            fonte: cand.fonte ?? "Site",
            status: newStatus,
            vagaId: cand.vagaId ?? vagaId,
            obs: obs ?? cand.obs ?? null,
            cvText: cand.cvText ?? null,
            lastMatch: cand.lastMatch ?? null,
            documentos: cand.documentos?.map((d: AnyRec) => ({ tipo: d.tipo, nomeArquivo: d.nomeArquivo ?? d.fileName ?? "", contentType: d.contentType ?? null, descricao: d.descricao ?? null, tamanhoBytes: d.tamanhoBytes ?? null, url: d.url ?? null })) ?? [],
            talentoId: cand.talentoId ?? null,
          };
          void api(`${BASE}/api/candidatos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateBody) });
        }
      }
      const msgs: Record<string, string> = { Aprovado: "Aprovado.", Reprovado: "Reprovado.", Pendente: "Movido para pendentes.", Triagem: "Movido para triagem." };
      toast.success(msgs[newStatus] ?? "Status atualizado.");
    } catch (e) { toast.error("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }

  function tabToStatus(t: TabKey): "Aprovado" | "Reprovado" | "Pendente" | "Triagem" {
    if (t === "approved") return "Aprovado";
    if (t === "rejected") return "Reprovado";
    if (t === "pending") return "Pendente";
    return "Triagem";
  }

  function promptPendente(id: string, source: string | undefined) {
    const obs = prompt("Observação sobre o que está pendente:");
    if (obs === null) return; // user cancelled
    void changeStatus(id, source, "Pendente", obs.trim() || undefined);
  }

  async function handleDropToTab(targetTab: TabKey, droppedId?: string, droppedSource?: string) {
    const id = (droppedId ?? draggingId ?? "").trim();
    setDropTargetTab(null);
    setDraggingId(null);
    if (!id || targetTab === tab) return;
    const row = items.find((x) => x.id === id);
    const source = droppedSource ?? row?.source;
    if (!source && !row) return;
    // Stay on current tab — the card just disappears from here
    await changeStatus(id, source, tabToStatus(targetTab));
  }

  async function saveCvText() {
    if (!selectedId || !candidatoFull) return;
    try { const cand = await api<AnyRec>(`${BASE}/api/candidatos/${selectedId}`); if (cand) { cand.cvText = cvText; await api(`${BASE}/api/candidatos/${selectedId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand) }); toast.success("Texto do CV salvo."); } } catch { toast.error("Falha ao salvar CV."); }
  }

  async function saveFiltros(raw: string | null) {
    if (!vagaId) return;
    if (busyRef.current) { toast.error("Aguarde a operação anterior finalizar."); return; }
    const payloadRaw = (raw ?? "").trim();
    if (!payloadRaw) { toast.error("Preencha ao menos 1 filtro."); return; }
    busyRef.current = true;
    // cancel any active polling to avoid DbContext concurrency
    ++pollRef.current;
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    try {
      const data = await api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/matching-filtros`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchingFiltrosRaw: payloadRaw }) });
      if (data) setVagaDetail(mapVagaDetail(data));
      toast.success("Filtros salvos."); setShowFilterModal(false);
      sugCacheRef.current = null; detailCacheRef.current.clear();
      setRankStatus("processing"); setProcessingNowMs(Date.now());
      setProcessingProgress({ startedAtMs: Date.now(), expectedTotalMs: readExpectedTotalMs(vagaId) });
      busyRef.current = false;
      await loadSuggestions(vagaId, true);
    } catch (e) { busyRef.current = false; toast.error(e instanceof Error ? e.message : "Falha ao salvar filtros."); }
  }

  async function revertFiltros() {
    if (!vagaId || !vagaDetail) return;
    await saveFiltros(vagaDetail.matchingFiltrosOriginaisRaw || null);
  }

  // ─── Effects ───
  useEffect(() => { return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); if (detailAbortRef.current) detailAbortRef.current.abort(); }; }, []);
  useEffect(() => { if (initialVagaOptions.length > 0) return; const t = setTimeout(() => { void loadVagaOptions(); }, 0); return () => clearTimeout(t); }, [initialVagaOptions.length, loadVagaOptions]);
  useEffect(() => { if (rankStatus !== "processing") return; const timer = setInterval(() => setProcessingNowMs(Date.now()), 1000); return () => clearInterval(timer); }, [rankStatus]);

  // Auto-load: resolve vagaId and fetch ranking on first mount
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    const resolved = (fixedVagaId ?? "").trim() || readClientVagaId();
    if (!resolved) return;
    didInit.current = true;
    try {
      sessionStorage.setItem(MATCHING_LAST_VAGA_KEY, resolved);
      localStorage.setItem(MATCHING_LAST_VAGA_KEY, resolved);
    } catch { /* ignore */ }
    void onSelectVaga(resolved, "suggestions");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedVagaId, onSelectVaga]);

  /* ═══════════ RENDER ═══════════ */
  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "suggestions", label: "Triagem", icon: "📋" },
    { key: "approved", label: "Aprovados", icon: "✅" },
    { key: "rejected", label: "Reprovados", icon: "❌" },
    { key: "pending", label: "Pendentes", icon: "⏳" },
  ];

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold">
            Matching{vagaDetail?.titulo ? ` — ${vagaDetail.titulo}` : ""}
          </h4>
          <div className="text-muted-foreground text-sm">Pontuação automática por IA.</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Link className="btn-ghost text-sm" href="/vagas">← Voltar para vagas</Link>
          {vagaId && vagaDetail && (
            <button className="btn-ghost text-sm" type="button" onClick={() => setShowFilterModal(true)}>✏️ Filtros IA</button>
          )}
          {vagaId && vagaDetail && vagaDetail.matchingFiltrosOriginaisRaw != null && vagaDetail.matchingFiltrosOriginaisRaw !== (vagaDetail.matchingFiltrosRaw ?? "") && (
            <button className="btn-ghost text-sm" type="button" onClick={() => void revertFiltros()}>↩ Reverter filtros</button>
          )}
        </div>
      </div>

      {!vagaId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Vaga não informada. Abra o matching a partir da tela de vagas.
        </div>
      ) : null}

      <div className="grid grid-cols-4 rounded-xl overflow-hidden border border-[rgba(16,82,144,.12)] bg-white">
        {TABS.map(t => (
          <button key={t.key} type="button"
            className={`py-3 text-sm font-semibold transition-all text-center focus-visible:outline-none ${tab === t.key ? "bg-[rgb(var(--lt-primary))] text-white hover:bg-[rgb(var(--lt-primary))] active:bg-[rgb(var(--lt-primary))]" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"} ${dropTargetTab === t.key ? "ring-2 ring-inset ring-emerald-400" : ""}`}
            onDragOver={(e) => {
              const hasPayload = e.dataTransfer.types.includes("text/plain");
              if (!hasPayload || t.key === tab) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTargetTab(t.key);
            }}
            onDragLeave={() => {
              if (dropTargetTab === t.key) setDropTargetTab(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedId = (e.dataTransfer.getData("text/plain") || "").trim();
              const droppedSource = (e.dataTransfer.getData("application/x-renderrh-source") || "").trim() || undefined;
              void handleDropToTab(t.key, droppedId, droppedSource);
            }}
            onClick={() => {
              // During drag, mouseup over tab can trigger click; ignore this.
              if (draggingId) return;
              setTab(t.key);
              if (vagaId) void onSelectVaga(vagaId, t.key);
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {vagaId && items.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Arraste um candidato para uma aba para mover rápido entre status.
        </div>
      )}

      {/* Processing banner */}
      {rankStatus === "processing" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">🔄 Atualizando ranking…</span>
            {processingComputed && <span className="text-xs font-semibold">{processingComputed.progressPct}% • {formatDuration(processingComputed.elapsedMs)} • ~{formatDuration(processingComputed.remainingMs)}</span>}
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${processingComputed?.progressPct ?? 8}%` }} />
          </div>
        </div>
      )}
      {rankStatus === "failed" && items.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">⚠ Falha ao atualizar. Exibindo último resultado disponível.</div>
      )}

      {/* Cards grid */}
      {rankStatus === "loading" && items.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Carregando…</div>
      ) : items.length === 0 && vagaId ? (
        <div className="text-muted-foreground text-center py-12">
          {tab === "rejected" ? "Nenhum reprovado." : tab === "approved" ? "Nenhum aprovado." : "Nenhuma sugestão encontrada."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(r => {
            const isPass = r.score >= thresholdForList;
            return (
              <div key={r.id}
                className={`group relative rounded-2xl border bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-[rgb(var(--lt-primary))] ${draggingId === r.id ? "opacity-60 scale-[0.99]" : ""} ${highlightId === r.id ? "ring-2 ring-emerald-400 border-emerald-300 shadow-md" : "border-gray-200"}`}
                draggable
                onDragStart={(e) => {
                  setDraggingId(r.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", r.id);
                  e.dataTransfer.setData("application/x-renderrh-source", r.source ?? "");
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTargetTab(null);
                }}
                onClick={() => void onSelectCandidate(r.id)}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgb(var(--lt-primary))] text-white font-bold text-xs shrink-0">
                    {initials(r.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{r.nome || "—"}</div>
                    <div className="text-muted-foreground text-xs truncate">{r.email || "—"}</div>
                  </div>
                  <ScoreCircle score={r.score} />
                </div>

                <div className="flex items-center gap-2 mt-3">
                  {r.source && <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${r.source === "talento" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700"}`}>{r.source === "talento" ? "Talento" : "Candidato"}</span>}
                  {tab !== "rejected" && <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${isPass ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{isPass ? "Dentro" : "Abaixo"}</span>}
                  {tab === "rejected" && <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold bg-red-100 text-red-700">Reprovado</span>}
                  {tab === "approved" && <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold bg-green-100 text-green-700">Aprovado</span>}
                </div>

                {/* Inline actions */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-[rgba(16,82,144,.06)]">
                  {tab === "suggestions" && <>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Aprovado"); }}>✅ Aprovar</button>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Reprovado"); }}>✕ Reprovar</button>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); promptPendente(r.id, r.source); }}>⏳ Pendente</button>
                  </>}
                  {tab === "approved" && <>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Triagem"); }}>↩ Triagem</button>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Reprovado"); }}>✕ Reprovar</button>
                  </>}
                  {tab === "rejected" && <button className="text-xs py-1 px-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Triagem"); }}>↩ Voltar p/ Triagem</button>}
                  {tab === "pending" && <>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Aprovado"); }}>✅ Aprovar</button>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Triagem"); }}>↩ Triagem</button>
                    <button className="text-xs py-1 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-semibold" type="button" onClick={e => { e.stopPropagation(); void changeStatus(r.id, r.source, "Reprovado"); }}>✕ Reprovar</button>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && selectedId && (
        <CandidateDetailModal
          item={selected}
          candidatoFull={candidatoFull}
          vagaDetail={vagaDetail}
          tab={tab}
          threshold={thresholdForList}
          cvText={cvText}
          onCvTextChange={setCvText}
          onClose={() => { setSelectedId(null); setCandidatoFull(null); }}
          onRecalc={() => void recalcSelected()}
          onApprove={() => void changeStatus(selected.id, selected.source, "Aprovado")}
          onReject={() => void changeStatus(selected.id, selected.source, "Reprovado")}
          onRestore={() => void changeStatus(selected.id, selected.source, "Triagem")}
          onPending={() => promptPendente(selected.id, selected.source)}
          onSaveCv={() => void saveCvText()}
        />
      )}

      {/* Filter Modal */}
      {showFilterModal && vagaDetail && <FilterModal vagaDetail={vagaDetail} onClose={() => setShowFilterModal(false)} onSave={raw => void saveFiltros(raw)} />}
    </section>
  );
}
