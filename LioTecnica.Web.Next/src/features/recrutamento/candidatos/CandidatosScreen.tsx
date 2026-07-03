"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Eye, Loader2, Lock, MoreHorizontal, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { VAGAS_FONT_135X_CLASS, VAGAS_FONT_135X_STYLE } from "@/styles/vagasFont135x";
import { VagaAutocomplete } from "@/components/autocomplete/VagaAutocomplete";

import type { Candidato, CandidatosPaged, Documento } from "@/lib/schemas/recrutamento";
import { CandidatoPortalPerfilReadonly, type CandidatoPortalPerfilCompleto } from "@/features/recrutamento/candidatos/CandidatoPortalPerfilReadonly";
import { fetchCandidatoPortalPerfil } from "@/features/recrutamento/candidatos/portalPerfilClient";
import {
  buildCandidatoDocumentoDownloadPath,
  downloadCandidatoDocumento,
  candidatoDocumentoTemArquivo,
} from "@/features/recrutamento/candidatos/candidatoDocumentoDownload";
import PaginationBar from "@/components/pagination/PaginationBar";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { getKanbanVagas } from "@/features/recrutamento/candidaturas/candidaturaApi";

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
  if (s === "pendente") return { colorCls: "bg-amber-500/15 text-amber-700", label: "Pendente" };
  if (s === "triagem" || s === "em triagem") return { colorCls: "bg-blue-500/15 text-blue-700", label: "Em triagem" };
  if (s === "aprovado" || s === "aprovados") return { colorCls: "bg-emerald-500/15 text-emerald-700", label: "Aprovado" };
  if (s === "reprovado" || s === "reprovados") return { colorCls: "bg-red-500/15 text-red-700", label: "Reprovado" };
  if (!s) return { colorCls: "bg-zinc-400/15 text-zinc-600", label: "—" };
  return { colorCls: "bg-zinc-400/15 text-zinc-600", label: statusRaw ?? "—" };
}

function isCandidatoAprovado(statusRaw: string | null | undefined) {
  const s = normalizeEnumCode(statusRaw);
  return s === "aprovado" || s === "aprovados" || s.includes("aprov");
}

function resolveStatusEnumCode(statusRaw: unknown, enums: EnumsByKey | null, fallback = "novo") {
  const target = normalizeEnumCode(statusRaw);
  const opts = enumOptions(enums, "candidatoStatus");
  if (!target) return opts[0]?.code ?? fallback;
  const byCode = opts.find((o) => normalizeEnumCode(o.code) === target);
  if (byCode) return byCode.code;
  const byText = opts.find((o) => normalizeEnumCode(o.text) === target);
  if (byText) return byText.code;
  return opts[0]?.code ?? fallback;
}

