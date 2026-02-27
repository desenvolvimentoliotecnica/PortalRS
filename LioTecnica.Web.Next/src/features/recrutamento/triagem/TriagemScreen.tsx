"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const BASE = "/app";

type Stage = "triagem" | "pendente" | "aprovado" | "reprovado";
type CandidateStatus = "novo" | Stage;

type TriagemCandidate = {
  id: string;
  nome: string;
  email: string;
  fone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  fonte?: string | null;
  status: CandidateStatus;
  vagaId: string | null;
  obs?: string | null;
  cvText?: string | null;
  applicationRecruiterUserId?: string | null;
  applicationRecruiterUserName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastMatch?: { score?: number | null; pass?: boolean | null; at?: string | null; vagaId?: string | null } | null;
};

type TriagemVagaRequisito = { id?: string; termo: string; peso: number; obrigatorio: boolean; sinonimos: string[] };
type TriagemVaga = { id: string; titulo: string; codigo: string; threshold: number; requisitos: TriagemVagaRequisito[] };

type StatusHistoryItem = {
  fromStatus?: string | null;
  toStatus?: string | null;
  atUtc?: string | null;
  reason?: string | null;
  note?: string | null;
  source?: string | null;
  userName?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeText(s: string) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function statusToStage(status: CandidateStatus): Stage {
  return status === "novo" ? "triagem" : status;
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
    requisitos: [],
  };
}

function mapPesoToNumber(peso: unknown) {
  // No legacy, "peso" pode vir numérico, enum/string ou texto como "Peso 5"
  if (typeof peso === "number") return peso;
  const raw = pickString(peso, "");
  const m = raw.match(/\d+/);
  return m ? Number(m[0]) : Number(raw) || 0;
}

function mapRequisitos(api: unknown): TriagemVagaRequisito[] {
  if (!Array.isArray(api)) return [];
  return api
    .map((x) => {
      const r = asRecord(x);
      if (!r) return null;
      const termo = pickString(r.nome ?? r.termo, "").trim();
      if (!termo) return null;
      return {
        id: pickString(r.id, "") || undefined,
        termo,
        peso: clamp(Math.trunc(mapPesoToNumber(r.peso)), 0, 10),
        obrigatorio: Boolean(r.obrigatorio),
        sinonimos: Array.isArray(r.sinonimos) ? (r.sinonimos as unknown[]).map((s) => pickString(s, "")).filter(Boolean) : [],
      } satisfies TriagemVagaRequisito;
    })
    .filter(Boolean) as TriagemVagaRequisito[];
}

function mapVagaDetail(api: unknown): TriagemVaga | null {
  const r = asRecord(api);
  if (!r) return null;
  const base = mapVaga(r);
  if (!base) return null;
  return { ...base, requisitos: mapRequisitos(r.requisitos) };
}

