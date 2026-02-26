"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import type { MatchingCandidate, VagaDetail, VagaListItem } from "@/server/recrutamento/vagas.schema";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

const BASE = "/app";

type VagasPayload = unknown;

type DetailTab = "resumo" | "requisitos" | "candidatos";

type ReqDraft = {
  nome: string;
  peso: number;
  obrigatorio: boolean;
};

type VagaDraft = {
  id?: string;
  titulo: string;
  codigo: string;
  area: string;
  modalidade: string;
  cidade: string;
  uf: string;
  status: string;
  descricao: string;
  threshold: number;
  requisitos: ReqDraft[];
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

function mapVagasPayload(payload: VagasPayload): VagaListItem[] {
  if (Array.isArray(payload)) return payload as VagaListItem[];
  const r = asRecord(payload);
  const items = r?.items;
  if (Array.isArray(items)) return items as VagaListItem[];
  return [];
}

function calcReqTotals(v: VagaListItem) {
  const reqs = Array.isArray(v.requisitos) ? v.requisitos : [];
  const total =
    typeof v.requisitosTotal === "number"
      ? v.requisitosTotal
      : Number.isFinite(Number(v.requisitosTotal))
        ? Number(v.requisitosTotal)
        : reqs.length;
  const obrig =
    typeof v.requisitosObrigatorios === "number"
      ? v.requisitosObrigatorios
      : Number.isFinite(Number(v.requisitosObrigatorios))
        ? Number(v.requisitosObrigatorios)
        : reqs.filter((x) => !!asRecord(x)?.obrigatorio).length;
  return { total: Number(total) || 0, obrig: Number(obrig) || 0 };
}

function statusTag(statusRaw: string | null | undefined) {
  const s = (statusRaw ?? "").trim().toLowerCase();
  if (s === "aberta" || s === "ativa") return { cls: "ok", label: "Aberta" };
  if (s === "rascunho") return { cls: "warn", label: "Rascunho" };
  if (s === "pausada") return { cls: "warn", label: "Pausada" };
  if (s === "fechada" || s === "encerrada") return { cls: "bad", label: "Fechada" };
  if (!s) return { cls: "", label: "—" };
  return { cls: "", label: statusRaw ?? "—" };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function VagasScreen() {
  const searchParams = useSearchParams();
  const deeplinkHandled = useRef(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VagaListItem[]>([]);

  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [areas, setAreas] = useState<string[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("resumo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VagaDetail | null>(null);
  const [matching, setMatching] = useState<MatchingCandidate[] | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<VagaDraft>(() => ({
    titulo: "",
    codigo: "",
    area: "",
    modalidade: "presencial",
    cidade: "",
    uf: "",
    status: "aberta",
    descricao: "",
    threshold: 70,
    requisitos: [],
  }));

  async function syncList() {
    const payload = await fetchJson<VagasPayload>(`${BASE}/api/vagas`);
    const list = mapVagasPayload(payload);
    setRows(list);

    const areaSet = new Set<string>();
    for (const v of list) {
      const a = (v.area ?? "").trim();
      if (a) areaSet.add(a);
    }
    setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    syncList()
      .catch(() => toast.error("Falha ao carregar vagas."))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((v) => {
      const st = (v.status ?? "").toLowerCase();
      const ar = (v.area ?? "").trim();
      if (status !== "all" && st !== status) return false;
      if (area !== "all" && ar !== area) return false;
      if (!qq) return true;
      const blob = [v.codigo, v.titulo, v.area, v.modalidade, v.cidade, v.uf]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [area, q, rows, status]);

  /* pagination (client-side) */
  const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
    initialPageSize: 20,
    resetDeps: [q, area, status],
  });
  const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

  async function ensureDetail(id: string) {
    const res = await fetchJson<VagaDetail>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
    return res;
  }

  async function openDetails(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
    setDetailTab("resumo");
    setMatching(null);
    try {
      const d = await ensureDetail(id);
      setDetail(d);
    } catch {
      toast.error("Falha ao carregar detalhes da vaga.");
      setDetail(null);
    }
  }

  // Deep-link support: /app/vagas?vagaId=...&open=detail
  useEffect(() => {
    if (deeplinkHandled.current) return;
    const open = searchParams.get("open");
    const vagaId = searchParams.get("vagaId");
    if (open === "detail" && vagaId) {
      deeplinkHandled.current = true;
      void openDetails(vagaId);
    }
  }, [openDetails, searchParams]);

  function openNew() {
    setDraft({
      id: undefined,
      titulo: "",
      codigo: "",
      area: "",
      modalidade: "presencial",
      cidade: "",
      uf: "",
      status: "aberta",
      descricao: "",
      threshold: 70,
      requisitos: [],
    });
    setEditOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const d = await ensureDetail(id);
      const r = asRecord(d) ?? {};
      const reqsRaw = Array.isArray(r.requisitos) ? r.requisitos : [];
      const reqs: ReqDraft[] = reqsRaw
        .map((x) => {
          const rr = asRecord(x) ?? {};
          const nome = pickString(rr.nome ?? rr.termo ?? rr.titulo ?? rr.texto, "").trim();
          if (!nome) return null;
          return {
            nome,
            peso: clamp(pickNumber(rr.peso, 1), 0, 10),
            obrigatorio: !!(rr.obrigatorio ?? rr.required ?? rr.obrigatoria),
          };
        })
        .filter(Boolean) as ReqDraft[];

      setDraft({
        id,
        titulo: pickString(r.titulo, ""),
        codigo: pickString(r.codigo, ""),
        area: pickString(r.area, ""),
        modalidade: pickString(r.modalidade, "presencial"),
        cidade: pickString(r.cidade, ""),
        uf: pickString(r.uf, ""),
        status: pickString(r.status, "aberta"),
        descricao: pickString(r.descricao, ""),
        threshold: clamp(pickNumber(r.threshold ?? r.matchMinimoPercentual, 70), 0, 100),
        requisitos: reqs,
      });
      setEditOpen(true);
    } catch {
      toast.error("Falha ao abrir edição.");
    }
  }

  function exportJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      vagas: rows,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vagas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportação iniciada.");
  }

  async function importJson(file: File) {
    const text = await file.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const r = asRecord(parsed);
    const vagas = Array.isArray(r?.vagas) ? r!.vagas : null;
    if (!vagas) {
      toast.error("JSON inválido (esperado: { vagas: [...] }).");
      return;
    }
    for (const v of vagas) {
      const rr = asRecord(v) ?? {};
      const payload = rr; // envia “como veio” (compatível com export do próprio sistema)
      await fetchJson(`${BASE}/api/vagas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    toast.success("Importação concluída.");
    await syncList();
  }

  async function saveDraft() {
    const payload: Record<string, unknown> = {
      titulo: draft.titulo.trim(),
      codigo: draft.codigo.trim() || null,
      area: draft.area.trim() || null,
      modalidade: draft.modalidade.trim() || null,
      cidade: draft.cidade.trim() || null,
      uf: draft.uf.trim() || null,
      status: draft.status.trim() || null,
      descricao: draft.descricao.trim() || null,
      threshold: clamp(draft.threshold, 0, 100),
      matchMinimoPercentual: clamp(draft.threshold, 0, 100),
      requisitos: draft.requisitos
        .filter((r) => r.nome.trim())
        .map((r, idx) => ({
          ordem: idx + 1,
          categoria: "geral",
          nome: r.nome.trim(),
          termo: r.nome.trim(),
          peso: String(clamp(r.peso, 0, 10)),
          obrigatorio: !!r.obrigatorio,
        })),
    };

    try {
      if (draft.id) {
        await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(draft.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Vaga atualizada.");
      } else {
        await fetchJson(`${BASE}/api/vagas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Vaga criada.");
      }
      setEditOpen(false);
      await syncList();
    } catch {
      toast.error("Falha ao salvar vaga.");
    }
  }

  async function deleteVaga(id: string) {
    const v = rows.find((x) => x.id === id);
    const ok = confirm(`Excluir a vaga "${v?.titulo ?? ""}"?\n\nIsso remove também os requisitos.`);
    if (!ok) return;
    try {
      await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Vaga excluída.");
      await syncList();
    } catch {
      toast.error("Falha ao excluir vaga.");
    }
  }

  async function duplicateVaga(id: string) {
    try {
      const d = await ensureDetail(id);
      const r = asRecord(d) ?? {};
      const baseCode = pickString(r.codigo, "").trim();
      const baseTitle = pickString(r.titulo, "").trim();
      r.codigo = baseCode ? `${baseCode}-COPY`.slice(0, 40) : null;
      r.titulo = baseTitle ? `${baseTitle} (Cópia)`.slice(0, 160) : "Cópia";
      await fetchJson(`${BASE}/api/vagas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
      toast.success("Vaga duplicada.");
      await syncList();
    } catch {
      toast.error("Falha ao duplicar vaga.");
    }
  }

  async function saveThreshold(value: number) {
    if (!selectedId || !detail) return;
    setSavingDetail(true);
    try {
      const r = asRecord(detail) ?? {};
      r.threshold = clamp(value, 0, 100);
      r.matchMinimoPercentual = clamp(value, 0, 100);
      await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
      toast.success("Match mínimo salvo.");
      const d2 = await ensureDetail(selectedId);
      setDetail(d2);
      await syncList();
    } catch {
      toast.error("Falha ao salvar threshold.");
    } finally {
      setSavingDetail(false);
    }
  }

  async function loadMatchingCandidates() {
    if (!selectedId) return;
    setMatching(null);
    try {
      const list = await fetchJson<MatchingCandidate[]>(
        `${BASE}/api/vagas/${encodeURIComponent(selectedId)}/matching-candidates?take=20`,
      );
      setMatching(Array.isArray(list) ? list : []);
    } catch {
      setMatching([]);
    }
  }

  const detailBasics = useMemo(() => {
    const r = asRecord(detail) ?? {};
    const thr = clamp(pickNumber(r.threshold ?? r.matchMinimoPercentual, 0), 0, 100);
    const reqs = Array.isArray(r.requisitos) ? r.requisitos : [];
    const total = reqs.length;
    const obrig = reqs.filter((x) => !!asRecord(x)?.obrigatorio).length;
    const updated = pickString(r.updatedAt, "");
    return { thr, total, obrig, updated };
  }, [detail]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Vagas</h4>
          <div className="text-muted-foreground text-sm">Vagas • Requisitos • Match</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Exportar
          </button>
          <label className="btn-ghost cursor-pointer">
            Importar
            <input
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (!f) return;
                void importJson(f).finally(() => {
                  e.currentTarget.value = "";
                });
              }}
            />
          </label>
          <button className="btn-brand" type="button" onClick={openNew}>
            Nova vaga
          </button>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            className="form-control w-[260px]"
            placeholder="Buscar por título, código, área..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="form-select w-[220px]" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select className="form-select w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos status</option>
            <option value="aberta">Aberta</option>
            <option value="rascunho">Rascunho</option>
            <option value="pausada">Pausada</option>
            <option value="fechada">Fechada</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Vaga</th>
                <th style={{ minWidth: 130 }}>Área</th>
                <th style={{ minWidth: 150 }}>Requisitos</th>
                <th style={{ minWidth: 120 }}>Match min.</th>
                <th style={{ minWidth: 120 }}>Status</th>
                <th className="text-end" style={{ minWidth: 230 }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length ? (
                paged.map((v) => {
                  const { total, obrig } = calcReqTotals(v);
                  const thr = clamp(pickNumber(v.threshold ?? v.matchMinimoPercentual, 0), 0, 100);
                  const loc = [v.cidade, v.uf].filter(Boolean).join(" - ");
                  const tag = statusTag(v.status);
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="fw-bold">{v.titulo ?? "—"}</div>
                        <div className="text-muted small">
                          <span className="mono">{v.codigo ?? "—"}</span>
                          <span className="mx-2">•</span>
                          <span>{v.modalidade ?? "—"}</span>
                          {loc ? (
                            <>
                              <span className="mx-2">•</span>
                              <span>{loc}</span>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="nowrap">{v.area ?? "—"}</td>
                      <td className="nowrap">
                        <span className="req-chip">{total} total</span>
                        <span className="req-chip mandatory ms-1">{obrig} obrig.</span>
                      </td>
                      <td className="nowrap">
                        <span className="badge-soft">
                          <span className="mono">{thr}%</span>
                        </span>
                      </td>
                      <td className="nowrap">
                        <span className={`status-tag ${tag.cls}`}>{tag.label}</span>
                      </td>
                      <td className="text-end nowrap">
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openDetails(v.id)}>
                          Detalhes
                        </button>
                        <button
                          className="btn-ghost px-3 py-2 me-1"
                          type="button"
                          onClick={() => {
                            window.location.href = `/app/matching?vagaId=${encodeURIComponent(v.id)}`;
                          }}
                          title="Ver matching"
                        >
                          Matching
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openEdit(v.id)}>
                          Editar
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void duplicateVaga(v.id)} title="Duplicar">
                          Duplicar
                        </button>
                        <button className="btn-ghost px-3 py-2 text-red-600" type="button" onClick={() => void deleteVaga(v.id)} title="Excluir">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Nenhuma vaga encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-5xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Detalhes</p>
                <div className="text-lg font-extrabold">{pickString(asRecord(detail)?.titulo, "—")}</div>
                <div className="text-muted-foreground text-sm">
                  <span className="mono">{pickString(asRecord(detail)?.codigo, "—")}</span>
                  <span className="mx-2">•</span>
                  <span>{pickString(asRecord(detail)?.area, "—")}</span>
                  <span className="mx-2">•</span>
                  <span>{pickString(asRecord(detail)?.modalidade, "—")}</span>
                </div>
              </div>
              <button
                className="btn-ghost px-3 py-2"
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setDetail(null);
                  setSelectedId(null);
                }}
              >
                Fechar
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="req-chip">{detailBasics.total} requisitos</span>
              <span className="req-chip mandatory">{detailBasics.obrig} obrigatórios</span>
              <span className="badge-soft">
                <span className="mono">{detailBasics.thr}%</span> match mín.
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="fw-semibold small">Match mínimo</span>
              <input
                type="range"
                className="form-range flex-grow-1"
                min={0}
                max={100}
                value={detailBasics.thr}
                onChange={(e) => {
                  const v = clamp(Number(e.target.value), 0, 100);
                  setDetail((d) => {
                    const rr = asRecord(d) ?? {};
                    return { ...(rr as VagaDetail), threshold: v, matchMinimoPercentual: v };
                  });
                }}
                style={{ maxWidth: 220 }}
              />
              <span className="badge-soft" style={{ minWidth: 74, textAlign: "center" }}>
                {detailBasics.thr}%
              </span>
              <button
                className="btn-brand"
                type="button"
                disabled={savingDetail}
                onClick={() => void saveThreshold(detailBasics.thr)}
              >
                Salvar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-full border border-[rgba(16,82,144,.14)] bg-[rgba(173,200,220,.16)] p-1">
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold ${detailTab === "resumo" ? "bg-white/90" : ""}`}
                onClick={() => setDetailTab("resumo")}
              >
                Resumo
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold ${detailTab === "requisitos" ? "bg-white/90" : ""}`}
                onClick={() => setDetailTab("requisitos")}
              >
                Requisitos
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold ${detailTab === "candidatos" ? "bg-white/90" : ""}`}
                onClick={() => {
                  setDetailTab("candidatos");
                  void loadMatchingCandidates();
                }}
              >
                Candidatos
              </button>
            </div>

            {detailTab === "resumo" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="fw-semibold">Descrição</div>
                  <div className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {pickString(asRecord(detail)?.descricao, "—")}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="mini-title mb-1">Local</div>
                    <div className="font-semibold">
                      {[pickString(asRecord(detail)?.cidade, ""), pickString(asRecord(detail)?.uf, "")]
                        .filter(Boolean)
                        .join(" - ") || "—"}
                    </div>
                  </div>
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="mini-title mb-1">Status</div>
                    <div className="font-semibold">{statusTag(pickString(asRecord(detail)?.status, "")).label}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {detailTab === "requisitos" ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="fw-semibold">Requisitos</div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      const rr = asRecord(detail) ?? {};
                      const reqs = Array.isArray(rr.requisitos) ? rr.requisitos : [];
                      rr.requisitos = [
                        ...reqs,
                        { nome: "", termo: "", peso: "1", obrigatorio: false, categoria: "geral", ordem: reqs.length + 1 },
                      ];
                      setDetail(rr as VagaDetail);
                    }}
                  >
                    + Novo requisito
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th style={{ width: 120 }}>Peso</th>
                        <th style={{ width: 140 }}>Obrigatório</th>
                        <th style={{ width: 120 }} className="text-end">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rr = asRecord(detail) ?? {};
                        const reqs = Array.isArray(rr.requisitos) ? rr.requisitos : [];
                        if (!reqs.length) {
                          return (
                            <tr>
                              <td colSpan={4} className="text-center text-muted py-4">
                                Sem requisitos.
                              </td>
                            </tr>
                          );
                        }
                        return reqs.map((x, idx) => {
                          const rx = asRecord(x) ?? {};
                          const nome = pickString(rx.nome ?? rx.termo, "");
                          const peso = clamp(pickNumber(rx.peso, 1), 0, 10);
                          const obrig = !!rx.obrigatorio;
                          return (
                            <tr key={String(rx.id ?? idx)}>
                              <td>
                                <input
                                  className="form-control"
                                  value={nome}
                                  onChange={(e) => {
                                    const rr2 = asRecord(detail) ?? {};
                                    const reqs2 = Array.isArray(rr2.requisitos) ? rr2.requisitos.slice() : [];
                                    const r2 = asRecord(reqs2[idx]) ?? {};
                                    r2.nome = e.target.value;
                                    r2.termo = e.target.value;
                                    reqs2[idx] = r2;
                                    rr2.requisitos = reqs2;
                                    setDetail(rr2 as VagaDetail);
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control"
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={peso}
                                  onChange={(e) => {
                                    const rr2 = asRecord(detail) ?? {};
                                    const reqs2 = Array.isArray(rr2.requisitos) ? rr2.requisitos.slice() : [];
                                    const r2 = asRecord(reqs2[idx]) ?? {};
                                    r2.peso = String(clamp(Number(e.target.value), 0, 10));
                                    reqs2[idx] = r2;
                                    rr2.requisitos = reqs2;
                                    setDetail(rr2 as VagaDetail);
                                  }}
                                />
                              </td>
                              <td>
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={obrig}
                                    onChange={(e) => {
                                      const rr2 = asRecord(detail) ?? {};
                                      const reqs2 = Array.isArray(rr2.requisitos) ? rr2.requisitos.slice() : [];
                                      const r2 = asRecord(reqs2[idx]) ?? {};
                                      r2.obrigatorio = e.target.checked;
                                      reqs2[idx] = r2;
                                      rr2.requisitos = reqs2;
                                      setDetail(rr2 as VagaDetail);
                                    }}
                                  />
                                  <span className="text-sm">Obrigatório</span>
                                </label>
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn-ghost text-red-600"
                                  type="button"
                                  onClick={() => {
                                    const rr2 = asRecord(detail) ?? {};
                                    const reqs2 = Array.isArray(rr2.requisitos) ? rr2.requisitos.slice() : [];
                                    reqs2.splice(idx, 1);
                                    rr2.requisitos = reqs2;
                                    setDetail(rr2 as VagaDetail);
                                  }}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button className="btn-ghost" type="button" onClick={() => setDetailTab("resumo")}>
                    Voltar
                  </button>
                  <button
                    className="btn-brand"
                    type="button"
                    disabled={savingDetail}
                    onClick={() => {
                      if (!selectedId || !detail) return;
                      setSavingDetail(true);
                      fetchJson(`${BASE}/api/vagas/${encodeURIComponent(selectedId)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(detail),
                      })
                        .then(() => toast.success("Requisitos salvos."))
                        .then(() => syncList())
                        .catch(() => toast.error("Falha ao salvar requisitos."))
                        .finally(() => setSavingDetail(false));
                    }}
                  >
                    Salvar requisitos
                  </button>
                </div>
              </div>
            ) : null}

            {detailTab === "candidatos" ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="fw-semibold">Matching (top 20)</div>
                  <button className="btn-ghost" type="button" onClick={() => void loadMatchingCandidates()}>
                    Atualizar
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th>Candidato</th>
                        <th style={{ width: 120 }}>Score</th>
                        <th style={{ width: 140 }}>Passa?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matching === null ? (
                        <tr>
                          <td colSpan={3} className="text-center text-muted py-4">
                            Carregando…
                          </td>
                        </tr>
                      ) : matching.length ? (
                        matching.map((c) => {
                          const score = clamp(pickNumber(c.score ?? c.match, 0), 0, 100);
                          const pass = score >= detailBasics.thr;
                          return (
                            <tr key={c.id}>
                              <td>
                                <div className="fw-bold">{c.nome ?? "—"}</div>
                                <div className="text-muted small">{c.email ?? ""}</div>
                              </td>
                              <td className="nowrap">
                                <span className="badge-soft">
                                  <span className="mono">{score}%</span>
                                </span>
                              </td>
                              <td className="nowrap">
                                <span className={`status-tag ${pass ? "ok" : "bad"}`}>{pass ? "Aprovado" : "Abaixo"}</span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center text-muted py-4">
                            Sem candidatos retornados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-4xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">{draft.id ? "Editar vaga" : "Nova vaga"}</p>
                <div className="text-lg font-extrabold">{draft.id ? "Atualizar" : "Cadastrar"}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setEditOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="mini-title mb-1 block">Título</label>
                <input className="form-control" value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Código</label>
                <input className="form-control" value={draft.codigo} onChange={(e) => setDraft({ ...draft, codigo: e.target.value })} />
              </div>

              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Área</label>
                <input className="form-control" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Modalidade</label>
                <select className="form-select" value={draft.modalidade} onChange={(e) => setDraft({ ...draft, modalidade: e.target.value })}>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="remoto">Remoto</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Status</label>
                <select className="form-select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="aberta">Aberta</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="pausada">Pausada</option>
                  <option value="fechada">Fechada</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Cidade</label>
                <input className="form-control" value={draft.cidade} onChange={(e) => setDraft({ ...draft, cidade: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">UF</label>
                <input className="form-control" value={draft.uf} onChange={(e) => setDraft({ ...draft, uf: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Match mínimo</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.threshold}
                  onChange={(e) => setDraft({ ...draft, threshold: clamp(Number(e.target.value), 0, 100) })}
                />
              </div>

              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Descrição</label>
                <textarea className="form-control" rows={4} value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} />
              </div>

              <div className="md:col-span-12">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="fw-semibold">Requisitos (simples)</div>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, requisitos: [...d.requisitos, { nome: "", peso: 1, obrigatorio: false }] }))
                    }
                  >
                    + Adicionar
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th style={{ width: 120 }}>Peso</th>
                        <th style={{ width: 160 }}>Obrigatório</th>
                        <th style={{ width: 120 }} className="text-end">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.requisitos.length ? (
                        draft.requisitos.map((r, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className="form-control"
                                value={r.nome}
                                onChange={(e) =>
                                  setDraft((d) => {
                                    const next = d.requisitos.slice();
                                    next[idx] = { ...next[idx], nome: e.target.value };
                                    return { ...d, requisitos: next };
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="form-control"
                                type="number"
                                min={0}
                                max={10}
                                value={r.peso}
                                onChange={(e) =>
                                  setDraft((d) => {
                                    const next = d.requisitos.slice();
                                    next[idx] = { ...next[idx], peso: clamp(Number(e.target.value), 0, 10) };
                                    return { ...d, requisitos: next };
                                  })
                                }
                              />
                            </td>
                            <td>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={r.obrigatorio}
                                  onChange={(e) =>
                                    setDraft((d) => {
                                      const next = d.requisitos.slice();
                                      next[idx] = { ...next[idx], obrigatorio: e.target.checked };
                                      return { ...d, requisitos: next };
                                    })
                                  }
                                />
                                <span className="text-sm">Obrigatório</span>
                              </label>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn-ghost text-red-600"
                                type="button"
                                onClick={() => setDraft((d) => ({ ...d, requisitos: d.requisitos.filter((_, i) => i !== idx) }))}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            Sem requisitos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
    </section>
  );
}

