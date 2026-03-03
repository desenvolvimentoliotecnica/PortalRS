"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import type { Candidato, CandidatosPaged, Documento } from "@/lib/schemas/recrutamento";
import PaginationBar from "@/components/pagination/PaginationBar";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

const BASE = "/app";

type EnumOption = { code: string; text: string };
type EnumsByKey = Record<string, EnumOption[]>;

type VagaOption = {
  id: string;
  label: string;
  code?: string | null;
  threshold?: number | null;
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

function arrayFromItemsPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const r = asRecord(payload);
  return Array.isArray(r?.items) ? (r!.items as unknown[]) : [];
}

function normalizeEnumCode(code: unknown) {
  return (code ?? "").toString().trim().toLowerCase();
}

function enumOptions(enums: EnumsByKey | null, key: string): EnumOption[] {
  if (!enums) return [];
  const list = enums[key];
  return Array.isArray(list) ? list : [];
}

function enumText(enums: EnumsByKey | null, key: string, code: unknown, fallback = "—") {
  const target = normalizeEnumCode(code);
  const opt = enumOptions(enums, key).find((o) => normalizeEnumCode(o.code) === target);
  return opt?.text ?? (code ? String(code) : fallback);
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

function mapCandidatosPayload(payload: unknown): { items: Candidato[]; total: number; page: number; pageSize: number } {
  if (Array.isArray(payload)) {
    return { items: payload as Candidato[], total: (payload as Candidato[]).length, page: 1, pageSize: 20 };
  }
  const r = asRecord(payload);
  const items = Array.isArray(r?.items) ? (r!.items as Candidato[]) : [];
  return {
    items,
    total: pickNumber(r?.totalCount, items.length),
    page: pickNumber(r?.page, 1),
    pageSize: pickNumber(r?.pageSize, 20),
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function statusTag(statusRaw: string | null | undefined) {
  const s = (statusRaw ?? "").trim().toLowerCase();
  if (s === "pendente") return { cls: "warn", label: "Pendente" };
  if (s === "triagem" || s === "em triagem") return { cls: "warn", label: "Em triagem" };
  if (s === "aprovado" || s === "aprovados") return { cls: "ok", label: "Aprovado" };
  if (s === "reprovado" || s === "reprovados") return { cls: "bad", label: "Reprovado" };
  if (!s) return { cls: "", label: "—" };
  return { cls: "", label: statusRaw ?? "—" };
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

function mapPesoToNumber(peso: unknown) {
  if (typeof peso === "number" && Number.isFinite(peso)) return peso;
  const m = (peso ?? "").toString().match(/\d+/);
  return m ? parseInt(m[0]!, 10) : 0;
}

function formatFileSize(bytes: unknown) {
  const value = typeof bytes === "number" ? bytes : Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

type MatchResult = {
  score: number;
  pass: boolean;
  threshold: number;
  hits: { termo: string }[];
  missMandatory: { termo: string }[];
};

function calcMatchForCv(args: { cvText: string; vaga: Record<string, unknown> | null }): MatchResult {
  const vaga = args.vaga;
  if (!vaga) return { score: 0, pass: false, threshold: 0, hits: [], missMandatory: [] };
  const thr = clamp(pickNumber(vaga.threshold ?? vaga.matchMinimoPercentual, 0), 0, 100);
  const text = normalizeText(args.cvText || "");
  const reqsRaw = Array.isArray(vaga.requisitos) ? (vaga.requisitos as unknown[]) : [];
  const reqs = reqsRaw.map((r) => asRecord(r) ?? {}).map((r) => ({
    termo: pickString(r.nome ?? r.termo, "").trim(),
    peso: clamp(mapPesoToNumber(r.peso), 0, 10),
    obrigatorio: !!r.obrigatorio,
    sinonimos: Array.isArray(r.sinonimos) ? (r.sinonimos as unknown[]) : [],
  }));
  if (!text || !reqs.length) return { score: 0, pass: 0 >= thr, threshold: thr, hits: [], missMandatory: [] };

  const totalPeso = reqs.reduce((acc, r) => acc + r.peso, 0) || 1;
  let hitPeso = 0;
  const hits: { termo: string }[] = [];
  const missMandatory: { termo: string }[] = [];

  for (const r of reqs) {
    const termo = normalizeText(r.termo);
    const syns = r.sinonimos.map((s) => normalizeText(pickString(s, ""))).filter(Boolean);
    const bag = [termo, ...syns].filter(Boolean);
    const found = bag.some((t) => t && text.includes(t));
    if (found) {
      hitPeso += r.peso;
      hits.push({ termo: r.termo });
    } else if (r.obrigatorio) {
      missMandatory.push({ termo: r.termo });
    }
  }

  let score = Math.round((hitPeso / totalPeso) * 100);
  if (missMandatory.length) {
    score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
  }
  return { score, pass: score >= thr, threshold: thr, hits, missMandatory };
}

export default function CandidatosScreen() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Candidato[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [enums, setEnums] = useState<EnumsByKey | null>(null);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [vagaId, setVagaId] = useState<string>("");

  const [vagas, setVagas] = useState<VagaOption[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Candidato | null>(null);
  const [detailTab, setDetailTab] = useState<"resumo" | "cv" | "docs" | "match">("resumo");
  const [detailVaga, setDetailVaga] = useState<Record<string, unknown> | null>(null);
  const [detailMatch, setDetailMatch] = useState<MatchResult | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Candidato>>({});
  const [pendingDocs, setPendingDocs] = useState<
    { tempId: string; tipo: string; descricao: string; file: File; nomeArquivo: string; tamanhoBytes: number; status: "pending" | "failed" }[]
  >([]);
  const [draftDocTipo, setDraftDocTipo] = useState<string>("curriculo");
  const [draftDocDescricao, setDraftDocDescricao] = useState<string>("");
  const [draftDocFile, setDraftDocFile] = useState<File | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggested, setSuggested] = useState<Record<string, unknown> | null>(null);
  const [suggestedCvText, setSuggestedCvText] = useState("");

  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const detailId = detail?.id ?? "";
  const detailVagaId = pickString(detail?.vagaId, "").trim();
  const detailCvText = pickString(detail?.cvText, "");

  async function loadEnums() {
    const payload = await fetchJson<unknown>(`${BASE}/api/lookup/enums`);
    const r = asRecord(payload) ?? {};
    setEnums(r as EnumsByKey);
  }

  async function loadVagas() {
    const payload = await fetchJson<unknown>(`${BASE}/api/vagas`);
    const list = arrayFromItemsPayload(payload);
    const mapped: VagaOption[] = list.map((v) => {
      const r = asRecord(v) ?? {};
      const id = pickString(r.id, "");
      const titulo = pickString(r.titulo, "");
      const codigo = pickString(r.codigo, "");
      const threshold = pickNumber(r.matchMinimoPercentual, 0);
      return {
        id,
        label: codigo ? `${titulo} (${codigo})` : titulo,
        code: codigo || null,
        threshold: Number.isFinite(threshold) ? threshold : null,
      };
    });
    setVagas(mapped.filter((v) => v.id && v.label).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
  }

  async function sync() {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(pageSize));
    const qq = q.trim();
    if (qq) qs.set("q", qq);
    for (const s of statuses) {
      const code = (s ?? "").toString().trim();
      if (code) qs.append("statuses", code);
    }
    if (vagaId) qs.append("vagaIds", vagaId);
    const payload = await fetchJson<CandidatosPaged | unknown>(`${BASE}/api/candidatos?${qs.toString()}`);
    const mapped = mapCandidatosPayload(payload);
    setItems(mapped.items);
    setTotal(mapped.total);
    setPage(mapped.page);
    setPageSize(mapped.pageSize);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadEnums(), loadVagas(), sync()])
      .catch(() => toast.error("Falha ao carregar candidatos."))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setReady(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQ(qInput);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (!statusOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const root = statusDropdownRef.current;
      if (!root) return;
      if (ev.target instanceof Node && root.contains(ev.target)) return;
      setStatusOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [statusOpen]);

  useEffect(() => {
    if (!detailId || !detailVagaId) {
      setDetailVaga(null);
      return;
    }
    fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(detailVagaId)}`, { headers: { "X-LT-Silent": "1" } })
      .then((raw) => setDetailVaga(asRecord(raw)))
      .catch(() => setDetailVaga(null));
  }, [detailId, detailVagaId]);

  useEffect(() => {
    if (!detailId || !detailVaga) {
      setDetailMatch(null);
      return;
    }
    setDetailMatch(calcMatchForCv({ cvText: detailCvText, vaga: detailVaga }));
  }, [detailId, detailCvText, detailVaga]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    sync()
      .catch(() => toast.error("Falha ao carregar candidatos."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, page, pageSize, q, vagaId, statuses.join("|")]);

  useEffect(() => {
    if (!ready || loading) return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      const openId = params.get("open");
      if (!openId) return;
      params.delete("open");
      const next = params.toString();
      const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, document.title, nextUrl);
      if (items.some((c) => c.id === openId)) {
        void openDetail(openId);
      }
    } catch {
      // ignore
    }
  }, [ready, loading, items]);

  const kpis = useMemo(() => {
    let pend = 0;
    let tri = 0;
    let ap = 0;
    let rep = 0;
    for (const c of items) {
      const s = (c.status ?? "").toLowerCase();
      if (s === "pendente") pend++;
      else if (s.includes("triagem")) tri++;
      else if (s.includes("aprov")) ap++;
      else if (s.includes("reprov")) rep++;
    }
    return { total, pend, tri, ap, rep };
  }, [items, total]);

  const statusOptionsEffective = useMemo(() => {
    const opts = enumOptions(enums, "candidatoStatus");
    if (opts.length) return opts;
    return [
      { code: "pendente", text: "Pendente" },
      { code: "triagem", text: "Triagem" },
      { code: "aprovado", text: "Aprovado" },
      { code: "reprovado", text: "Reprovado" },
    ] satisfies EnumOption[];
  }, [enums]);

  const statusLabel = useMemo(() => {
    if (!statuses.length) return "Todos";
    return statuses.map((s) => enumText(enums, "candidatoStatus", s, s)).join(", ");
  }, [enums, statuses]);

  useEffect(() => {
    if (draftDocTipo) return;
    const def = enumOptions(enums, "candidatoDocumentoTipo")[0]?.code ?? "curriculo";
    setDraftDocTipo(def);
  }, [enums, draftDocTipo]);

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailTab("resumo");
    setDetail(null);
    setDetailVaga(null);
    setDetailMatch(null);
    try {
      const d = await fetchJson<Candidato>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      setDetail(d);
    } catch {
      toast.error("Falha ao carregar detalhes do candidato.");
    }
  }

  function openNew() {
    const firstVagaId = vagas[0]?.id ?? "";
    setPendingDocs([]);
    setDraftDocDescricao("");
    setDraftDocFile(null);
    setDraftDocTipo(enumOptions(enums, "candidatoDocumentoTipo")[0]?.code ?? "curriculo");
    setDraft({
      nome: "",
      email: "",
      fone: "",
      cidade: "",
      uf: "SP",
      fonte: defaultEnumCode("candidatoFonte", "email"),
      status: defaultEnumCode("candidatoStatus", "novo"),
      vagaId: firstVagaId,
      obs: "",
    });
    setEditOpen(true);
  }

  async function openEdit(id: string) {
    try {
      setPendingDocs([]);
      setDraftDocDescricao("");
      setDraftDocFile(null);
      setDraftDocTipo(enumOptions(enums, "candidatoDocumentoTipo")[0]?.code ?? "curriculo");
      const d = await fetchJson<Candidato>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      setDraft(d);
      setEditOpen(true);
    } catch {
      toast.error("Falha ao abrir edição.");
    }
  }

  function exportJson() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), candidatos: items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidatos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportação iniciada.");
  }

  function createPendingId() {
    return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultEnumCode(key: string, fallback: string) {
    return enumOptions(enums, key)[0]?.code ?? fallback;
  }

  function toApiStatus(value: unknown) {
    const s = normalizeEnumCode(value);
    return s || normalizeEnumCode(defaultEnumCode("candidatoStatus", "novo"));
  }

  function toApiFonte(value: unknown) {
    const s = normalizeEnumCode(value);
    return s || normalizeEnumCode(defaultEnumCode("candidatoFonte", "email"));
  }

  function buildCandidatePayload(c: Partial<Candidato>) {
    const lm = asRecord(c.lastMatch);
    const atUtc = pickString(lm?.atUtc ?? lm?.at, "").trim() || null;
    const vagaId = pickString(c.vagaId, "").trim() || null;

    return {
      nome: pickString(c.nome, "").trim(),
      email: pickString(c.email, "").trim(),
      fone: pickString(c.fone, "").trim() || null,
      cidade: pickString(c.cidade, "").trim() || null,
      uf: pickString(c.uf, "").trim().toUpperCase().slice(0, 2) || null,
      fonte: toApiFonte(c.fonte),
      status: toApiStatus(c.status),
      vagaId,
      obs: pickString((c as Record<string, unknown>)?.obs, "").trim() || null,
      cvText: pickString(c.cvText, "").trim() || null,
      lastMatch: lm
        ? {
          score: typeof lm.score === "number" ? lm.score : pickNumber(lm.score, 0),
          pass: typeof lm.pass === "boolean" ? lm.pass : null,
          atUtc,
          vagaId: pickString(lm.vagaId, "") || vagaId,
        }
        : null,
      applicationRecruiterUserId: pickString((c as Record<string, unknown>)?.applicationRecruiterUserId, "").trim() || null,
      applicationRecruiterUserName: pickString((c as Record<string, unknown>)?.applicationRecruiterUserName, "").trim() || null,
      documentos: null,
    };
  }

  async function saveDraft() {
    const id = draft.id ?? "";
    const nome = pickString(draft.nome, "").trim();
    const email = pickString(draft.email, "").trim();
    const vaga = pickString(draft.vagaId, "").trim();
    if (!nome) return toast.error("Informe o nome do candidato.");
    if (!email) return toast.error("Informe o email do candidato.");
    if (vagas.length > 0 && !vaga) return toast.error("Selecione uma vaga.");
    const payload = buildCandidatePayload(draft);
    try {
      const url = id ? `${BASE}/api/candidatos/${encodeURIComponent(id)}` : `${BASE}/api/candidatos`;
      const method = id ? "PUT" : "POST";
      const saved = await fetchJson<Candidato>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const savedId = pickString(saved?.id, id).trim();
      if (!id && savedId) {
        setDraft(saved);
      }

      if (!id && savedId && pendingDocs.length) {
        let failed = 0;
        for (const doc of pendingDocs) {
          try {
            await uploadDocumento(savedId, doc.tipo, doc.descricao, doc.file);
            setPendingDocs((prev) => prev.filter((x) => x.tempId !== doc.tempId));
          } catch {
            failed += 1;
            setPendingDocs((prev) => prev.map((x) => (x.tempId === doc.tempId ? { ...x, status: "failed" } : x)));
          }
        }

        toast.success(failed ? `Candidato salvo, mas ${failed} documento(s) falharam.` : "Candidato criado.");
        if (failed) {
          return;
        }
      } else {
        toast.success(id ? "Candidato atualizado." : "Candidato criado.");
      }

      setEditOpen(false);
      setPage(1);
      await sync();
    } catch {
      toast.error("Falha ao salvar candidato.");
    }
  }

  async function sendToBloqueio(id: string) {
    const c = items.find((x) => x.id === id);
    if (!(await confirmDialog({
      title: "Enviar para Bloqueio de pessoa",
      description: `Enviar "${c?.nome ?? ""}" para Bloqueio de pessoa (blacklist)?`,
      confirmText: "Enviar",
      destructive: true,
    }))) return;
    try {
      await fetchJson(`${BASE}/api/bloqueio-pessoa/from-candidato/${encodeURIComponent(id)}`, { method: "POST" });
      toast.success("Pessoa enviada para Bloqueio de pessoa.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar para Bloqueio de pessoa.");
    }
  }

  async function recalcMatch(id: string) {
    try {
      const cand = await fetchJson<Candidato>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      const vid = pickString(cand.vagaId, "").trim();
      if (!vid) return toast.error("Vincule uma vaga ao candidato para calcular o match.");
      const vagaRaw = await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(vid)}`);
      const vaga = asRecord(vagaRaw);
      const m = calcMatchForCv({ cvText: pickString(cand.cvText, ""), vaga });
      const updated: Partial<Candidato> = {
        ...cand,
        lastMatch: { score: m.score, pass: m.pass, atUtc: new Date().toISOString(), vagaId: vid },
      };
      await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCandidatePayload(updated)),
      });
      toast.success("Match recalculado.");
      await sync();
      if (detail?.id === id) {
        setDetail({ ...(detail as Candidato), ...(updated as Candidato) });
      }
    } catch {
      toast.error("Falha ao recalcular match.");
    }
  }

  async function deleteCandidate(id: string) {
    const c = items.find((x) => x.id === id);
    if (!(await confirmDialog({
      title: "Excluir candidato",
      description: `Excluir o candidato "${c?.nome ?? ""}"?`,
      confirmText: "Excluir",
      destructive: true,
    }))) return;
    try {
      await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Candidato excluído.");
      await sync();
    } catch {
      toast.error("Falha ao excluir candidato.");
    }
  }

  async function saveMeta() {
    if (!detail) return;
    try {
      await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(detail.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCandidatePayload(detail)),
      });
      toast.success("Status/Vaga atualizados.");
      await sync();
    } catch {
      toast.error("Falha ao atualizar status/vaga.");
    }
  }

  async function uploadDocumento(candId: string, tipo: string, descricao: string, file: File) {
    const form = new FormData();
    form.append("arquivo", file);
    form.append("tipo", tipo);
    if (descricao.trim()) form.append("descricao", descricao.trim());
    const saved = await fetchJson<Documento>(`${BASE}/api/candidatos/${encodeURIComponent(candId)}/documentos`, {
      method: "POST",
      body: form,
    });
    return saved;
  }

  async function deleteDocumento(candId: string, docId: string) {
    await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(candId)}/documentos/${encodeURIComponent(docId)}`, {
      method: "DELETE",
    });
  }

  async function uploadCvExtrair(candId: string, file: File, enviarParaGpt: boolean) {
    const form = new FormData();
    form.append("arquivo", file);
    form.append("enviarParaGpt", enviarParaGpt ? "true" : "false");
    const resp = await fetchJson<unknown>(
      `${BASE}/api/candidatos/${encodeURIComponent(candId)}/documentos/curriculo-extrair`,
      { method: "POST", body: form },
    );
    return resp;
  }

  async function applySuggestedToCandidate(alsoTalento: boolean) {
    if (!detail || !suggested) return;
    const s = suggested;
    const nome = pickString(s.nome, pickString(detail.nome, "")).trim();
    const email = pickString(s.email, pickString(detail.email, "")).trim();
    if (!nome || !email) return toast.error("Preencha nome e email.");

    const candId = detail.id;
    const talentoId = pickString(detail.talentoId, "").trim();
    const payload = {
      nome,
      email,
      fone: pickString(s.fone, pickString(detail.fone, "")).trim() || null,
      cidade: pickString(s.cidade, pickString(detail.cidade, "")).trim() || null,
      uf: pickString(s.uf, pickString(detail.uf, "")).trim().toUpperCase().slice(0, 2) || null,
      fonte: toApiFonte((detail as Record<string, unknown>)?.fonte),
      status: toApiStatus(detail.status),
      vagaId: pickString(detail.vagaId, "").trim() || null,
      obs: pickString((detail as Record<string, unknown>)?.obs, "").trim() || null,
      cvText: (suggestedCvText || pickString(detail.cvText, "")).trim() || null,
      lastMatch: detail.lastMatch ?? null,
      documentos: null,
      applicationRecruiterUserId: pickString((detail as Record<string, unknown>)?.applicationRecruiterUserId, "").trim() || null,
      applicationRecruiterUserName: pickString((detail as Record<string, unknown>)?.applicationRecruiterUserName, "").trim() || null,
      talentoId: pickString(detail.talentoId, "").trim() || null,
    };

    try {
      await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(candId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (alsoTalento && talentoId) {
        const talentPayload = {
          nome,
          email,
          fone: pickString(s.fone, pickString(detail.fone, "")).trim() || null,
          cidade: pickString(s.cidade, pickString(detail.cidade, "")).trim() || null,
          uf: pickString(s.uf, pickString(detail.uf, "")).trim().toUpperCase().slice(0, 2) || null,
          linkedinUrl: pickString((s as Record<string, unknown>)?.linkedinUrl, "").trim() || null,
          resumoProfissional: pickString((s as Record<string, unknown>)?.resumoProfissional, "").trim() || null,
          obs: null,
          cpf: pickString((s as Record<string, unknown>)?.cpf, "").trim() || null,
          dataNascimento: pickString((s as Record<string, unknown>)?.dataNascimento, "").trim() || null,
          cep: pickString((s as Record<string, unknown>)?.cep, "").trim() || null,
          logradouro: pickString((s as Record<string, unknown>)?.logradouro, "").trim() || null,
          numero: pickString((s as Record<string, unknown>)?.numero, "").trim() || null,
          bairro: pickString((s as Record<string, unknown>)?.bairro, "").trim() || null,
          origem: "Manual",
          competencias: Array.isArray((s as Record<string, unknown>)?.competencias) ? (s as Record<string, unknown>)?.competencias : null,
          experiencias: Array.isArray((s as Record<string, unknown>)?.experiencias) ? (s as Record<string, unknown>)?.experiencias : null,
          treinamentos: Array.isArray((s as Record<string, unknown>)?.treinamentos) ? (s as Record<string, unknown>)?.treinamentos : null,
          formacao: Array.isArray((s as Record<string, unknown>)?.formacao) ? (s as Record<string, unknown>)?.formacao : null,
        };
        await fetchJson(`/api/talentos/${encodeURIComponent(talentoId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(talentPayload),
        });
      }

      toast.success(alsoTalento && talentoId ? "Dados aplicados no candidato e no talento." : "Dados aplicados no candidato.");
      setSuggestOpen(false);
      setSuggested(null);
      await openDetail(candId);
      await sync();
    } catch {
      toast.error("Falha ao aplicar dados.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Candidatos</h4>
          <div className="text-muted-foreground text-sm">Candidatos • CV • Match</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Exportar
          </button>
          <button className="btn-brand" type="button" onClick={openNew}>
            Novo candidato
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Total</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.total}</div>
          <div className="text-muted-foreground text-sm">candidatos (página)</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Pendente</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.pend}</div>
          <div className="text-muted-foreground text-sm">aguardando</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Em triagem</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.tri}</div>
          <div className="text-muted-foreground text-sm">aguardando análise</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Aprovados</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.ap}</div>
          <div className="text-muted-foreground text-sm">em avanço</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Reprovados</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.rep}</div>
          <div className="text-muted-foreground text-sm">fora do perfil</div>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div>
            <div className="small text-muted mb-1">Busca</div>
            <input
              className="form-control w-[260px]"
              placeholder="Nome, email, vaga..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <div>
            <div className="small text-muted mb-1">Status</div>
            <div ref={statusDropdownRef} className="position-relative" style={{ minWidth: 200 }}>
              <button
                type="button"
                className="form-select form-select-sm text-start d-flex align-items-center justify-content-between gap-2 w-100"
                style={{ borderColor: "var(--lt-border)", background: "#fff" }}
                onClick={() => setStatusOpen((v) => !v)}
              >
                <span className="text-truncate">{statusLabel}</span>
                <span className="text-muted small">▾</span>
              </button>
              {statusOpen ? (
                <div className="dropdown-menu shadow-sm p-2 show" style={{ display: "block", minWidth: 200, zIndex: 50 }}>
                  {statusOptionsEffective.map((opt) => {
                    const checked = statuses.includes(opt.code);
                    return (
                      <label
                        key={opt.code}
                        className="dropdown-item d-flex align-items-center gap-2 py-2 mb-0 cursor-pointer"
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input flex-shrink-0"
                          checked={checked}
                          onChange={() => {
                            setPage(1);
                            setStatuses((prev) => (prev.includes(opt.code) ? prev.filter((x) => x !== opt.code) : [...prev, opt.code]));
                          }}
                        />
                        <span>{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="small text-muted mb-1">Vaga</div>
            <select className="form-select w-[320px]" value={vagaId} onChange={(e) => setVagaId(e.target.value)}>
              <option value="">Todas</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setPage(1);
                setLoading(true);
                sync()
                  .catch(() => toast.error("Falha ao aplicar filtros."))
                  .finally(() => setLoading(false));
              }}
            >
              Aplicar
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setQInput("");
                setQ("");
                setStatuses([]);
                setVagaId("");
                setPage(1);
                setLoading(true);
                sync().finally(() => setLoading(false));
              }}
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="table-responsive mt-2">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Candidato</th>
                <th style={{ minWidth: 220 }}>Vaga</th>
                <th style={{ minWidth: 150 }}>Status</th>
                <th style={{ minWidth: 170 }}>Match</th>
                <th className="text-end" style={{ minWidth: 230 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Carregando…
                  </td>
                </tr>
              ) : items.length ? (
                items.map((c) => {
                  const v = vagas.find((x) => x.id === (c.vagaId ?? "")) ?? null;
                  const tag = statusTag(c.status);
                  const statusLabelText = enumText(enums, "candidatoStatus", c.status, tag.label);
                  const score = clamp(pickNumber(c.lastMatch?.score, 0), 0, 100);
                  const thr = clamp(pickNumber(v?.threshold, 0), 0, 100);
                  const pass = c.lastMatch?.pass ?? (thr ? score >= thr : false);
                  const matchText = thr ? `${score}% • ${pass ? "Dentro" : "Abaixo"}` : `${score}%`;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar">{initials(pickString(c.nome, ""))}</div>
                          <div>
                            <div className="fw-bold">{c.nome ?? "—"}</div>
                            <div className="text-muted small">
                              <span>{c.email ?? ""}</span>
                              {c.fone ? (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>{c.fone}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="nowrap">
                        <div className="fw-semibold">{v?.label ? v.label.replace(/\s*\([^)]+\)\s*$/, "") : c.vagaTitle ?? "—"}</div>
                        <div className="text-muted small mono">{v?.code ?? c.vagaCode ?? ""}</div>
                      </td>
                      <td className="nowrap">
                        <span className={`status-tag ${tag.cls}`}>{statusLabelText}</span>
                      </td>
                      <td className="nowrap">
                        <span className={`status-tag ${pass ? "ok" : thr ? "bad" : ""}`}>
                          <span className="mono">{matchText}</span>
                        </span>
                      </td>
                      <td className="text-end nowrap">
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openDetail(c.id)}>
                          Detalhes
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openEdit(c.id)}>
                          Editar
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void sendToBloqueio(c.id)}>
                          Bloqueio de pessoa
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" title="Recalcular match" onClick={() => void recalcMatch(c.id)}>
                          ↻
                        </button>
                        <button className="btn-ghost px-3 py-2 text-red-600" type="button" onClick={() => void deleteCandidate(c.id)}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Nenhum candidato encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPage(1);
            setPageSize(s || 20);
          }}
        />
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-5xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="avatar" style={{ width: 52, height: 52 }}>
                  {initials(pickString(detail?.nome, ""))}
                </div>
                <div>
                  <div className="text-lg font-extrabold">{detail?.nome ?? "—"}</div>
                  <div className="text-muted-foreground text-sm">
                    <span>{detail?.email ?? ""}</span>
                    {detail?.fone ? (
                      <>
                        <span className="mx-2">•</span>
                        <span>{detail.fone}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    <span>
                      {[detail?.cidade, detail?.uf].filter(Boolean).join(" - ") || ""}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    <span>
                      Fonte: {enumText(enums, "candidatoFonte", (detail as Record<string, unknown>)?.fonte, "—")}
                    </span>
                    {(detail as Record<string, unknown>)?.applicationRecruiterUserName ? (
                      <>
                        <span className="mx-2">•</span>
                        <span>Recrutador: {pickString((detail as Record<string, unknown>)?.applicationRecruiterUserName, "—")}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {detail?.id ? (
                  <Link href={`/candidatos/detalhes?id=${encodeURIComponent(detail.id)}`} className="btn-ghost px-3 py-2" onClick={() => setDetailOpen(false)}>
                    Abrir em página
                  </Link>
                ) : null}
                <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>

            {!detail ? (
              <div className="text-muted-foreground py-10 text-center">Carregando…</div>
            ) : (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "resumo", label: "Resumo" },
                        { key: "cv", label: "Texto do CV" },
                        { key: "docs", label: "Documentos" },
                        { key: "match", label: "Match" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={detailTab === t.key ? "btn-brand px-3 py-2" : "btn-ghost px-3 py-2"}
                        onClick={() => setDetailTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-end">
                    {(() => {
                      const st = statusTag(detail.status);
                      const label = enumText(enums, "candidatoStatus", detail.status, st.label);
                      const updatedIso = pickString((detail as Record<string, unknown>)?.updatedAtUtc ?? (detail as Record<string, unknown>)?.updatedAt, "");
                      const updatedTxt = updatedIso ? new Date(updatedIso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                      return (
                        <>
                          <div className="mb-1">
                            <span className={`status-tag ${st.cls}`}>{label}</span>
                          </div>
                          <div className="text-muted-foreground text-sm">Atualizado: {updatedTxt}</div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {detailTab === "resumo" ? (
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="fw-semibold mb-1">Observações</div>
                    <div className="text-muted-foreground text-sm whitespace-pre-wrap">{pickString((detail as Record<string, unknown>)?.obs, "—") || "—"}</div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <div className="small text-muted mb-1">Status</div>
                        <select className="form-select" value={detail.status ?? ""} onChange={(e) => setDetail({ ...detail, status: e.target.value })}>
                          {statusOptionsEffective.map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.text}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="small text-muted mb-1">Vaga</div>
                        <select
                          className="form-select"
                          value={detail.vagaId ?? ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            const v = vagas.find((x) => x.id === id);
                            setDetail({
                              ...detail,
                              vagaId: id || null,
                              vagaTitle: v?.label ? v.label.replace(/\s*\([^)]+\)\s*$/, "") : null,
                              vagaCode: v?.code ?? null,
                            });
                          }}
                        >
                          <option value="">Sem vaga</option>
                          {vagas.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-ghost px-3 py-2" type="button" onClick={() => void openEdit(detail.id)}>
                        Editar
                      </button>
                      <button className="btn-ghost px-3 py-2" type="button" onClick={() => void saveMeta()}>
                        Salvar status/vaga
                      </button>
                      <button className="btn-ghost px-3 py-2 text-red-600" type="button" onClick={() => void deleteCandidate(detail.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ) : null}

                {detailTab === "cv" ? (
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="fw-semibold">Texto do CV</div>
                      <div className="flex gap-2">
                        <button
                          className="btn-ghost px-3 py-2"
                          type="button"
                          onClick={() => {
                            fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(detail.id)}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(buildCandidatePayload(detail)),
                            })
                              .then(() => toast.success("Texto do CV salvo."))
                              .catch(() => toast.error("Falha ao salvar texto do CV."));
                          }}
                        >
                          Salvar texto
                        </button>
                        <button className="btn-ghost px-3 py-2" type="button" onClick={() => void recalcMatch(detail.id)}>
                          Recalcular match
                        </button>
                      </div>
                    </div>
                    <textarea className="form-control" rows={10} value={detail.cvText ?? ""} onChange={(e) => setDetail({ ...detail, cvText: e.target.value })} />
                  </div>
                ) : null}

                {detailTab === "docs" ? (
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="fw-semibold mb-2">Documentos</div>
                    <DocumentosBox
                      candidato={detail}
                      docTipoOptions={enumOptions(enums, "candidatoDocumentoTipo")}
                      onUploaded={(doc) => {
                        const docs = Array.isArray(detail.documentos) ? detail.documentos.slice() : [];
                        docs.unshift(doc);
                        setDetail({ ...detail, documentos: docs });
                      }}
                      onDeleted={(docId) => {
                        const docs = Array.isArray(detail.documentos) ? detail.documentos.filter((d) => d.id !== docId) : [];
                        setDetail({ ...detail, documentos: docs });
                      }}
                      uploadDocumento={uploadDocumento}
                      deleteDocumento={deleteDocumento}
                      uploadCvExtrair={uploadCvExtrair}
                      onSuggested={(payload, cvText) => {
                        setSuggested(payload);
                        setSuggestedCvText(cvText);
                        setSuggestOpen(true);
                      }}
                    />
                  </div>
                ) : null}

                {detailTab === "match" ? (
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    {!pickString(detail.vagaId, "").trim() ? (
                      <div className="alert alert-warning mb-0" style={{ borderRadius: 14 }}>
                        Vincule uma vaga ao candidato para calcular o match.
                      </div>
                    ) : !detailMatch ? (
                      <div className="text-muted-foreground text-sm">Carregando match…</div>
                    ) : (
                      <>
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <div className="fw-bold">Resultado atual</div>
                            <div className="text-muted small">Score por palavras-chave</div>
                          </div>
                          <span className={`status-tag ${detailMatch.pass ? "ok" : "bad"}`}>
                            {detailMatch.pass ? "Dentro do mínimo" : "Abaixo do mínimo"}
                          </span>
                        </div>

                        <div className="mt-2">
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1">
                              <div className="progress-bar" style={{ width: `${clamp(detailMatch.score, 0, 100)}%` }} />
                            </div>
                            <div className="fw-bold" style={{ minWidth: 54, textAlign: "right" }}>
                              {clamp(detailMatch.score, 0, 100)}%
                            </div>
                          </div>
                          <div className="text-muted small mt-1">
                            Match mínimo da vaga: <strong>{detailMatch.threshold}%</strong>
                            <span className="mx-1">•</span> Encontrados: <strong>{detailMatch.hits.length}</strong>
                            <span className="mx-1">•</span> Obrigatórios faltando: <strong>{detailMatch.missMandatory.length}</strong>
                          </div>
                        </div>

                        {detailMatch.missMandatory.length ? (
                          <div className="alert alert-danger mt-3 mb-0" style={{ borderRadius: 14 }}>
                            <div className="fw-semibold mb-1">Obrigatórios não encontrados</div>
                            <div className="small">{detailMatch.missMandatory.map((x) => x.termo).slice(0, 12).join(", ")}</div>
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <div className="fw-semibold mb-1">Encontrados</div>
                          <div className="small text-muted">{detailMatch.hits.map((x) => x.termo).slice(0, 12).join(", ") || "—"}</div>
                        </div>

                        <div className="d-flex flex-wrap gap-2 mt-3">
                          <button className="btn-ghost px-3 py-2" type="button" onClick={() => void recalcMatch(detail.id)}>
                            Recalcular
                          </button>
                          <button className="btn-ghost px-3 py-2" type="button" onClick={() => toast.info("Placeholder: aqui abriria a tela de Vagas filtrada na vaga.")}>
                            Abrir vaga (placeholder)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">{draft.id ? "Editar candidato" : "Novo candidato"}</p>
                <div className="text-lg font-extrabold">Cadastro</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setEditOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="mini-title mb-1 block">Nome</label>
                <input className="form-control" value={pickString(draft.nome, "")} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Status</label>
                <select className="form-select" value={pickString(draft.status, defaultEnumCode("candidatoStatus", "novo"))} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {statusOptionsEffective.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Email</label>
                <input className="form-control" value={pickString(draft.email, "")} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Fone</label>
                <input className="form-control" value={pickString(draft.fone, "")} onChange={(e) => setDraft({ ...draft, fone: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Cidade</label>
                <input className="form-control" value={pickString(draft.cidade, "")} onChange={(e) => setDraft({ ...draft, cidade: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">UF</label>
                <input className="form-control" value={pickString(draft.uf, "")} onChange={(e) => setDraft({ ...draft, uf: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Fonte</label>
                <select className="form-select" value={pickString((draft as Record<string, unknown>)?.fonte, defaultEnumCode("candidatoFonte", "email"))} onChange={(e) => setDraft({ ...draft, fonte: e.target.value })}>
                  {enumOptions(enums, "candidatoFonte").map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Vaga</label>
                <select className="form-select" value={pickString(draft.vagaId, "")} onChange={(e) => setDraft({ ...draft, vagaId: e.target.value })}>
                  <option value="">Sem vaga</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Resumo / Observações</label>
                <textarea className="form-control" rows={3} value={pickString((draft as Record<string, unknown>)?.obs, "")} onChange={(e) => setDraft({ ...draft, obs: e.target.value })} />
              </div>

              <div className="md:col-span-12">
                <div className="mt-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60 p-3">
                  <div className="fw-semibold mb-2">Documentos</div>
                  {!draft.id ? (
                    <div className="alert alert-warning mb-2" style={{ borderRadius: 14 }}>
                      Os documentos serão enviados ao salvar o candidato.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <label className="mini-title mb-1 block">Tipo</label>
                      <select className="form-select" value={draftDocTipo} onChange={(e) => setDraftDocTipo(e.target.value)}>
                        {(enumOptions(enums, "candidatoDocumentoTipo").length
                          ? enumOptions(enums, "candidatoDocumentoTipo")
                          : [
                            { code: "curriculo", text: "Currículo" },
                            { code: "documento", text: "Documento" },
                            { code: "outros", text: "Outros" },
                          ]
                        ).map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.text}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="mini-title mb-1 block">Descrição</label>
                      <input className="form-control" value={draftDocDescricao} onChange={(e) => setDraftDocDescricao(e.target.value)} placeholder="Ex.: CV atualizado, Certificação, Portfólio" />
                    </div>
                    <div className="md:col-span-4">
                      <label className="mini-title mb-1 block">Arquivo</label>
                      <input className="form-control" type="file" onChange={(e) => setDraftDocFile(e.currentTarget.files?.[0] ?? null)} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="btn-ghost px-3 py-2"
                      type="button"
                      onClick={() => {
                        if (!draftDocFile) return toast.error("Selecione um arquivo.");
                        const tipo = (draftDocTipo || "").trim();
                        if (!tipo) return toast.error("Selecione o tipo do documento.");
                        const descricao = (draftDocDescricao || "").trim();

                        const candId = pickString(draft.id, "").trim();
                        if (!candId) {
                          setPendingDocs((prev) => [
                            ...prev,
                            {
                              tempId: createPendingId(),
                              tipo,
                              descricao,
                              file: draftDocFile,
                              nomeArquivo: draftDocFile.name,
                              tamanhoBytes: draftDocFile.size,
                              status: "pending",
                            },
                          ]);
                          setDraftDocDescricao("");
                          setDraftDocFile(null);
                          toast.success("Documento adicionado. Ele será enviado ao salvar.");
                          return;
                        }

                        void uploadDocumento(candId, tipo, descricao, draftDocFile)
                          .then(() => {
                            toast.success("Documento enviado.");
                            setDraftDocDescricao("");
                            setDraftDocFile(null);
                          })
                          .catch(() => toast.error("Falha ao enviar documento."));
                      }}
                    >
                      Enviar documento
                    </button>
                  </div>

                  {pendingDocs.length ? (
                    <div className="mt-3">
                      <div className="fw-semibold small mb-2">Pendentes</div>
                      <div className="space-y-2">
                        {pendingDocs.map((d) => {
                          const tipoTxt = enumText(enums, "candidatoDocumentoTipo", d.tipo, d.tipo);
                          const candId = pickString(draft.id, "").trim();
                          return (
                            <div key={d.tempId} className="flex items-start justify-between gap-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-2">
                              <div className="min-w-0">
                                <div className="fw-semibold truncate">{d.nomeArquivo}</div>
                                <div className="text-muted-foreground text-xs">
                                  {tipoTxt} • {d.descricao || "Sem descrição"} • {formatFileSize(d.tamanhoBytes)} •{" "}
                                  <span className={d.status === "failed" ? "text-red-600" : "text-amber-600"}>
                                    {d.status === "failed" ? "Falhou" : "Pendente"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  className="btn-ghost px-3 py-2"
                                  type="button"
                                  disabled={!candId}
                                  title={!candId ? "Salve o candidato para reenviar" : "Reenviar"}
                                  onClick={() => {
                                    if (!candId) return;
                                    void uploadDocumento(candId, d.tipo, d.descricao, d.file)
                                      .then(() => {
                                        toast.success("Documento enviado.");
                                        setPendingDocs((prev) => prev.filter((x) => x.tempId !== d.tempId));
                                      })
                                      .catch(() => {
                                        toast.error("Falha ao enviar documento.");
                                        setPendingDocs((prev) => prev.map((x) => (x.tempId === d.tempId ? { ...x, status: "failed" } : x)));
                                      });
                                  }}
                                >
                                  Reenviar
                                </button>
                                <button className="btn-ghost px-3 py-2 text-red-600" type="button" onClick={() => setPendingDocs((prev) => prev.filter((x) => x.tempId !== d.tempId))}>
                                  Remover
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

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button className="btn-brand" type="button" onClick={() => void saveDraft()}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {suggestOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Sugestões da IA</p>
                <div className="text-lg font-extrabold">Aplicar dados extraídos</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setSuggestOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mini-title mb-1 block">CV (texto)</label>
                <textarea className="form-control" rows={8} value={suggestedCvText} onChange={(e) => setSuggestedCvText(e.target.value)} />
              </div>
              <div className="space-y-2">
                {(["nome", "email", "fone", "cidade", "uf"] as const).map((k) => (
                  <div key={k}>
                    <label className="mini-title mb-1 block">{k.toUpperCase()}</label>
                    <input
                      className="form-control"
                      value={pickString(suggested?.[k], "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSuggested((prev) => ({ ...(prev ?? {}), [k]: v }));
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label className="mini-title mb-1 block">Resumo</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={pickString(suggested?.resumoProfissional, "")}
                    onChange={(e) => setSuggested((prev) => ({ ...(prev ?? {}), resumoProfissional: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setSuggestOpen(false)}>
                Cancelar
              </button>
              {detail?.talentoId ? (
                <button className="btn-ghost" type="button" onClick={() => void applySuggestedToCandidate(true)}>
                  Aplicar no candidato e no talento
                </button>
              ) : null}
              <button className="btn-brand" type="button" onClick={() => void applySuggestedToCandidate(false)}>
                Aplicar no candidato
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DocumentosBox({
  candidato,
  docTipoOptions,
  onUploaded,
  onDeleted,
  uploadDocumento,
  deleteDocumento,
  uploadCvExtrair,
  onSuggested,
}: {
  candidato: Candidato;
  docTipoOptions: EnumOption[];
  onUploaded: (doc: Documento) => void;
  onDeleted: (docId: string) => void;
  uploadDocumento: (candId: string, tipo: string, descricao: string, file: File) => Promise<Documento>;
  deleteDocumento: (candId: string, docId: string) => Promise<void>;
  uploadCvExtrair: (candId: string, file: File, enviarParaGpt: boolean) => Promise<unknown>;
  onSuggested: (payload: Record<string, unknown>, cvText: string) => void;
}) {
  const defaultTipo = docTipoOptions[0]?.code ?? "curriculo";
  const [tipo, setTipo] = useState(defaultTipo);
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [enviarParaGpt, setEnviarParaGpt] = useState(true);

  const docs = Array.isArray(candidato.documentos) ? candidato.documentos : [];
  const tipoText = (code: string | null | undefined) => {
    const k = (code ?? "").toString().trim().toLowerCase();
    const opt = docTipoOptions.find((o) => o.code.toLowerCase() === k);
    return opt?.text ?? (code ?? "—");
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {(docTipoOptions.length
            ? docTipoOptions
            : [
              { code: "curriculo", text: "Currículo" },
              { code: "documento", text: "Documento" },
              { code: "outros", text: "Outros" },
            ]
          ).map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.text}
            </option>
          ))}
        </select>
        <input className="form-control" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input
          className="form-control"
          type="file"
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            if (!file) return toast.error("Selecione um arquivo.");
            void uploadDocumento(candidato.id, tipo, descricao, file)
              .then((d) => {
                onUploaded(d);
                setDescricao("");
                setFile(null);
                toast.success("Documento enviado.");
              })
              .catch(() => toast.error("Falha ao enviar documento."));
          }}
        >
          Enviar documento
        </button>
      </div>

      <div className="mt-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60 p-2">
        <div className="fw-semibold mb-2">CV PDF + Extrair</div>
        <input className="form-control" type="file" accept="application/pdf" onChange={(e) => setCvFile(e.currentTarget.files?.[0] ?? null)} />
        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enviarParaGpt} onChange={(e) => setEnviarParaGpt(e.target.checked)} />
          Enviar para IA (GPT)
        </label>
        <button
          className="btn-ghost mt-2"
          type="button"
          onClick={() => {
            if (!cvFile) return toast.error("Selecione um PDF.");
            const ext = (cvFile.name || "").toLowerCase().slice(-4);
            if (ext !== ".pdf") return toast.error("Apenas PDF.");
            void uploadCvExtrair(candidato.id, cvFile, enviarParaGpt)
              .then((resp) => {
                const r = asRecord(resp);
                const doc = asRecord(r?.documento);
                if (doc && pickString(doc.id, "")) {
                  onUploaded(doc as unknown as Documento);
                }
                const suggestedData = r?.suggestedData;
                const cvText = pickString(r?.cvText, "");
                if (suggestedData && asRecord(suggestedData)) {
                  onSuggested(suggestedData as Record<string, unknown>, cvText);
                } else {
                  toast.success("Currículo enviado.");
                }
                setCvFile(null);
              })
              .catch(() => toast.error("Falha ao enviar currículo."));
          }}
        >
          Enviar e extrair
        </button>
      </div>

      <div className="mt-2">
        {docs.length ? (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-2">
                <div className="min-w-0">
                  <div className="fw-semibold truncate">{d.nomeArquivo ?? "—"}</div>
                  <div className="text-muted-foreground text-xs">
                    {tipoText(d.tipo)} • {d.descricao ?? "Sem descrição"}{" "}
                    {d.tamanhoBytes ? <>• {formatFileSize(d.tamanhoBytes)}</> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <a className="btn-ghost px-3 py-2" href={d.url ?? "#"} target="_blank" rel="noreferrer" aria-disabled={!d.url}>
                    Download
                  </a>
                  <button
                    className="btn-ghost px-3 py-2 text-red-600"
                    type="button"
                    onClick={async () => {
                      if (!(await confirmDialog({ title: "Excluir documento", description: "Excluir documento?", confirmText: "Excluir", destructive: true }))) return;
                      void deleteDocumento(candidato.id, d.id)
                        .then(() => {
                          onDeleted(d.id);
                          toast.success("Documento excluído.");
                        })
                        .catch(() => toast.error("Falha ao excluir documento."));
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Sem documentos.</div>
        )}
      </div>
    </div>
  );
}