function mapCandidate(api: unknown): TriagemCandidate | null {
  const r = asRecord(api);
  if (!r) return null;
  const id = pickString(r.id, "");
  if (!id) return null;
  const statusRaw = pickString(r.status, "triagem").trim().toLowerCase();
  const status: CandidateStatus =
    statusRaw === "novo"
      ? "novo"
      : statusRaw === "pendente"
        ? "pendente"
        : statusRaw === "aprovado"
          ? "aprovado"
          : statusRaw === "reprovado"
            ? "reprovado"
            : "triagem";
  const lm = asRecord(r.lastMatch);
  return {
    id,
    nome: pickString(r.nome, ""),
    email: pickString(r.email, ""),
    status,
    vagaId: pickString(r.vagaId, "") || null,
    fonte: pickString(r.fonte, "") || null,
    fone: pickString(r.fone, "") || null,
    cidade: pickString(r.cidade, "") || null,
    uf: pickString(r.uf, "") ? pickString(r.uf, "").toUpperCase() : null,
    obs: pickString(r.obs, "") || null,
    cvText: pickString(r.cvText, "") || null,
    applicationRecruiterUserId: pickString(r.applicationRecruiterUserId, "") || null,
    updatedAt: pickString(r.updatedAtUtc ?? r.updatedAt, "") || null,
    createdAt: pickString(r.createdAtUtc ?? r.createdAt, "") || null,
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

function unpackListResponse(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const r = asRecord(payload);
  if (!r) return [];
  const items = r.items ?? r.Items;
  return Array.isArray(items) ? (items as unknown[]) : [];
}

function slaInfo(c: TriagemCandidate) {
  const now = Date.now();
  const updatedAt = c.updatedAt ? new Date(c.updatedAt).getTime() : now;
  let limitH: number | null = null;
  if (statusToStage(c.status) === "triagem") limitH = 48;
  if (statusToStage(c.status) === "pendente") limitH = 72;
  if (limitH == null) return { has: false, late: false, leftH: null as number | null, limitH: null as number | null };
  const ageH = (now - updatedAt) / (1000 * 60 * 60);
  const leftH = limitH - ageH;
  return { has: true, late: leftH < 0, leftH, limitH };
}

function calcMatchForCand(c: TriagemCandidate, v: TriagemVaga | null) {
  if (!v) return { score: 0, pass: false, hits: [] as TriagemVagaRequisito[], missMandatory: [] as TriagemVagaRequisito[], threshold: 0 };
  const text = normalizeText(c.cvText || "");
  const reqs = v.requisitos || [];
  const thr = clamp(Math.trunc(v.threshold || 0), 0, 100);
  if (!text || !reqs.length) {
    return { score: 0, pass: 0 >= thr, hits: [], missMandatory: [], threshold: thr };
  }
  const totalPeso = reqs.reduce((acc, r) => acc + clamp(Math.trunc(r.peso || 0), 0, 10), 0) || 1;
  let hitPeso = 0;
  const hits: TriagemVagaRequisito[] = [];
  const missMandatory: TriagemVagaRequisito[] = [];
  for (const r of reqs) {
    const termo = normalizeText(r.termo || "");
    const syns = (r.sinonimos || []).map(normalizeText).filter(Boolean);
    const bag = [termo, ...syns].filter(Boolean);
    const found = bag.some((t) => t && text.includes(t));
    const p = clamp(Math.trunc(r.peso || 0), 0, 10);
    if (found) {
      hitPeso += p;
      hits.push(r);
    } else if (r.obrigatorio) {
      missMandatory.push(r);
    }
  }
  let score = Math.round((hitPeso / totalPeso) * 100);
  if (missMandatory.length) score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
  const pass = score >= thr;
  return { score, pass, hits, missMandatory, threshold: thr };
}

function buildCandidatePayload(c: TriagemCandidate, patch?: Partial<TriagemCandidate> & { statusChange?: { reason?: string | null; note?: string | null; source?: string | null } }) {
  const next = { ...c, ...(patch || {}) };
  const fonte = (next.fonte || "email").toString().trim().toLowerCase() || "email";
  const status = (next.status || "novo").toString().trim().toLowerCase() || "novo";
  const vagaId = next.vagaId ? next.vagaId.toString() : "";
  return {
    nome: (next.nome || "").trim(),
    email: (next.email || "").trim(),
    fone: (next.fone || "").trim() || null,
    cidade: (next.cidade || "").trim() || null,
    uf: (next.uf || "").trim().toUpperCase().slice(0, 2) || null,
    fonte,
    status,
    vagaId: vagaId || null,
    obs: (next.obs || "").trim() || null,
    cvText: (next.cvText || "").trim() || null,
    lastMatch: next.lastMatch
      ? {
          score: next.lastMatch.score ?? null,
          pass: next.lastMatch.pass ?? null,
          atUtc: next.lastMatch.at ?? null,
          vagaId: next.lastMatch.vagaId ?? next.vagaId ?? null,
        }
      : null,
    documentos: null,
    statusChange: patch?.statusChange ?? null,
    applicationRecruiterUserId: (next.applicationRecruiterUserId || "").trim() || null,
    applicationRecruiterUserName: (next.applicationRecruiterUserName || "").trim() || null,
  };
}

export default function TriagemScreen({
  initialVagas,
  initialCands,
}: {
  initialVagas: unknown;
  initialCands: unknown;
}) {
  const initialVagaList = unpackListResponse(initialVagas);
  const initialCandList = unpackListResponse(initialCands);
  const initialMappedCands = initialCandList.map(mapCandidate).filter(Boolean) as TriagemCandidate[];
  const initialSelected =
    initialMappedCands.find((c) => statusToStage(c.status) === "triagem")?.id ?? initialMappedCands[0]?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [vagas, setVagas] = useState<TriagemVaga[]>(
    initialVagaList.map(mapVaga).filter(Boolean) as TriagemVaga[],
  );
  const [cands, setCands] = useState<TriagemCandidate[]>(initialMappedCands);
  const [history, setHistory] = useState<Record<string, StatusHistoryItem[]>>({});

  const [dragId, setDragId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionStage, setDecisionStage] = useState<Stage>("aprovado");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [recruiterDraft, setRecruiterDraft] = useState("");

  const [filters, setFilters] = useState<{ q: string; vagaId: string; sla: "all" | "late" | "ok" }>({
    q: "",
    vagaId: "all",
    sla: "all",
  });

  const [enums, setEnums] = useState<Record<string, { code: string; text: string }[]>>({});

  const getEnumOptions = (key: string) => (Array.isArray(enums[key]) ? enums[key]! : []);
  const getEnumText = (key: string, code: string, fallback = "") => {
    const list = getEnumOptions(key);
    const target = (code || "").toString().trim().toLowerCase();
    const opt = list.find((o) => (o.code || "").toString().trim().toLowerCase() === target);
    return opt ? opt.text : fallback || code || "";
  };

  useEffect(() => {
    let alive = true;
    void fetchJson<Record<string, { code: string; text: string }[]>>(`${BASE}/api/lookup/enums`)
      .then((data) => {
        if (!alive) return;
        setEnums(data || {});
      })
      .catch(() => {
        // sem enums: UI continua com fallbacks
      });
    return () => {
      alive = false;
    };
  }, []);

  async function syncVagaDetailsForCandidates(nextCands: TriagemCandidate[], currentVagas: TriagemVaga[]) {
    const have = new Set(currentVagas.filter((v) => (v.requisitos?.length ?? 0) > 0).map((v) => v.id));
    const ids = Array.from(new Set(nextCands.map((c) => c.vagaId).filter(Boolean) as string[])).filter((id) => !have.has(id));
    if (!ids.length) return currentVagas;
    const detailList = await Promise.all(
      ids.map(async (id) => {
        try {
          return await fetchJson<unknown>(`${BASE}/Triagem/_api/vagas/${encodeURIComponent(id)}`);
        } catch {
          return null;
        }
      }),
    );
    const details = detailList.map(mapVagaDetail).filter(Boolean) as TriagemVaga[];
    if (!details.length) return currentVagas;
    const merged = [...currentVagas];
    for (const d of details) {
      const idx = merged.findIndex((v) => v.id === d.id);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...d };
      else merged.push(d);
    }
    return merged;
  }

  async function refreshBoard() {
    setLoading(true);
    try {
      const [vRaw, cRaw] = await Promise.all([
        fetchJson<unknown>(`${BASE}/Triagem/_api/vagas`),
        fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos`),
      ]);
      const vList = unpackListResponse(vRaw).map(mapVaga).filter(Boolean) as TriagemVaga[];
      const cList = unpackListResponse(cRaw).map(mapCandidate).filter(Boolean) as TriagemCandidate[];
      const vMerged = await syncVagaDetailsForCandidates(cList, vList);
      setVagas(vMerged);
      setCands(cList);
      if (!selectedId) {
        setSelectedId(cList.find((x) => statusToStage(x.status) === "triagem")?.id ?? cList[0]?.id ?? null);
      }
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

  const filtered = useMemo(() => {
    const q = (filters.q || "").trim().toLowerCase();
    const vid = filters.vagaId;
    const sla = filters.sla;
    return cands.filter((c) => {
      if (!["novo", "triagem", "pendente", "aprovado", "reprovado"].includes(c.status)) return false;
      if (vid !== "all" && c.vagaId !== vid) return false;
      if (sla !== "all") {
        const si = slaInfo(c);
        if (!si.has) return false;
        if (sla === "late" && !si.late) return false;
        if (sla === "ok" && si.late) return false;
      }
      if (!q) return true;
      const v = c.vagaId ? vagaById[c.vagaId] : null;
      const blob = [c.nome, c.email, c.fone, v?.titulo, v?.codigo, c.cidade, c.uf, c.fonte].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [cands, filters, vagaById]);

  useEffect(() => {
    const visible = new Set(filtered.map((c) => c.id));
    if (selectedId && !visible.has(selectedId)) {
      setSelectedId(null);
      setDetailOpen(false);
      setDecisionOpen(false);
    }
  }, [filtered, selectedId]);

  const grouped = useMemo(() => {
    const g: Record<Stage, TriagemCandidate[]> = { triagem: [], pendente: [], aprovado: [], reprovado: [] };
    for (const c of filtered) {
      const stage = statusToStage(c.status);
      g[stage]?.push(c);
    }
    for (const k of Object.keys(g) as Stage[]) {
      g[k].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
    return g;
  }, [filtered]);

  const selected = useMemo(() => (selectedId ? cands.find((c) => c.id === selectedId) ?? null : null), [cands, selectedId]);
  const selectedVaga = selected?.vagaId ? vagaById[selected.vagaId] : null;
  const selectedMatch = useMemo(() => (selected ? calcMatchForCand(selected, selectedVaga ?? null) : null), [selected, selectedVaga]);

  useEffect(() => {
    setRecruiterDraft(selected?.applicationRecruiterUserName ?? "");
  }, [selected?.id, selected?.applicationRecruiterUserName]);

  async function loadHistory(candId: string) {
    try {
      const list = await fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos/${encodeURIComponent(candId)}/status-history`);
      const items = Array.isArray(list) ? (list as unknown[]) : [];
      setHistory((h) => ({
        ...h,
        [candId]: items.map((x) => {
          const r = asRecord(x) ?? {};
          return {
            fromStatus: pickString(r.fromStatus ?? r.FromStatus, "") || null,
            toStatus: pickString(r.toStatus ?? r.ToStatus, "") || null,
            atUtc: pickString(r.createdAtUtc ?? r.CreatedAtUtc ?? r.atUtc ?? r.AtUtc, "") || null,
            reason: pickString(r.reason ?? r.Reason, "") || null,
            note: pickString(r.note ?? r.Note, "") || null,
            source: pickString(r.source ?? r.Source, "") || null,
            userName: pickString(r.userName ?? r.UserName, "") || null,
          } satisfies StatusHistoryItem;
        }),
      }));
    } catch {
      setHistory((h) => ({ ...h, [candId]: [] }));
    }
  }

  async function saveCandToApi(candId: string, payload: unknown) {
    return await fetchJson<unknown>(`${BASE}/Triagem/_api/candidatos/${encodeURIComponent(candId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function moveStage(
    candId: string,
    newStage: Stage,
    meta: { reason: string; note: string; source: string },
    patch?: Partial<TriagemCandidate>,
  ) {
    const c = cands.find((x) => x.id === candId);
    if (!c) return;
    const prevStage = statusToStage(c.status);
    if (prevStage === newStage) return;
    if (!c.vagaId) {
      toast.error("Candidato sem vaga vinculada.");
      return;
    }
    const payload = buildCandidatePayload(c, {
      ...(patch || {}),
      status: newStage,
      statusChange: { reason: meta.reason || null, note: meta.note || null, source: meta.source || "triagem" },
    });
    try {
      const saved = await saveCandToApi(candId, payload);
      const mapped = mapCandidate(saved) ?? { ...c, ...(patch || {}), status: newStage };
      setCands((list) => list.map((x) => (x.id === mapped.id ? mapped : x)));
      await loadHistory(mapped.id);
      setSelectedId(mapped.id);
      toast.success(`Movido: ${stageLabel(prevStage)} → ${stageLabel(newStage)}`);
    } catch {
      toast.error("Falha ao salvar candidato.");
    }
  }

  function suggestDecision(c: TriagemCandidate, v: TriagemVaga | null) {
    const m = calcMatchForCand(c, v);
    const miss = m.missMandatory.length;
    if (miss) return { action: "reprovado" as Stage, reason: "missing_mandatory" };
    if (m.score < m.threshold) {
      const gap = m.threshold - m.score;
      if (gap >= 25) return { action: "reprovado" as Stage, reason: "below_threshold" };
      return { action: "pendente" as Stage, reason: "needs_validation" };
    }
    return { action: "aprovado" as Stage, reason: "profile_fit" };
  }

  async function autoTriage() {
    const tri = filtered.filter((c) => statusToStage(c.status) === "triagem" && c.status === "triagem");
    if (!tri.length) {
      toast.info("Nenhum candidato em triagem com os filtros atuais.");
      return;
    }
    let moved = 0;
    for (const c of tri) {
      const v = c.vagaId ? vagaById[c.vagaId] : null;
      const sug = suggestDecision(c, v);
      if (sug.action && sug.action !== "triagem") {
        await moveStage(c.id, sug.action, { reason: "Auto-triagem", note: getEnumText("triagemDecisionReason", sug.reason, sug.reason), source: "auto" });
        moved += 1;
      }
    }
    toast.success(`Auto-triagem aplicada em ${moved} candidato(s).`);
  }

  function openDetail(candId: string) {
    setSelectedId(candId);
    setDetailOpen(true);
    void loadHistory(candId);
  }

  function openDecision(candId: string) {
    const c = cands.find((x) => x.id === candId) ?? null;
    const v = c?.vagaId ? vagaById[c.vagaId] : null;
    const sug = c ? suggestDecision(c, v) : { action: "aprovado" as Stage, reason: "" };
    setSelectedId(candId);
    setDecisionStage(sug.action);
    setDecisionReason(sug.reason || "");
    setDecisionNote("");
    setDecisionOpen(true);
    void loadHistory(candId);
  }

  async function recalcMatch(candId: string) {
    const c = cands.find((x) => x.id === candId);
    if (!c) return;
    const v = c.vagaId ? vagaById[c.vagaId] : null;
    const m = calcMatchForCand(c, v ?? null);
    const patch: Partial<TriagemCandidate> = {
      lastMatch: { score: m.score, pass: m.pass, at: new Date().toISOString(), vagaId: c.vagaId ?? null },
    };
    const payload = buildCandidatePayload(c, patch);
    try {
      const saved = await saveCandToApi(candId, payload);
      const mapped = mapCandidate(saved) ?? { ...c, ...patch };
      setCands((list) => list.map((x) => (x.id === mapped.id ? mapped : x)));
      toast.success("Match recalculado.");
    } catch {
      toast.error("Falha ao recalcular match.");
    }
  }

  async function assignRecruiter(candId: string, name: string) {
    const c = cands.find((x) => x.id === candId);
    if (!c) return;
    const patch: Partial<TriagemCandidate> = { applicationRecruiterUserName: name.trim() || null };
    const payload = buildCandidatePayload(c, patch);
    try {
      const saved = await saveCandToApi(candId, payload);
      const mapped = mapCandidate(saved) ?? { ...c, ...patch };
      setCands((list) => list.map((x) => (x.id === mapped.id ? mapped : x)));
      toast.success(name.trim() ? "Recrutador atribuído." : "Recrutador removido.");
    } catch {
      toast.error("Falha ao salvar.");
    }
  }

  const vagaFilterOptions = useMemo(() => {
    const list = [...vagas]
      .map((v) => ({ id: v.id, label: `${v.titulo || "—"} (${v.codigo || "—"})` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return list;
  }, [vagas]);

  useEffect(() => {
    // completa detalhes das vagas (requisitos) para match/SLA/decisão
    let alive = true;
    void (async () => {
      try {
        const merged = await syncVagaDetailsForCandidates(cands, vagas);
        if (!alive) return;
        if (merged !== vagas) setVagas(merged);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              const triageLog = selectedId ? history[selectedId] ?? [] : [];
              const payload = { version: 1, exportedAt: new Date().toISOString(), triageLog };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "triagem_log_liotecnica.json";
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

      <div className="card-soft p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mini-title mb-1 block">Buscar</label>
            <input
              className="form-control"
              value={filters.q}
              placeholder="Nome, e-mail, vaga, cidade..."
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div>
            <label className="mini-title mb-1 block">Vaga</label>
            <select className="form-select" value={filters.vagaId} onChange={(e) => setFilters((f) => ({ ...f, vagaId: e.target.value }))}>
              <option value="all">Todas</option>
              {vagaFilterOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mini-title mb-1 block">SLA</label>
            <select className="form-select" value={filters.sla} onChange={(e) => setFilters((f) => ({ ...f, sla: e.target.value as "all" | "late" | "ok" }))}>
              <option value="all">Todos</option>
              <option value="late">Atrasados</option>
              <option value="ok">Dentro do prazo</option>
            </select>
          </div>
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
            <div className="text-muted-foreground text-xs mt-1">
              {stage === "triagem"
                ? "Solte aqui candidatos para revisar."
                : stage === "pendente"
                  ? "Ex.: aguardando retorno, teste, entrevista."
                  : stage === "aprovado"
                    ? "Dentro do perfil (match + análise)."
                    : "Sem aderência (obrigatório faltando / fora do mínimo)."}
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
                  const m = calcMatchForCand(c, v ?? null);
                  const thr = m.threshold ?? (v?.threshold ?? 0);
                  const score = clamp(pickNumber(m.score, 0), 0, 100);
                  const pass = m.pass;
                  const si = slaInfo(c);
                  const missCount = m.missMandatory.length;
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
                        {si.has ? (
                          si.late ? (
                            <span className="status-tag bad">SLA atrasado</span>
                          ) : (
                            <span className="status-tag warn">{Math.ceil(si.leftH ?? 0)}h</span>
                          )
                        ) : (
                          <span className="status-tag">Sem SLA</span>
                        )}
                        <span className={`status-tag ${missCount ? "bad" : "ok"}`}>{missCount ? `${missCount} obrig.` : "Obrig. OK"}</span>
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
              <span className={`status-tag ${statusToStage(selected.status) === "aprovado" ? "ok" : statusToStage(selected.status) === "reprovado" ? "bad" : "warn"}`}>
                {getEnumText("candidatoStatus", selected.status, stageLabel(statusToStage(selected.status)))}
              </span>
              <span className="pill">
                Vaga: <strong className="ms-1">{selectedVaga?.titulo || "—"}</strong>
              </span>
              <span className="pill mono">{selectedVaga?.codigo || "—"}</span>
              <span className="pill">
                Min.: <strong className="ms-1">{selectedVaga?.threshold ?? 0}%</strong>
              </span>
              <span className="pill">
                SLA:{" "}
                <strong className="ms-1">
                  {(() => {
                    const si = slaInfo(selected);
                    if (!si.has) return "Sem SLA";
                    if (si.late) return "Atrasado";
                    return `Faltam ~${Math.ceil(si.leftH ?? 0)}h`;
                  })()}
                </strong>
              </span>
            </div>

            <div className="mt-3 card-soft p-3">
              <div className="text-sm font-semibold">Recrutador responsável</div>
              <div className="text-muted-foreground text-xs mb-2">Atribuir / remover por nome (como no legado).</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="form-control"
                  style={{ maxWidth: 240 }}
                  value={recruiterDraft}
                  placeholder="Nome do recrutador"
                  onChange={(e) => setRecruiterDraft(e.target.value)}
                />
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => void assignRecruiter(selected.id, recruiterDraft)}
                >
                  Atribuir
                </button>
                <span className="text-muted-foreground text-sm">
                  {selected.applicationRecruiterUserName ? `Atual: ${selected.applicationRecruiterUserName}` : "—"}
                </span>
              </div>
            </div>

            <div className="mt-3 card-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Match atual</div>
                  <div className="text-muted-foreground text-xs">MVP por palavras-chave (requisitos + sinônimos)</div>
                </div>
                <span className={`status-tag ${selectedMatch?.pass ? "ok" : "bad"}`}>
                  {clamp(pickNumber(selectedMatch?.score, 0), 0, 100)}% • {selectedMatch?.pass ? "Dentro" : "Abaixo"}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-muted-foreground text-xs">
                  Encontrados: <strong>{selectedMatch?.hits.length ?? 0}</strong> • Obrigatórios faltando:{" "}
                  <strong>{selectedMatch?.missMandatory.length ?? 0}</strong>
                </div>
                {selectedMatch && selectedMatch.missMandatory.length ? (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                    <div className="font-semibold">Obrigatórios faltando</div>
                    <div className="text-muted-foreground">{selectedMatch.missMandatory.map((r) => r.termo).slice(0, 12).join(", ")}</div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <div className="font-semibold">Obrigatórios OK</div>
                    <div className="text-muted-foreground">
                      {(selectedMatch?.hits ?? []).map((r) => r.termo).slice(0, 12).join(", ") || "—"}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button className="btn-ghost" type="button" onClick={() => void recalcMatch(selected.id)}>
                  Recalcular match
                </button>
                <button className="btn-brand" type="button" onClick={() => openDecision(selected.id)}>
                  Decisão
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="fw-semibold mb-2">Histórico (últimos)</div>
              <div className="space-y-2">
                {(history[selected.id] ?? []).slice(0, 10).map((h, idx) => (
                  <div key={idx} className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3">
                    <div className="text-sm font-semibold">
                      {getEnumText("candidatoStatus", pickString(h.fromStatus, "—"), pickString(h.fromStatus, "—"))} →{" "}
                      {getEnumText("candidatoStatus", pickString(h.toStatus, "—"), pickString(h.toStatus, "—"))}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {h.atUtc ? new Date(h.atUtc).toLocaleString("pt-BR") : "—"} • {pickString(h.source, "")}
                    </div>
                    <div className="text-muted-foreground text-sm mt-1 whitespace-pre-wrap">
                      {(h.reason ? getEnumText("triagemDecisionReason", h.reason, h.reason) : "-") + (h.note ? ` • ${h.note}` : "")}
                    </div>
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
                  {(getEnumOptions("triagemDecisionAction").length
                    ? getEnumOptions("triagemDecisionAction").map((o) => ({ value: o.code, label: o.text }))
                    : [
                        { value: "triagem", label: "Em triagem" },
                        { value: "pendente", label: "Pendente" },
                        { value: "aprovado", label: "Aprovado" },
                        { value: "reprovado", label: "Reprovado" },
                      ]
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Motivo</label>
                {getEnumOptions("triagemDecisionReason").length ? (
                  <select className="form-select" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)}>
                    <option value="">—</option>
                    {getEnumOptions("triagemDecisionReason").map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="form-control" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Nota</label>
                <textarea className="form-control" rows={4} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[rgba(16,82,144,.18)] bg-[rgba(173,200,220,.22)] p-3 text-sm">
              <div className="font-semibold">Regra sugerida</div>
              <div className="text-muted-foreground">
                Se houver <strong>obrigatório faltando</strong> ou match bem abaixo do mínimo, sugerimos <strong>Reprovar</strong>. Você pode ajustar manualmente.
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
                  const reasonLabel = decisionReason ? getEnumText("triagemDecisionReason", decisionReason, decisionReason) : "";
                  const obs = (decisionNote || "").trim();
                  const lines: string[] = [];
                  if (decisionReason) lines.push(reasonLabel || decisionReason);
                  if (obs) lines.push(obs);
                  const mergedNote = lines.join(" • ");
                  const mergedObs = mergedNote ? ((selected.obs || "").trim() ? `${(selected.obs || "").trim()}\n${mergedNote}` : mergedNote) : selected.obs || null;

                  void moveStage(
                    selected.id,
                    decisionStage,
                    { reason: decisionReason || "Decisao", note: obs || "", source: "decision" },
                    { obs: mergedObs },
                  ).finally(() => setDecisionOpen(false));
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