function vagaLabelForId(vagaId: string | null | undefined, vagas: VagaOption[], cand?: Partial<Candidato>) {
  const id = pickString(vagaId, "").trim();
  const fromList = vagas.find((v) => v.id === id);
  if (fromList) return fromList.label;
  const title = pickString(cand?.vagaTitle, "").trim();
  const code = pickString(cand?.vagaCode, "").trim();
  if (title || code) return [code, title].filter(Boolean).join(" - ");
  return id ? id.slice(0, 8) : "Sem vaga";
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

function isPdfDocument(nomeArquivo: string | null | undefined, contentType?: string | null) {
  return contentType?.toLowerCase().includes("pdf") === true || (nomeArquivo ?? "").toLowerCase().endsWith(".pdf");
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return normalizeText(error.message);
  return normalizeText(String(error ?? ""));
}

function isEmptyCandidatesError(error: unknown) {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("http 404") ||
    message.includes("not found") ||
    message.includes("nao encontrado") ||
    message.includes("nenhum candidato")
  );
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
  const searchParams = useSearchParams();
  const paramVagaId = searchParams.get("vagaId") ?? "";
  const paramNew = searchParams.get("new") === "1";
  const autoOpenDone = useRef(false);

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
  const [vagaId, setVagaId] = useState<string>(paramVagaId);

  const [vagas, setVagas] = useState<VagaOption[]>([]);

  const [viewMode, setViewModeRaw] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("renderrh.candidatos.viewMode") as "list" | "kanban") || "list";
  });
  const setViewMode = (m: "list" | "kanban") => { setViewModeRaw(m); localStorage.setItem("renderrh.candidatos.viewMode", m); };
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Candidato | null>(null);
  const [detailTab, setDetailTab] = useState<"resumo" | "cv" | "docs" | "match" | "perfilPortal">("resumo");
  const [detailVaga, setDetailVaga] = useState<Record<string, unknown> | null>(null);
  const [detailMatch, setDetailMatch] = useState<MatchResult | null>(null);
  const [portalPerfil, setPortalPerfil] = useState<CandidatoPortalPerfilCompleto | null>(null);
  const [portalPerfilLoading, setPortalPerfilLoading] = useState(false);
  const [portalPerfilError, setPortalPerfilError] = useState<string | null>(null);

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

  function applyEmptyCandidatesState() {
    setItems([]);
    setTotal(0);
    setPage(1);
  }

  async function loadEnums() {
    const payload = await fetchJson<unknown>(`${BASE}/api/lookup/enums`);
    const r = asRecord(payload) ?? {};
    setEnums(r as EnumsByKey);
  }

  async function loadVagas() {
    const list = await getKanbanVagas();
    const mapped: VagaOption[] = list.map((v) => ({
      id: v.id,
      label: [
        v.titulo || v.id.slice(0, 8),
        v.codigo ? `(${v.codigo})` : null,
        v.totalCandidaturas > 0 ? `- ${v.totalCandidaturas} candidatura(s)` : null,
      ].filter(Boolean).join(" "),
      code: v.codigo || null,
      threshold: null,
    }));
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
    try {
      const payload = await fetchJson<CandidatosPaged | unknown>(`${BASE}/api/candidatos?${qs.toString()}`);
      const mapped = mapCandidatosPayload(payload);
      setItems(mapped.items);
      setTotal(mapped.total);
      setPage(mapped.page);
      setPageSize(mapped.pageSize);
    } catch (error) {
      if (isEmptyCandidatesError(error)) {
        applyEmptyCandidatesState();
        return;
      }
      toast.error("Não foi possível carregar os candidatos.");
      applyEmptyCandidatesState();
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
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
    setPortalPerfil(null);
    setPortalPerfilError(null);
    setPortalPerfilLoading(true);
    try {
      const d = await fetchJson<Candidato>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      setDetail({ ...d, status: resolveStatusEnumCode(d.status, enums) });
    } catch {
      toast.error("Falha ao carregar detalhes do candidato.");
      setPortalPerfilLoading(false);
      return;
    }
    try {
      const { data, error } = await fetchCandidatoPortalPerfil(id, BASE);
      setPortalPerfil(data);
      setPortalPerfilError(error);
    } finally {
      setPortalPerfilLoading(false);
    }
  }

  // Auto-abrir modal se veio de VagaHub com ?new=1&vagaId=X
  useEffect(() => {
    if (!ready || autoOpenDone.current) return;
    if (paramNew && paramVagaId) {
      autoOpenDone.current = true;
      setVagaId(paramVagaId);
      openNew(paramVagaId);
    } else if (paramVagaId) {
      setVagaId(paramVagaId);
    }
  }, [ready, paramNew, paramVagaId]);

  function openNew(presetVagaId?: string) {
    const firstVagaId = presetVagaId || (vagas[0]?.id ?? "");
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
      setDraft({ ...d, status: resolveStatusEnumCode(d.status, enums) });
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

    const cr = c as Record<string, unknown>;

    return {
      nome: pickString(c.nome, "").trim(),
      email: pickString(c.email, "").trim(),
      fone: pickString(c.fone, "").trim() || null,
      celular: pickString((c as Record<string, unknown>)?.celular, "").trim(),
      cidade: pickString(c.cidade, "").trim() || null,
      uf: pickString(c.uf, "").trim().toUpperCase().slice(0, 2) || null,
      linkedinUrl: c.linkedinUrl?.trim() || null,
      fonte: toApiFonte(c.fonte),
      status: toApiStatus(c.status),
      trabalhandoAtualmente: c.trabalhandoAtualmente ?? null,
      pretensaoSalarial: c.pretensaoSalarial ?? null,
      vagaId,
      obs: pickString(cr?.obs, "").trim() || null,
      cvText: pickString(c.cvText, "").trim() || null,
      lastMatch: lm
        ? {
          score: typeof lm.score === "number" ? lm.score : pickNumber(lm.score, 0),
          pass: typeof lm.pass === "boolean" ? lm.pass : null,
          atUtc,
          vagaId: pickString(lm.vagaId, "") || vagaId,
        }
        : null,
      applicationRecruiterUserId: pickString(cr?.applicationRecruiterUserId, "").trim() || null,
      applicationRecruiterUserName: pickString(cr?.applicationRecruiterUserName, "").trim() || null,
      documentos: null,
    };
  }

  async function saveDraft() {
    const id = draft.id ?? "";
    const nome = pickString(draft.nome, "").trim();
    const email = pickString(draft.email, "").trim();
    const vaga = pickString(draft.vagaId, "").trim();
    const celular = pickString((draft as Record<string, unknown>)?.celular, "").trim();
    if (!nome) return toast.error("Informe o nome do candidato.");
    if (!email) return toast.error("Informe o email do candidato.");
    if (!celular) return toast.error("Informe o celular do candidato.");
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
        await fetchJson(`${BASE}/api/talentos/${encodeURIComponent(talentoId)}`, {
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
    <section className={`${VAGAS_FONT_135X_CLASS} space-y-4`}>
      <style>{VAGAS_FONT_135X_STYLE}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidatos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gestão de candidatos vinculados às vagas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportJson}>
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/app/talentos"}>
            Banco de Talentos
          </Button>
          <Button size="sm" onClick={() => openNew()}>
            Novo candidato
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total</div>
          <div className="text-2xl font-bold tabular-nums text-[rgb(var(--lt-primary))]">{kpis.total}</div>
          <div className="text-muted-foreground text-sm">candidatos (página)</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Pendente</div>
          <div className="text-2xl font-bold tabular-nums text-amber-600">{kpis.pend}</div>
          <div className="text-muted-foreground text-sm">aguardando</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Em triagem</div>
          <div className="text-2xl font-bold tabular-nums text-blue-600">{kpis.tri}</div>
          <div className="text-muted-foreground text-sm">aguardando análise</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Aprovados</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{kpis.ap}</div>
          <div className="text-muted-foreground text-sm">em avanço</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Reprovados</div>
          <div className="text-2xl font-bold tabular-nums text-red-600">{kpis.rep}</div>
          <div className="text-muted-foreground text-sm">fora do perfil</div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2.5">
          <div className="relative min-w-[180px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Nome, email, vaga..." value={qInput} onChange={(e) => setQInput(e.target.value)} />
          </div>
          <div ref={statusDropdownRef} className="relative">
            <button
              type="button"
              className="rounded-md border border-input bg-background px-3 text-sm inline-flex items-center justify-between gap-2 min-w-[180px]"
              onClick={() => setStatusOpen((v) => !v)}
            >
              <span className="truncate">{statusLabel}</span>
              <span className="text-muted-foreground text-xs">▾</span>
            </button>
            {statusOpen ? (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-md border border-border bg-popover p-1.5 shadow-md min-w-[200px]">
                {statusOptionsEffective.map((opt) => {
                  const checked = statuses.includes(opt.code);
                  return (
                    <label key={opt.code} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-border"
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
          <VagaAutocomplete
            value={vagaId}
            onChange={(id) => { setVagaId(id); setPage(1); }}
            items={vagas}
            placeholder="Buscar vaga..."
            className="min-w-[220px] max-w-[300px]"
          />
          <Button variant="outline" size="sm" type="button" onClick={() => { setPage(1); setLoading(true); sync().catch(() => toast.error("Falha ao aplicar filtros.")).finally(() => setLoading(false)); }}>
            Aplicar
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => { setQInput(""); setQ(""); setStatuses([]); setVagaId(""); setPage(1); setLoading(true); sync().catch(() => toast.error("Falha ao limpar filtros.")).finally(() => setLoading(false)); }}>
            Limpar
          </Button>
          <div className="flex items-center rounded-md border border-input bg-background p-0.5">
            <button type="button" className={`inline-flex h-8 w-10 items-center justify-center rounded-sm text-xs transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} title="Lista">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
            </button>
            <button type="button" className={`inline-flex h-8 w-10 items-center justify-center rounded-sm text-xs transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("kanban")} title="Kanban">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
        <>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ minWidth: 260 }}>Candidato</TableHead>
                <TableHead style={{ minWidth: 220 }}>Vaga</TableHead>
                <TableHead style={{ minWidth: 150 }}>Status</TableHead>
                <TableHead style={{ minWidth: 130 }}>Data</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    Carregando…
                  </TableCell>
                </TableRow>
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
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => void openDetail(c.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-10 rounded-xl grid place-items-center bg-[rgb(var(--lt-soft)/0.35)] border border-[rgb(var(--lt-brand)/0.18)] text-[rgb(var(--lt-primary))] font-black shrink-0">{initials(pickString(c.nome, ""))}</div>
                          <div>
                            <div className="text-sm font-medium">{c.nome ?? "—"}</div>
                            <div className="text-muted-foreground text-xs">
                              <span>{c.email ?? ""}</span>
                              {c.fone ? (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>{c.fone}</span>
                                </>
                              ) : null}
                            </div>
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <WhatsAppContactButton
                                size="xs"
                                celular={pickString((c as Record<string, unknown>)?.celular, "")}
                                fone={c.fone}
                                candidatoNome={c.nome}
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium max-w-[220px] truncate">{v?.label ? v.label.replace(/\s*\([^)]+\)\s*$/, "") : c.vagaTitle ?? "—"}</div>
                        <div className="text-muted-foreground text-xs tabular-nums font-mono">{v?.code ?? c.vagaCode ?? ""}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tag.colorCls}`}>{statusLabelText}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-xs text-muted-foreground">
                        {c.createdAtUtc ? new Date(c.createdAtUtc).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => void openDetail(c.id)}>
                              <Eye className="mr-2 size-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openEdit(c.id)}>
                              <Pencil className="mr-2 size-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void deleteCandidate(c.id)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    Nenhum candidato encontrado. Publique vagas no portal ou adicione candidatos manualmente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border/40 px-4 py-3">
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
        </>
        ) : (
          /* ── Kanban View ── */
          <div className="overflow-x-auto p-4">
            {loading ? (
              <div className="flex gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-72 shrink-0 space-y-3">
                    <div className="h-8 animate-pulse rounded-lg bg-muted" />
                    <div className="h-20 animate-pulse rounded-lg bg-muted" />
                    <div className="h-20 animate-pulse rounded-lg bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 items-start">
                {(statusOptionsEffective.length ? statusOptionsEffective : [
                  { code: "pendente", text: "Pendente" },
                  { code: "triagem", text: "Triagem" },
                  { code: "aprovado", text: "Aprovado" },
                  { code: "reprovado", text: "Reprovado" },
                ]).map((col) => {
                  const colItems = items.filter((c) => {
                    const s = (c.status ?? "").toLowerCase();
                    const code = col.code.toLowerCase();
                    return s === code || s.includes(code);
                  });
                  const tagMeta = statusTag(col.code);
                  const colCls = tagMeta.colorCls;
                  return (
                    <div key={col.code} className="w-72 shrink-0 flex flex-col rounded-xl border border-border/50 bg-muted/10">
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colCls}`}>{col.text}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{colItems.length}</span>
                      </div>
                      <div className="flex-1 space-y-2 p-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                        {colItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
                            Nenhum
                          </div>
                        ) : colItems.map((c) => {
                          const v = vagas.find((x) => x.id === (c.vagaId ?? "")) ?? null;
                          const score = clamp(pickNumber(c.lastMatch?.score, 0), 0, 100);
                          return (
                            <div
                              key={c.id}
                              className="rounded-lg border border-border/50 bg-card p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                              onClick={() => void openDetail(c.id)}
                            >
                              <div className="flex items-center gap-2">
                                <div className="size-7 text-[10px] shrink-0 rounded-full bg-muted flex items-center justify-center font-bold">{initials(pickString(c.nome, ""))}</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium leading-tight truncate">{c.nome ?? "—"}</div>
                                  <div className="text-[11px] text-muted-foreground truncate">{c.email ?? ""}</div>
                                </div>
                              </div>
                              {v && <div className="mt-2 text-[11px] text-muted-foreground truncate">{v.label?.replace(/\s*\([^)]+\)\s*$/, "") ?? ""}</div>}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">{c.createdAtUtc ? new Date(c.createdAtUtc).toLocaleDateString("pt-BR") : ""}</span>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="outline" size="sm" type="button" onClick={() => void openEdit(c.id)}>Editar</Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setDetailOpen(false)}>
          <div
            className="flex h-[85vh] max-h-[900px] w-full max-w-[min(96vw,72rem)] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-border/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="size-[52px] rounded-xl grid place-items-center bg-[rgb(var(--lt-soft)/0.35)] border border-[rgb(var(--lt-brand)/0.18)] text-[rgb(var(--lt-primary))] font-black shrink-0">
                    {initials(pickString(detail?.nome, ""))}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-extrabold">{detail?.nome ?? "—"}</div>
                    <div className="text-muted-foreground text-sm">
                      <span className="break-all">{detail?.email ?? ""}</span>
                      {detail?.fone ? (
                        <>
                          <span className="mx-2">•</span>
                          <span>{detail.fone}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      <span>{[detail?.cidade, detail?.uf].filter(Boolean).join(" - ") || ""}</span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      <span>Fonte: {enumText(enums, "candidatoFonte", (detail as Record<string, unknown>)?.fonte, "—")}</span>
                      {(detail as Record<string, unknown>)?.applicationRecruiterUserName ? (
                        <>
                          <span className="mx-2">•</span>
                          <span>Recrutador: {pickString((detail as Record<string, unknown>)?.applicationRecruiterUserName, "—")}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {detail?.id ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/candidatos/detalhes?id=${encodeURIComponent(detail.id)}${pickString(detail.vagaId, "").trim() ? `&vagaId=${encodeURIComponent(pickString(detail.vagaId, "").trim())}` : ""}`}
                        onClick={() => setDetailOpen(false)}
                      >
                        Abrir em página
                      </Link>
                    </Button>
                  ) : null}
                  <WhatsAppContactButton
                    size="sm"
                    celular={pickString((detail as Record<string, unknown> | null)?.celular, "")}
                    fone={detail?.fone}
                    candidatoNome={detail?.nome}
                  />
                  <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>

            {!detail ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">Carregando…</div>
            ) : (
              (() => {
                const detailApproved = isCandidatoAprovado(detail.status);
                const statusResolved = resolveStatusEnumCode(detail.status, enums);
                const st = statusTag(statusResolved);
                const statusLabelResolved = enumText(enums, "candidatoStatus", statusResolved, st.label);
                const updatedIso = pickString((detail as Record<string, unknown>)?.updatedAtUtc ?? (detail as Record<string, unknown>)?.updatedAt, "");
                const updatedTxt = updatedIso
                  ? new Date(updatedIso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "—";
                const cvTextValue = pickString(detail.cvText, "");
                const cvCharCount = cvTextValue.length;
                const cvLineCount = cvTextValue ? cvTextValue.split(/\r?\n/).length : 0;

                return (
                  <div className="flex min-h-0 flex-1 flex-col p-4 pt-3">
                    <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { key: "resumo", label: "Resumo" },
                            { key: "cv", label: "Texto do CV" },
                            { key: "docs", label: "Documentos" },
                            { key: "match", label: "Match" },
                            { key: "perfilPortal", label: "Perfil portal" },
                          ] as const
                        ).map((t) => (
                          <Button
                            key={t.key}
                            size="sm"
                            variant={detailTab === t.key ? "default" : "outline"}
                            onClick={() => setDetailTab(t.key)}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                      <div className="text-end">
                        <div className="mb-1">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.colorCls}`}>{statusLabelResolved}</span>
                        </div>
                        <div className="text-muted-foreground text-sm">Atualizado: {updatedTxt}</div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {detailTab === "resumo" ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
                          <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {detailApproved ? (
                              <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                                <Lock className="mt-0.5 size-4 shrink-0" />
                                <span>Candidato aprovado — status e vaga estão bloqueados para esta candidatura.</span>
                              </div>
                            ) : null}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                <div className="mb-1 font-medium">Observações</div>
                                <div className="whitespace-pre-wrap text-sm text-muted-foreground">{pickString((detail as Record<string, unknown>)?.obs, "—") || "—"}</div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <div className="mb-1 text-sm text-muted-foreground">Status</div>
                                  {detailApproved ? (
                                    <div className="flex h-9 items-center">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.colorCls}`}>{statusLabelResolved}</span>
                                    </div>
                                  ) : (
                                    <select
                                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                      value={statusResolved}
                                      onChange={(e) => setDetail({ ...detail, status: e.target.value })}
                                    >
                                      {statusOptionsEffective.map((opt) => (
                                        <option key={opt.code} value={opt.code}>
                                          {opt.text}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                <div>
                                  <div className="mb-1 text-sm text-muted-foreground">Vaga</div>
                                  {detailApproved ? (
                                    <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                                      <Lock className="size-3.5 shrink-0" />
                                      <span className="truncate">{vagaLabelForId(detail.vagaId, vagas, detail)}</span>
                                    </div>
                                  ) : (
                                    <select
                                      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
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
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/40 px-4 py-3">
                            {!detailApproved ? (
                              <Button variant="outline" size="sm" onClick={() => void saveMeta()}>
                                Salvar status/vaga
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" onClick={() => void openEdit(detail.id)}>
                              Editar candidato
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {detailTab === "cv" ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
                          <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border/40 p-4 pb-3">
                            <div>
                              <div className="font-medium">Texto do CV</div>
                              <div className="text-xs text-muted-foreground">Texto usado para cálculo de match com a vaga</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
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
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => void recalcMatch(detail.id)}>
                                <RefreshCw className="mr-1.5 size-3.5" />
                                Recalcular match
                              </Button>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 px-4 py-3">
                            <textarea
                              className="h-full min-h-[280px] w-full resize-none rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={detail.cvText ?? ""}
                              onChange={(e) => setDetail({ ...detail, cvText: e.target.value })}
                            />
                          </div>
                          <div className="shrink-0 border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
                            {cvCharCount.toLocaleString("pt-BR")} caracteres · {cvLineCount.toLocaleString("pt-BR")} linhas
                            {updatedIso ? ` · Última edição ${updatedTxt}` : null}
                          </div>
                        </div>
                      ) : null}

                      {detailTab === "docs" ? (
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card p-4">
                          <div className="mb-2 font-medium">Documentos</div>
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
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card p-4">
                          {!pickString(detail.vagaId, "").trim() ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                              Vincule uma vaga ao candidato para calcular o match.
                            </div>
                          ) : !detailMatch ? (
                            <div className="text-sm text-muted-foreground">Carregando match…</div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold">Resultado atual</div>
                                  <div className="text-sm text-muted-foreground">Score por palavras-chave</div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${detailMatch.pass ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"}`}>
                                  {detailMatch.pass ? "Dentro do mínimo" : "Abaixo do mínimo"}
                                </span>
                              </div>

                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-[rgb(var(--lt-primary))] transition-all" style={{ width: `${clamp(detailMatch.score, 0, 100)}%` }} />
                                  </div>
                                  <div className="min-w-[54px] text-right font-semibold">{clamp(detailMatch.score, 0, 100)}%</div>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Match mínimo da vaga: <strong>{detailMatch.threshold}%</strong>
                                  <span className="mx-1">•</span> Encontrados: <strong>{detailMatch.hits.length}</strong>
                                  <span className="mx-1">•</span> Obrigatórios faltando: <strong>{detailMatch.missMandatory.length}</strong>
                                </div>
                              </div>

                              {detailMatch.missMandatory.length ? (
                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                  <div className="mb-1 font-medium">Obrigatórios não encontrados</div>
                                  <div className="text-sm">{detailMatch.missMandatory.map((x) => x.termo).slice(0, 12).join(", ")}</div>
                                </div>
                              ) : null}

                              <div className="mt-3">
                                <div className="mb-1 font-medium">Encontrados</div>
                                <div className="text-sm text-muted-foreground">{detailMatch.hits.map((x) => x.termo).slice(0, 12).join(", ") || "—"}</div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => void recalcMatch(detail.id)}>
                                  Recalcular
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => toast.info("Placeholder: aqui abriria a tela de Vagas filtrada na vaga.")}>
                                  Abrir vaga (placeholder)
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}

                      {detailTab === "perfilPortal" ? (
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50 bg-card p-4">
                          <div className="mb-3 text-xs text-muted-foreground">Dados preenchidos pelo candidato no portal (somente leitura).</div>
                          <CandidatoPortalPerfilReadonly
                            data={portalPerfil}
                            loading={portalPerfilLoading}
                            loadError={portalPerfilError}
                            candidatoId={detail.id}
                            apiPathPrefix={BASE}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setEditOpen(false)}>
          <div
            className="flex h-[85vh] max-h-[900px] w-full max-w-[min(96vw,48rem)] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-border/40 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{draft.id ? "Editar candidato" : "Novo candidato"}</p>
                  <div className="text-lg font-extrabold">Cadastro</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {(() => {
                  const draftApproved = isCandidatoAprovado(draft.status);
                  return (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-blue-700">Vaga *</label>
                      {draftApproved ? (
                        <>
                          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                            <Lock className="size-3.5 shrink-0" />
                            <span className="truncate">{vagaLabelForId(draft.vagaId, vagas, draft)}</span>
                          </div>
                          <p className="mt-1.5 text-xs text-blue-700/80">Vaga bloqueada — candidato já aprovado.</p>
                        </>
                      ) : (
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={pickString(draft.vagaId, "")}
                          onChange={(e) => setDraft({ ...draft, vagaId: e.target.value })}
                        >
                          <option value="">Selecione a vaga...</option>
                          {vagas.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}

              {/* ── Dados pessoais ── */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Dados do Candidato</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Nome *</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={pickString(draft.nome, "")} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} placeholder="Nome completo" />
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Email *</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="email" value={pickString(draft.email, "")} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@exemplo.com" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Telefone</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={pickString(draft.fone, "")} onChange={(e) => setDraft({ ...draft, fone: e.target.value })} placeholder="(11) 99999-0000" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Celular *</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={pickString((draft as Record<string, unknown>)?.celular, "")} onChange={(e) => setDraft({ ...draft, celular: e.target.value })} placeholder="(11) 99999-0000" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Cidade</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={pickString(draft.cidade, "")} onChange={(e) => setDraft({ ...draft, cidade: e.target.value })} placeholder="São Paulo" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">UF</label>
                    <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" maxLength={2} value={pickString(draft.uf, "")} onChange={(e) => setDraft({ ...draft, uf: e.target.value.toUpperCase() })} placeholder="SP" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Fonte</label>
                    <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={pickString((draft as Record<string, unknown>)?.fonte, defaultEnumCode("candidatoFonte", "email"))} onChange={(e) => setDraft({ ...draft, fonte: e.target.value })}>
                      {enumOptions(enums, "candidatoFonte").map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.text}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Informações profissionais ── */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Informações Profissionais</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Pretensão salarial (R$)</label>
                    <input
                      className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      type="number"
                      min={0}
                      step={100}
                      placeholder="Ex: 5000"
                      value={draft.pretensaoSalarial != null ? String(draft.pretensaoSalarial) : ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          pretensaoSalarial: e.target.value !== "" ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Trabalhando atualmente?</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={
                        draft.trabalhandoAtualmente === true ? "sim"
                        : draft.trabalhandoAtualmente === false ? "nao"
                        : ""
                      }
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          trabalhandoAtualmente:
                            e.target.value === "sim" ? true : e.target.value === "nao" ? false : null,
                        })
                      }
                    >
                      <option value="">Não informado</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  <div className="md:col-span-12">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">LinkedIn</label>
                    <input
                      className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      type="url"
                      placeholder="https://linkedin.com/in/..."
                      value={draft.linkedinUrl ?? ""}
                      onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value || null })}
                    />
                  </div>
                  <div className="md:col-span-12">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Observações</label>
                    <textarea className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} value={pickString((draft as Record<string, unknown>)?.obs, "")} onChange={(e) => setDraft({ ...draft, obs: e.target.value })} placeholder="Observações sobre o candidato..." />
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60 p-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 border-b pb-1">Documentos</h3>
                  {!draft.id ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm mb-2">
                      Os documentos serão enviados ao salvar o candidato.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Tipo</label>
                      <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draftDocTipo} onChange={(e) => setDraftDocTipo(e.target.value)}>
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
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Descrição</label>
                      <input className="form-input w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={draftDocDescricao} onChange={(e) => setDraftDocDescricao(e.target.value)} placeholder="Ex.: CV atualizado" />
                    </div>
                    <div className="overflow-hidden">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Arquivo</label>
                      <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700" type="file" onChange={(e) => setDraftDocFile(e.currentTarget.files?.[0] ?? null)} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
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
                    </Button>
                  </div>

                  {pendingDocs.length ? (
                    <div className="mt-3">
                      <div className="font-medium text-sm mb-2">Pendentes</div>
                      <div className="space-y-2">
                        {pendingDocs.map((d) => {
                          const tipoTxt = enumText(enums, "candidatoDocumentoTipo", d.tipo, d.tipo);
                          const candId = pickString(draft.id, "").trim();
                          return (
                            <div key={d.tempId} className="flex items-start justify-between gap-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{d.nomeArquivo}</div>
                                <div className="text-muted-foreground text-xs">
                                  {tipoTxt} • {d.descricao || "Sem descrição"} • {formatFileSize(d.tamanhoBytes)} •{" "}
                                  <span className={d.status === "failed" ? "text-red-600" : "text-amber-600"}>
                                    {d.status === "failed" ? "Falhou" : "Pendente"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
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
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setPendingDocs((prev) => prev.filter((x) => x.tempId !== d.tempId))}>
                                  Remover
                                </Button>
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
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 p-4">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void saveDraft()}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {suggestOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setSuggestOpen(false)}>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm w-full max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sugestões da IA</p>
                <div className="text-lg font-extrabold">Aplicar dados extraídos</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSuggestOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">CV (texto)</label>
                <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={8} value={suggestedCvText} onChange={(e) => setSuggestedCvText(e.target.value)} />
              </div>
              <div className="space-y-2">
                {(["nome", "email", "fone", "cidade", "uf"] as const).map((k) => (
                  <div key={k}>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">{k.toUpperCase()}</label>
                    <input
                      className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={pickString(suggested?.[k], "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSuggested((prev) => ({ ...(prev ?? {}), [k]: v }));
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Resumo</label>
                  <textarea
                    className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    rows={3}
                    value={pickString(suggested?.resumoProfissional, "")}
                    onChange={(e) => setSuggested((prev) => ({ ...(prev ?? {}), resumoProfissional: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSuggestOpen(false)}>
                Cancelar
              </Button>
              {detail?.talentoId ? (
                <Button variant="outline" size="sm" onClick={() => void applySuggestedToCandidate(true)}>
                  Aplicar no candidato e no talento
                </Button>
              ) : null}
              <Button onClick={() => void applySuggestedToCandidate(false)}>
                Aplicar no candidato
              </Button>
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
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [previewingDocId, setPreviewingDocId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; nomeArquivo: string } | null>(null);

  const docs = Array.isArray(candidato.documentos) ? candidato.documentos : [];
  const tipoText = (code: string | null | undefined) => {
    const k = (code ?? "").toString().trim().toLowerCase();
    const opt = docTipoOptions.find((o) => o.code.toLowerCase() === k);
    return opt?.text ?? (code ?? "—");
  };

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview?.url]);

  async function previewDocumentoPdf(path: string, nomeArquivo: string, docId: string) {
    setPreviewingDocId(docId);
    try {
      const res = await apiFetch(path, { method: "GET", headers: { Accept: "application/pdf,*/*" } }, 120_000);
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        throw new Error(raw?.trim() || `Falha ao abrir documento (${res.status}).`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
      setPdfPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: objectUrl, nomeArquivo };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir documento.");
    } finally {
      setPreviewingDocId(null);
    }
  }

  function closePdfPreview() {
    setPdfPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
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
        <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input
          className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          type="file"
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
        <Button
          variant="outline"
          size="sm"
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
        </Button>
      </div>

      <div className="mt-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60 p-2">
        <div className="font-medium mb-2">CV PDF + Extrair</div>
        <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="file" accept="application/pdf" onChange={(e) => setCvFile(e.currentTarget.files?.[0] ?? null)} />
        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enviarParaGpt} onChange={(e) => setEnviarParaGpt(e.target.checked)} />
          Enviar para IA (GPT)
        </label>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
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
        </Button>
      </div>

      <div className="mt-2">
        {docs.length ? (
          <div className="space-y-2">
            {docs.map((d) => {
              const nomeArquivo = d.nomeArquivo ?? "documento";
              const temArquivo = candidatoDocumentoTemArquivo(asRecord(d));
              const isPdf = isPdfDocument(nomeArquivo, d.contentType ?? null);
              const path = buildCandidatoDocumentoDownloadPath(candidato.id, d.id, BASE);

              return (
                <div key={d.id} className="flex items-start justify-between gap-2 rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{nomeArquivo}</div>
                    <div className="text-muted-foreground text-xs">
                      {tipoText(d.tipo)} • {d.descricao ?? "Sem descrição"}{" "}
                      {d.tamanhoBytes ? <>• {formatFileSize(d.tamanhoBytes)}</> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {temArquivo && isPdf ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={previewingDocId === d.id}
                        onClick={() => void previewDocumentoPdf(path, nomeArquivo, d.id)}
                      >
                        {previewingDocId === d.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />}
                        Visualizar
                      </Button>
                    ) : null}
                    {temArquivo ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingDocId === d.id}
                        onClick={() => {
                          void (async () => {
                            setDownloadingDocId(d.id);
                            try {
                              await downloadCandidatoDocumento(path, nomeArquivo);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Falha ao baixar o documento.");
                            } finally {
                              setDownloadingDocId(null);
                            }
                          })();
                        }}
                      >
                        {downloadingDocId === d.id ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}
                        Download
                      </Button>
                    ) : d.url && /^https?:\/\//i.test(d.url) ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={d.url} target="_blank" rel="noreferrer">
                          Abrir link
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
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
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Sem documentos.</div>
        )}
      </div>

      {pdfPreview ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={closePdfPreview}>
          <div className="flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Visualizar PDF</div>
                <div className="truncate text-xs text-muted-foreground">{pdfPreview.nomeArquivo}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = pdfPreview.url;
                    a.download = pdfPreview.nomeArquivo || "documento.pdf";
                    a.rel = "noopener";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="mr-1 size-4" />
                  Baixar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={closePdfPreview}>
                  Fechar
                </Button>
              </div>
            </div>
            <iframe title={`PDF - ${pdfPreview.nomeArquivo}`} src={pdfPreview.url} className="min-h-0 flex-1 bg-slate-100" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

