"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

import type { MatchingCandidate, VagaDetail, VagaListItem } from "@/lib/schemas/recrutamento";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";
import { confirmDialog } from "@/lib/confirm-dialog";
import VagaFormModal from "./VagaFormModal";

const BASE = "/app";
const MATCHING_LAST_VAGA_KEY = "renderrh.matching.lastVagaId";

type VagasPayload = unknown;

type DetailTab = "resumo" | "requisitos" | "candidatos";

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

function mapVagaItem(raw: unknown): VagaListItem {
  const r = asRecord(raw) ?? {};
  return {
    ...(r as unknown as VagaListItem),
    area: String(r.areaName ?? r.area ?? ""),
  };
}

function mapVagasPayload(payload: VagasPayload): VagaListItem[] {
  if (Array.isArray(payload)) return (payload as unknown[]).map(mapVagaItem);
  const r = asRecord(payload);
  const items = r?.items;
  if (Array.isArray(items)) return (items as unknown[]).map(mapVagaItem);
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

function parseApiErrorMessage(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const detail = typeof parsed.detail === "string" ? parsed.detail : "";
    const title = typeof parsed.title === "string" ? parsed.title : "";
    return detail || title || text;
  } catch {
    return text;
  }
}

function isVagaDeleteRestrictedByCandidates(message: string): boolean {
  const m = (message || "").toLowerCase();
  return m.includes("fk_candidatos_vagas_vagaid") || (m.includes("violates restrict") && m.includes("candidatos"));
}

function mapCandidatosList(payload: unknown): Array<{ id: string; nome: string }> {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload)?.items)
      ? (asRecord(payload)?.items as unknown[])
      : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "").trim();
      if (!id) return null;
      return { id, nome: pickString(r.nome, "Candidato").trim() || "Candidato" };
    })
    .filter(Boolean) as Array<{ id: string; nome: string }>;
}

export default function VagasScreen() {
  const router = useRouter();
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
  const [editId, setEditId] = useState<string | null>(null);

  async function syncList() {
    const payload = await fetchJson<VagasPayload>(`${BASE}/api/vagas`);
    const list = mapVagasPayload(payload);
    setRows(list);
    setScreenCache("/vagas", list);

    const areaSet = new Set<string>();
    for (const v of list) {
      const a = (v.area ?? "").trim();
      if (a) areaSet.add(a);
    }
    setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
  }

  useEffect(() => {
    let alive = true;
    const cached = getScreenCache<VagaListItem[]>("/vagas");
    if (cached) {
      setRows(cached);
      const areaSet = new Set<string>();
      for (const v of cached) {
        const a = (v.area ?? "").trim();
        if (a) areaSet.add(a);
      }
      setAreas(Array.from(areaSet).sort((a, b) => a.localeCompare(b, "pt-BR")));
    } else {
      setLoading(true);
    }
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

  // Deep-link support:
  // - /app/vagas?vagaId=...&open=detail
  // - /app/vagas?open=create&titulo=...&area=...&status=...&keywords=a,b,c
  useEffect(() => {
    if (deeplinkHandled.current) return;
    const open = searchParams.get("open");
    const vagaId = searchParams.get("vagaId");
    if ((open === "create" || open === "new") && !vagaId) {
      openNew();
      deeplinkHandled.current = true;
      return;
    }
    if (open === "detail" && vagaId) {
      deeplinkHandled.current = true;
      void openDetails(vagaId);
    }
  }, [openDetails, searchParams]);

  function openNew() {
    setEditId(null);
    setEditOpen(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setEditOpen(true);
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

  async function handleFormSaved() {
    setEditOpen(false);
    setEditId(null);
    await syncList();
  }

  async function deleteVaga(id: string) {
    const v = rows.find((x) => x.id === id);
    const vagaNome = (v?.titulo ?? "").trim();
    if (vagaNome) {
      const typed = prompt(
        `Para confirmar a exclusão, digite o nome exato da vaga:\n\n${vagaNome}`,
        "",
      );
      if (typed == null) return;
      if (typed.trim() !== vagaNome) {
        toast.error("Nome da vaga não confere. Exclusão cancelada.");
        return;
      }
    } else {
      const ok = await confirmDialog({
        title: "Excluir vaga",
        description: `Excluir a vaga sem título (ID: ${id})?`,
        confirmText: "Excluir",
        destructive: true,
      });
      if (!ok) return;
    }

    try {
      await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
      setRows((prev) => prev.filter((x) => x.id !== id));
      toast.success("Vaga excluída.");
      await syncList().catch(() => null);
    } catch (e) {
      const msg = e instanceof Error ? parseApiErrorMessage(e.message) : "";
      if (isVagaDeleteRestrictedByCandidates(msg)) {
        const vinculadosPayload = await fetchJson<unknown>(
          `${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&pageSize=1000`,
        ).catch(() => null);
        const vinculados = mapCandidatosList(vinculadosPayload);
        const proceed = await confirmDialog({
          title: "Excluir vaga e candidatos vinculados",
          description: `Existem ${vinculados.length || "vários"} candidatos vinculados. Deseja excluir todos os candidatos vinculados e, em seguida, excluir a vaga? Essa ação não pode ser desfeita.`,
          confirmText: "Excluir tudo",
          destructive: true,
        });
        if (!proceed) return;

        let failed = 0;
        for (const c of vinculados) {
          try {
            await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(c.id)}`, { method: "DELETE" });
          } catch {
            failed += 1;
          }
        }
        if (failed > 0) {
          toast.error(`Falha ao excluir ${failed} candidato(s). A vaga não foi removida.`);
          return;
        }

        await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
        setRows((prev) => prev.filter((x) => x.id !== id));
        toast.success("Vaga e candidatos vinculados excluídos.");
        await syncList().catch(() => null);
        return;
      }
      toast.error(msg || "Falha ao excluir vaga.");
    }
  }

  async function duplicateVaga(id: string) {
    const v = rows.find((x) => x.id === id);
    const ok = await confirmDialog({
      title: "Duplicar vaga",
      description: `Duplicar a vaga "${v?.titulo ?? ""}"?`,
      confirmText: "Duplicar",
    });
    if (!ok) return;
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao duplicar vaga.");
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
                            if (!v.id) {
                              toast.error("Vaga inválida para abrir matching.");
                              return;
                            }
                            try {
                              sessionStorage.setItem(MATCHING_LAST_VAGA_KEY, v.id);
                              localStorage.setItem(MATCHING_LAST_VAGA_KEY, v.id);
                            } catch {
                              // ignore storage errors
                            }
                            router.push(`/matching?vagaId=${encodeURIComponent(v.id)}`);
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

      <VagaFormModal
        open={editOpen}
        editId={editId}
        onClose={() => { setEditOpen(false); setEditId(null); }}
        onSaved={() => void handleFormSaved()}
      />
    </section>
  );
}

