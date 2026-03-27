"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Check, X, Clock, ClipboardList, Eye, Mail, MessageCircle, Linkedin, ArrowLeft, SlidersHorizontal, RotateCcw, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
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

function FlowStageCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Fluxo</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
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
  const [topN, setTopN] = useState(20);
  const [cachedCount, setCachedCount] = useState(0);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingNowMs, setProcessingNowMs] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editingObsText, setEditingObsText] = useState("");
  const [showProjetoModal, setShowProjetoModal] = useState(false);
  const [projetos, setProjetos] = useState<{ id: string; numero: number; descricao: string | null; status: number }[]>([]);
  const [newProjetoDesc, setNewProjetoDesc] = useState("");

  const pollRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef(3000);
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
    const expectedMs = Math.max(30000, processingProgress.expectedTotalMs);
    // Curva logarítmica: avança rápido até ~60%, desacelera gradualmente, nunca ultrapassa 95%
    const ratio = elapsedMs / expectedMs;
    const progressPct = ratio >= 1
      ? clamp(Math.round(90 + 5 * (1 - Math.exp(-(ratio - 1) * 0.5))), 90, 95)
      : clamp(Math.round(ratio * 90), 2, 90);
    return { elapsedMs, expectedMs, progressPct };
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
        api<AnyRec>(`${BASE}/api/vagas/${encodeURIComponent(id)}/matching-ranking?take=${topN}`),
        loadExcludedIds(id),
      ]);
      if (token !== pollRef.current) return;
      const mapItems = (arr: unknown) => (Array.isArray(arr) ? arr.map(mapRankItem).filter(r => !excludedIds.has(r.id)) : []);
      if (snap?.status === "ready") {
        const mapped = mapItems(snap.items); sugCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
        if (typeof snap.cachedCount === "number") setCachedCount(snap.cachedCount);
        const s = Date.parse(pk(snap.startedAtUtc)), c = Date.parse(pk(snap.computedAtUtc));
        if (Number.isFinite(s) && Number.isFinite(c) && c > s) saveObservedDurationMs(id, c - s);
        setProcessingProgress(null); pollDelayRef.current = 3000;
      } else if (snap?.status === "processing") {
        const stale = mapItems(snap.staleItems); if (stale.length) { sugCacheRef.current = stale; setItems(stale); }
        setRankStatus("processing");
        const s = Date.parse(pk(snap.startedAtUtc)); setProcessingNowMs(Date.now());
        setProcessingProgress({ startedAtMs: Number.isFinite(s) ? s : Date.now(), expectedTotalMs: readExpectedTotalMs(id) });
        const delay = pollDelayRef.current; pollDelayRef.current = Math.min(10000, Math.round(delay * 1.4));
        pollTimerRef.current = setTimeout(() => { if (pollRef.current === token) loadSuggestionsRef.current(id, true); }, delay);
      } else if (snap?.status === "failed") {
        const stale = mapItems(snap.staleItems); if (stale.length) { sugCacheRef.current = stale; setItems(stale); }
        setRankStatus("failed"); setProcessingProgress(null); toast.error(pk(snap.lastError, "Falha ao carregar ranking."));
      } else {
        const mapped = mapItems(snap?.items ?? snap); sugCacheRef.current = mapped.length ? mapped : null;
        setItems(mapped); setRankStatus(mapped.length ? "ready" : "failed"); setSelectedId(null); setProcessingProgress(null);
      }
    } catch (e) { if (token !== pollRef.current) return; setRankStatus("failed"); setProcessingProgress(null); toast.error(e instanceof Error ? e.message : "Falha ao carregar ranking."); }
  }, [loadExcludedIds, topN]);

  useEffect(() => { loadSuggestionsRef.current = (id, force = false) => { void loadSuggestions(id, force); }; }, [loadSuggestions]);

  // Reload when topN changes (loadSuggestionsRef must be updated first, so run in next micro-task)
  const prevTopNRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevTopNRef.current === null) { prevTopNRef.current = topN; return; }
    if (prevTopNRef.current === topN) return;
    prevTopNRef.current = topN;
    if (!vagaId || tab !== "suggestions") return;
    sugCacheRef.current = null;
    // Defer so loadSuggestionsRef is updated after loadSuggestions recreates with new topN
    const t = setTimeout(() => loadSuggestionsRef.current(vagaId, true), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topN]);

  const loadRejected = useCallback(async (id: string, force = false) => {
    if (!force && rejCacheRef.current) { setItems(rejCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Reprovado&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: false, source: "candidato", obs: pk(x.obs), trabalhando: x.trabalhandoAtualmente ?? null, linkedinUrl: pk(x.linkedinUrl), fone: pk(x.fone), cidade: pk(x.cidade), uf: pk(x.uf) } as RankItem; }).filter(Boolean) as RankItem[];
      rejCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
    } catch { setRankStatus("failed"); toast.error("Falha ao carregar reprovados."); }
  }, []);

  const loadApproved = useCallback(async (id: string, force = false) => {
    if (!force && appCacheRef.current) { setItems(appCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Aprovado&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: true, source: "candidato", obs: pk(x.obs), trabalhando: x.trabalhandoAtualmente ?? null, linkedinUrl: pk(x.linkedinUrl), fone: pk(x.fone), cidade: pk(x.cidade), uf: pk(x.uf) } as RankItem; }).filter(Boolean) as RankItem[];
      appCacheRef.current = mapped; setItems(mapped); setRankStatus("ready"); setSelectedId(null);
    } catch { setRankStatus("failed"); toast.error("Falha ao carregar aprovados."); }
  }, []);

  const loadPending = useCallback(async (id: string, force = false) => {
    if (!force && pendCacheRef.current) { setItems(pendCacheRef.current); setRankStatus("ready"); setSelectedId(null); return; }
    setRankStatus("loading");
    try {
      const data = await api<AnyRec>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&status=Pendente&pageSize=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const mapped: RankItem[] = arr.map((x: AnyRec) => { const cid = pk(x.id); if (!cid) return null; const lm = x.lastMatch ?? {}; return { id: cid, nome: pk(x.nome), email: pk(x.email), score: clamp(pn(lm.score), 0, 100), pass: false, source: "candidato", obs: pk(x.obs), trabalhando: x.trabalhandoAtualmente ?? null, linkedinUrl: pk(x.linkedinUrl), fone: pk(x.fone), cidade: pk(x.cidade), uf: pk(x.uf) } as RankItem; }).filter(Boolean) as RankItem[];
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
      const full: CandidatoFull = { id: pk(data.id), nome: pk(data.nome, row.nome), email: pk(data.email, row.email), source: row.source, cvText: pk(data.cvText), resumoProfissional: pk(data.resumoProfissional), documentos: Array.isArray(data.documentos) ? data.documentos : [], updatedAt: pk(data.updatedAt ?? data.updatedAtUtc), linkedinUrl: pk(data.linkedinUrl), fone: pk(data.fone), trabalhando: data.trabalhandoAtualmente ?? null, pretensaoSalarial: pk(data.pretensaoSalarial), cidade: pk(data.cidade), uf: pk(data.uf) };
      detailCacheRef.current.set(id, full); setCandidatoFull(full); setCvText(full.cvText ?? "");
    } catch { /* keep row data */ }
  }, [items]);

  // ─── Actions ───
  async function recalcSelected() {
    if (!vagaId || !selectedId) return;
    try { await api(`${BASE}/api/matching/recalculate?candidatoId=${selectedId}&vagaId=${vagaId}`, { method: "POST" }); toast.success("Recalcular solicitado."); sugCacheRef.current = null; await loadSuggestions(vagaId, true); } catch { toast.error("Falha ao recalcular."); }
  }

  function statusToTabKey(status: string): TabKey {
    if (status === "Aprovado") return "approved";
    if (status === "Reprovado") return "rejected";
    return "suggestions";
  }

  async function persistStatusChange(id: string, source: string | undefined, newStatus: string, obs?: string) {
    if (!vagaId) return;

    const row = items.find((x) => x.id === id) ?? null;
    if (source === "talento") {
      await api(`${BASE}/api/candidatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          talentoId: id,
          vagaId,
          status: newStatus,
          nome: row?.nome ?? "Talento",
          email: row?.email ?? "",
          fonte: "Site",
          obs: obs ?? null,
        }),
      });
      return;
    }

    const cand = await api<AnyRec>(`${BASE}/api/candidatos/${id}`);
    if (!cand) throw new Error("Candidato não encontrado.");

    const updateBody = {
      nome: pk(cand.nome, row?.nome ?? ""),
      email: pk(cand.email, row?.email ?? ""),
      fone: cand.fone ?? null,
      cidade: cand.cidade ?? null,
      uf: cand.uf ?? null,
      linkedinUrl: cand.linkedinUrl ?? null,
      fonte: cand.fonte ?? "Site",
      status: newStatus,
      vagaId: cand.vagaId ?? vagaId,
      trabalhandoAtualmente: cand.trabalhandoAtualmente ?? null,
      pretensaoSalarial: cand.pretensaoSalarial ?? null,
      obs: obs ?? cand.obs ?? null,
      cvText: cand.cvText ?? null,
      lastMatch: null,
      documentos: null,
      talentoId: cand.talentoId ?? null,
    };

    await api(`${BASE}/api/candidatos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateBody),
    });
  }

  async function changeStatus(id: string, source: string | undefined, newStatus: string, obs?: string) {
    if (!vagaId) return;
    const targetTab = statusToTabKey(newStatus);
    const msgs: Record<string, string> = {
      Aprovado: "Candidato aprovado.",
      Reprovado: "Candidato reprovado.",
      Triagem: "Candidato movido para triagem.",
    };

    try {
      await persistStatusChange(id, source, newStatus, obs);
      sugCacheRef.current = null;
      rejCacheRef.current = null;
      appCacheRef.current = null;
      pendCacheRef.current = null;
      detailCacheRef.current.delete(id);
      setTab(targetTab);
      setSelectedId(null);
      setSelectedIds(new Set());
      setCandidatoFull(null);
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 2000);
      await onSelectVaga(vagaId, targetTab);
      toast.success(msgs[newStatus] ?? "Status atualizado.");
    } catch (e) {
      toast.error("Erro ao mover candidato: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function tabToStatus(t: TabKey): "Aprovado" | "Reprovado" | "Triagem" {
    if (t === "approved") return "Aprovado";
    if (t === "rejected") return "Reprovado";
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

  // ─── Inline obs save ───
  async function saveObs(candidateId: string, newObs: string) {
    try {
      const cand = await api<AnyRec>(`${BASE}/api/candidatos/${candidateId}`);
      if (cand) {
        cand.obs = newObs;
        await api(`${BASE}/api/candidatos/${candidateId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand) });
        // Update local items
        setItems(prev => prev.map(r => r.id === candidateId ? { ...r, obs: newObs } : r));
        // Update caches
        const updateCache = (cache: RankItem[] | null) => cache?.map(r => r.id === candidateId ? { ...r, obs: newObs } : r) ?? null;
        sugCacheRef.current = updateCache(sugCacheRef.current);
        rejCacheRef.current = updateCache(rejCacheRef.current);
        appCacheRef.current = updateCache(appCacheRef.current);
        pendCacheRef.current = updateCache(pendCacheRef.current);
        toast.success("Observação salva.");
      }
    } catch { toast.error("Falha ao salvar observação."); }
  }

  // ─── Projetos helpers ───
  async function loadProjetos() {
    if (!vagaId) return;
    try {
      const data = await api<{ id: string; numero: number; descricao: string | null; status: number }[]>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/projetos`);
      setProjetos(Array.isArray(data) ? data : []);
    } catch { setProjetos([]); }
  }

  async function sendToProjeto(projetoId: string) {
    const ids = Array.from(selectedIds);
    if (!ids.length) { toast.error("Selecione ao menos 1 candidato."); return; }
    let ok = 0, fail = 0;
    for (const cid of ids) {
      try {
        await api(`${BASE}/api/projetos/${encodeURIComponent(projetoId)}/candidatos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidatoId: cid, observacoes: null }) });
        ok++;
      } catch { fail++; }
    }
    toast.success(`${ok} candidato(s) enviado(s).${fail ? ` ${fail} erro(s).` : ""}`);
    setShowProjetoModal(false); setSelectedIds(new Set());
  }

  async function createAndSend() {
    if (!vagaId) return;
    try {
      const created = await api<{ id: string }>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/projetos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: newProjetoDesc.trim() || null }) });
      if (created?.id) await sendToProjeto(created.id);
    } catch { toast.error("Falha ao criar projeto."); }
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
  useEffect(() => { if (rankStatus !== "processing") return; const timer = setInterval(() => setProcessingNowMs(Date.now()), 3000); return () => clearInterval(timer); }, [rankStatus]);

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
  const TABS: { key: TabKey; label: string }[] = [
    { key: "suggestions", label: "Triagem IA" },
    { key: "approved", label: "Aprovados" },
    { key: "rejected", label: "Reprovados" },
  ];

  const tabCountMap: Partial<Record<TabKey, number>> = {
    suggestions: sugCacheRef.current?.length ?? (tab === "suggestions" ? items.length : undefined),
    approved: appCacheRef.current?.length ?? (tab === "approved" ? items.length : undefined),
    rejected: rejCacheRef.current?.length ?? (tab === "rejected" ? items.length : undefined),
  };

  // Filtered items for search
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredItems = normalizedQuery
    ? items.filter(r => (r.nome ?? "").toLowerCase().includes(normalizedQuery) || (r.email ?? "").toLowerCase().includes(normalizedQuery))
    : items;

  // KPI computations
  const kpiTotal = items.length;
  const kpiAvgScore = kpiTotal > 0 ? Math.round(items.reduce((s, r) => s + r.score, 0) / kpiTotal) : 0;
  const kpiAboveThreshold = items.filter(r => r.score >= thresholdForList).length;
  const kpiBelowThreshold = kpiTotal - kpiAboveThreshold;

  // Batch selection helpers
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(r => selectedIds.has(r.id));
  function toggleSelectAll() {
    if (allVisibleSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(filteredItems.map(r => r.id))); }
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function batchAction(status: string) {
    if (!vagaId) return;
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const row = items.find(r => r.id === id);
      if (!row) continue;
      try {
        await persistStatusChange(id, row.source, status);
        detailCacheRef.current.delete(id);
        success++;
      } catch {
        failed++;
      }
    }

    sugCacheRef.current = null;
    rejCacheRef.current = null;
    appCacheRef.current = null;
    pendCacheRef.current = null;
    setSelectedIds(new Set());

    if (success > 0) {
      const targetTab = statusToTabKey(status);
      setTab(targetTab);
      await onSelectVaga(vagaId, targetTab);
    }

    if (success > 0) {
      toast.success(failed > 0
        ? `${success} candidato(s) movido(s). ${failed} falharam.`
        : `${success} candidato(s) atualizados.`);
    } else if (failed > 0) {
      toast.error("Não foi possível atualizar os candidatos selecionados.");
    }
  }

  return (
    <section className="space-y-5">
      {/* Header + Vaga Context — unified */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {vagaId && (
            <Link href="/vagas" className="inline-flex items-center justify-center size-8 rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight truncate">
              {vagaDetail?.titulo ?? "Matching IA"}
            </h1>
            {vagaDetail ? (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {vagaDetail.area && <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">{vagaDetail.area}</span>}
                {vagaDetail.modalidade && <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">{vagaDetail.modalidade}</span>}
                {vagaDetail.senioridade && <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">{vagaDetail.senioridade}</span>}
                {(vagaDetail.cidade || vagaDetail.uf) && <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">{[vagaDetail.cidade, vagaDetail.uf].filter(Boolean).join("/")}</span>}
                {(vagaDetail.quantidadeVagas ?? 0) > 0 && <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">{vagaDetail.quantidadeVagas} vaga(s)</span>}
                <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-600">Corte {vagaDetail.threshold}%</span>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs mt-0.5">Ranqueamento automático por inteligência artificial</p>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {vagaId && (
            <>
              <Link className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" href={`/candidatos?vagaId=${encodeURIComponent(vagaId)}`}>
                <ClipboardList className="size-3" /> Candidatos
              </Link>
              <Link className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" href={`/gestao/projetos?vagaId=${encodeURIComponent(vagaId)}`}>
                <FolderOpen className="size-3" /> Rodadas
              </Link>
            </>
          )}
          {vagaId && vagaDetail && (
            <>
              <button className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" type="button" onClick={() => setShowFilterModal(true)}>
                <SlidersHorizontal className="size-3" /> Filtros IA
              </button>
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Top</span>
                <input type="number" min={5} max={100} step={5} value={topN} className="w-10 bg-transparent text-xs font-semibold text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" onChange={(e) => { setTopN(Math.min(100, Math.max(5, Number(e.target.value) || 20))); }} />
              </div>
            </>
          )}
          {vagaId && vagaDetail && vagaDetail.matchingFiltrosOriginaisRaw != null && vagaDetail.matchingFiltrosOriginaisRaw !== (vagaDetail.matchingFiltrosRaw ?? "") && (
            <button className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" type="button" onClick={() => void revertFiltros()}>
              <RotateCcw className="size-3" /> Reverter
            </button>
          )}
        </div>
      </div>

      {!vagaId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Vaga não informada. Abra o matching a partir da tela de vagas.
        </div>
      )}

      {/* Pesos IA — barra horizontal compacta */}
      {vagaId && vagaDetail && (
        <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card px-4 py-2.5 shadow-sm">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest shrink-0">Pesos IA</span>
          <div className="flex-1 flex items-center gap-4">
            {([
              { label: "Competência", value: vagaDetail.weightsCompetencia ?? 40, color: "#2563eb" },
              { label: "Experiência", value: vagaDetail.weightsExperiencia ?? 30, color: "#7c3aed" },
              { label: "Formação", value: vagaDetail.weightsFormacao ?? 15, color: "#0891b2" },
              { label: "Localidade", value: vagaDetail.weightsLocalidade ?? 15, color: "#059669" },
            ] as const).map(w => (
              <div key={w.label} className="flex items-center gap-1.5 min-w-0">
                <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{w.label}</span>
                <span className="text-[11px] font-bold tabular-nums text-slate-700">{w.value}%</span>
              </div>
            ))}
          </div>
          {vagaDetail.requisitos.length > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">{vagaDetail.requisitos.length} requisito(s)</span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      {vagaId && kpiTotal > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total na aba</div>
            <div className="text-2xl font-bold mt-1.5 tabular-nums">{kpiTotal}</div>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50/50 shadow-sm p-4">
            <div className="text-[10px] font-semibold text-green-600/70 uppercase tracking-widest">Acima do corte</div>
            <div className="text-2xl font-bold mt-1.5 text-green-600 tabular-nums">{kpiAboveThreshold}</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 shadow-sm p-4">
            <div className="text-[10px] font-semibold text-amber-600/70 uppercase tracking-widest">Abaixo do corte</div>
            <div className="text-2xl font-bold mt-1.5 text-amber-600 tabular-nums">{kpiBelowThreshold}</div>
          </div>
          <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Score médio</div>
            <div className="text-2xl font-bold mt-1.5 tabular-nums">{kpiAvgScore}%</div>
          </div>
        </div>
      )}

      {/* Tabs as filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(t => {
          const count = tabCountMap[t.key];
          return (
            <button key={t.key} type="button"
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all border ${tab === t.key ? "bg-[rgb(var(--lt-primary))] text-white border-[rgb(var(--lt-primary))]" : "bg-card text-slate-700 border-border/60 hover:bg-slate-50"} ${dropTargetTab === t.key ? "ring-2 ring-emerald-400" : ""}`}
              onDragOver={(e) => {
                const hasPayload = e.dataTransfer.types.includes("text/plain");
                if (!hasPayload || t.key === tab) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTargetTab(t.key);
              }}
              onDragLeave={() => { if (dropTargetTab === t.key) setDropTargetTab(null); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                const droppedId = (e.dataTransfer.getData("text/plain") || "").trim();
                const droppedSource = (e.dataTransfer.getData("application/x-renderrh-source") || "").trim() || undefined;
                void handleDropToTab(t.key, droppedId, droppedSource);
              }}
              onClick={() => {
                if (draggingId) return;
                setTab(t.key); setSelectedIds(new Set()); setSearchQuery("");
                if (vagaId) void onSelectVaga(vagaId, t.key);
              }}>
              {t.label}
              {count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + batch actions */}
      {vagaId && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou e-mail…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-1.5">
              {tab === "suggestions" && (
                <button className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 font-semibold transition-colors" type="button" onClick={() => void batchAction("Aprovado")}>
                  <Check className="size-3" /> Aprovar {selectedIds.size}
                </button>
              )}
              {(tab === "suggestions" || tab === "approved") && (
                <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-semibold transition-colors" type="button" onClick={() => void batchAction("Reprovado")}>
                  <X className="size-3" /> Reprovar {selectedIds.size}
                </button>
              )}
              {(tab === "rejected" || tab === "approved") && (
                <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold transition-colors" type="button" onClick={() => void batchAction("Triagem")}>
                  <RotateCcw className="size-3" /> Triagem {selectedIds.size}
                </button>
              )}
              {tab === "approved" && (
                <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition-colors" type="button" onClick={() => { void loadProjetos(); setShowProjetoModal(true); }}>
                  <FolderOpen className="size-3" /> Enviar para Rodada ({selectedIds.size})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Processing banner — sempre visível quando processando */}
      {rankStatus === "processing" && (
        <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-blue-800">Processando matching com IA…</span>
                {processingComputed && (
                  <span className="text-xs font-medium text-blue-600 tabular-nums shrink-0">
                    {processingComputed.progressPct}% &middot; {formatDuration(processingComputed.elapsedMs)} decorridos
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-[2000ms] ease-out" style={{ width: `${processingComputed?.progressPct ?? 2}%` }} />
              </div>
              <p className="text-[11px] text-blue-500 mt-1.5">A IA está avaliando candidatos e talentos contra os critérios da vaga. Isso pode levar alguns minutos dependendo do volume.</p>
            </div>
          </div>
        </div>
      )}
      {rankStatus === "failed" && items.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">Falha ao atualizar. Exibindo último resultado disponível.</div>
      )}

      {/* Table */}
      {(rankStatus === "loading" || rankStatus === "processing") && items.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm py-20 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            {rankStatus === "loading" && <div className="size-8 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />}
            <p className="text-sm font-medium">
              {rankStatus === "processing" ? "Aguardando resultados da IA…" : "Carregando candidatos…"}
            </p>
            <p className="text-xs opacity-60 max-w-sm">
              {rankStatus === "processing" ? "Os candidatos aparecerão aqui assim que a avaliação for concluída." : "Buscando dados do ranking…"}
            </p>
          </div>
        </div>
      ) : items.length === 0 && vagaId && rankStatus !== "processing" ? (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm py-20 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ClipboardList className="size-10 opacity-15" />
            <p className="text-sm font-medium">
              {tab === "rejected" ? "Nenhum candidato reprovado ainda." : tab === "approved" ? "Nenhum candidato aprovado ainda." : "Nenhuma sugestão de matching encontrada."}
            </p>
            <p className="text-xs opacity-60 max-w-sm">
              {tab === "suggestions" ? "Verifique os filtros de IA ou aguarde o ranking ser processado." : "Os candidatos aparecerão aqui quando movidos para esta etapa."}
            </p>
          </div>
        </div>
      ) : filteredItems.length === 0 && searchQuery ? (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm py-10 text-center">
          <p className="text-muted-foreground text-sm">Nenhum resultado para &ldquo;{searchQuery}&rdquo;.</p>
          <button className="text-[rgb(var(--lt-primary))] underline text-sm mt-1" type="button" onClick={() => setSearchQuery("")}>Limpar busca</button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-slate-50/80">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="cursor-pointer" />
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-16">Score</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-16 hidden xl:table-cell">Filtros</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-16 hidden xl:table-cell">Requis.</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Observação</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24 hidden md:table-cell">Trab.?</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-28 hidden md:table-cell">Cidade/UF</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24">Contato</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-20">Status</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-36">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(r => {
                  const isPass = r.score >= thresholdForList;
                  const cidadeUf = [r.cidade, r.uf].filter(Boolean).join("/") || "—";
                  const isEditingObs = editingObsId === r.id;
                  return (
                    <tr key={r.id}
                      className={`border-b border-border/20 transition-colors hover:bg-slate-50/60 cursor-pointer ${highlightId === r.id ? "bg-emerald-50" : ""}`}
                      draggable
                      onDragStart={(e) => { setDraggingId(r.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.setData("application/x-renderrh-source", r.source ?? ""); }}
                      onDragEnd={() => { setDraggingId(null); setDropTargetTab(null); }}
                      onClick={() => void onSelectCandidate(r.id)}>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[rgb(var(--lt-primary))] text-white font-bold text-[0.6rem] shrink-0">{initials(r.nome)}</div>
                          <div className="min-w-0">
                            <span className="font-medium truncate block max-w-[180px]">{r.nome || "—"}</span>
                            <span className="text-[0.65rem] text-muted-foreground truncate block max-w-[180px]">{r.email || ""}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center" title={r.justificativa || undefined}><ScoreCircle score={r.score} size={32} /></td>
                      <td className="px-3 py-2 text-center text-xs font-mono text-muted-foreground hidden xl:table-cell">{r.scoreFiltros != null ? `${r.scoreFiltros}%` : "—"}</td>
                      <td className="px-3 py-2 text-center text-xs font-mono text-muted-foreground hidden xl:table-cell">{r.scoreRequisitos != null ? `${r.scoreRequisitos}%` : "—"}</td>
                      {/* Obs inline-edit */}
                      <td className="px-3 py-2 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                        {isEditingObs ? (
                          <input
                            className="flex h-7 w-full rounded border border-input bg-background px-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            autoFocus
                            value={editingObsText}
                            onChange={e => setEditingObsText(e.target.value)}
                            onBlur={() => { void saveObs(r.id, editingObsText); setEditingObsId(null); }}
                            onKeyDown={e => { if (e.key === "Enter") { void saveObs(r.id, editingObsText); setEditingObsId(null); } if (e.key === "Escape") setEditingObsId(null); }}
                          />
                        ) : (
                          <span
                            className="text-xs text-muted-foreground cursor-text hover:text-foreground truncate block max-w-[200px]"
                            title={r.obs || "Clique para adicionar obs"}
                            onClick={() => { setEditingObsId(r.id); setEditingObsText(r.obs || ""); }}
                          >
                            {r.obs || <span className="italic text-slate-300">+ obs</span>}
                          </span>
                        )}
                      </td>
                      {/* Trabalhando */}
                      <td className="px-3 py-2 text-center hidden md:table-cell">
                        {r.trabalhando === true ? <span className="inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-semibold bg-blue-100 text-blue-700">Sim</span>
                          : r.trabalhando === false ? <span className="inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-semibold bg-slate-100 text-slate-600">Não</span>
                            : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Cidade/UF */}
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[120px]">{cidadeUf}</td>
                      {/* Contato */}
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {r.email && <a href={`mailto:${r.email}`} title={`Email: ${r.email}`} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors" onClick={e => e.stopPropagation()}><Mail className="size-3.5" /></a>}
                          {r.fone && <a href={`https://wa.me/${r.fone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" title={`WhatsApp: ${r.fone}`} className="p-1 rounded text-muted-foreground hover:text-green-700 hover:bg-green-50 transition-colors" onClick={e => e.stopPropagation()}><MessageCircle className="size-3.5" /></a>}
                          {r.linkedinUrl && <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="p-1 rounded text-muted-foreground hover:text-blue-700 hover:bg-blue-50 transition-colors" onClick={e => e.stopPropagation()}><Linkedin className="size-3.5" /></a>}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${tab === "approved" ? "bg-green-100 text-green-700" :
                          tab === "rejected" ? "bg-red-100 text-red-700" :
                              isPass ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          }`}>
                          {tab === "approved" ? "Aprovado" : tab === "rejected" ? "Reprovado" : isPass ? "Dentro" : "Abaixo"}
                        </span>
                      </td>
                      {/* Ações */}
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {tab === "suggestions" && <>
                            <button className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors" type="button" onClick={() => void changeStatus(r.id, r.source, "Aprovado")} title="Aprovar → Avançar para processo seletivo"><Check className="size-3.5" /></button>
                            <button className="p-1 rounded hover:bg-red-100 text-red-700 transition-colors" type="button" onClick={() => void changeStatus(r.id, r.source, "Reprovado")} title="Reprovar candidato"><X className="size-3.5" /></button>
                          </>}
                          {tab === "approved" && <>
                            <button className="p-1 rounded hover:bg-amber-100 text-amber-700 transition-colors" type="button" onClick={() => void changeStatus(r.id, r.source, "Triagem")} title="Mover para Triagem"><RotateCcw className="size-3.5" /></button>
                            <button className="p-1 rounded hover:bg-red-100 text-red-700 transition-colors" type="button" onClick={() => void changeStatus(r.id, r.source, "Reprovado")} title="Reprovar"><X className="size-3.5" /></button>
                          </>}
                          {tab === "rejected" && <button className="p-1 rounded hover:bg-amber-100 text-amber-700 transition-colors" type="button" onClick={() => void changeStatus(r.id, r.source, "Triagem")} title="Mover para Triagem"><RotateCcw className="size-3.5" /></button>}
                          <button className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-colors" type="button" onClick={() => void onSelectCandidate(r.id)} title="Ver detalhes"><Eye className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer totals */}
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredItems.length} de {items.length} candidato(s){searchQuery ? " (filtrado)" : ""}</span>
            <span>Score médio: <strong className="text-foreground">{kpiAvgScore}%</strong> • Corte: <strong className="text-foreground">{thresholdForList}%</strong></span>
          </div>
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
          onPending={() => {}}
          onSaveCv={() => void saveCvText()}
          onUpdateObs={(obs) => void saveObs(selected.id, obs)}
        />
      )}

      {/* Filter Modal */}
      {showFilterModal && vagaDetail && <FilterModal vagaDetail={vagaDetail} onClose={() => setShowFilterModal(false)} onSave={raw => void saveFiltros(raw)} />}

      {/* Projeto Modal */}
      {showProjetoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowProjetoModal(false)}>
          <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Enviar para Rodada</h3>
            <p className="text-sm text-muted-foreground">{selectedIds.size} candidato(s) selecionado(s)</p>

            {projetos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Rodadas abertas</div>
                {projetos.filter(p => p.status === 0).map(p => (
                  <button key={p.id} type="button" className="w-full text-left rounded-lg border border-border/60 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors" onClick={() => void sendToProjeto(p.id)}>
                    <span className="font-medium">Rodada {p.numero}</span>
                    {p.descricao && <span className="text-muted-foreground ml-1">— {p.descricao}</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border/40 pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Criar nova rodada</div>
              <input className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Descrição (opcional)" value={newProjetoDesc} onChange={e => setNewProjetoDesc(e.target.value)} />
              <button className="w-full rounded-md bg-primary text-primary-foreground text-sm py-2 px-4 font-medium hover:bg-primary/90 transition-colors" type="button" onClick={() => void createAndSend()}>Criar rodada e enviar</button>
            </div>

            <button className="w-full rounded-md text-sm py-2 px-4 font-medium text-muted-foreground hover:bg-muted transition-colors" type="button" onClick={() => setShowProjetoModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
