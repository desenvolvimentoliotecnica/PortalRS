"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { Candidato, CandidatosPaged, Documento } from "@/server/recrutamento/candidatos.schema";

import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

type VagaOption = { id: string; label: string; code?: string | null };

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

function recordString(r: Record<string, unknown>, key: string, fallback = "") {
  return pickString(r[key], fallback);
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

export default function CandidatosScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Candidato[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [vagaId, setVagaId] = useState<string>("");

  const [vagas, setVagas] = useState<VagaOption[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Candidato | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Candidato>>({});

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggested, setSuggested] = useState<Record<string, unknown> | null>(null);
  const [suggestedCvText, setSuggestedCvText] = useState("");

  async function loadVagas() {
    const payload = await fetchJson<unknown>(`${BASE}/api/vagas`);
    const list = arrayFromItemsPayload(payload);
    const mapped: VagaOption[] = list.map((v) => {
      const r = asRecord(v) ?? {};
      const id = pickString(r.id, "");
      const titulo = pickString(r.titulo, "");
      const codigo = pickString(r.codigo, "");
      return {
        id,
        label: codigo ? `${titulo} (${codigo})` : titulo,
        code: codigo || null,
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
    if (status !== "all") qs.set("status", status);
    if (vagaId) qs.set("vagaId", vagaId);
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
    Promise.all([loadVagas(), sync()])
      .catch(() => toast.error("Falha ao carregar candidatos."))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoading(true);
      sync()
        .catch(() => toast.error("Falha ao carregar candidatos."))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

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
    return { total: items.length, pend, tri, ap, rep };
  }, [items]);

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetail(null);
    try {
      const d = await fetchJson<Candidato>(`${BASE}/api/candidatos/${encodeURIComponent(id)}`);
      setDetail(d);
    } catch {
      toast.error("Falha ao carregar detalhes do candidato.");
    }
  }

  function openNew() {
    setDraft({ nome: "", email: "", status: "pendente", vagaId: "", cidade: "", uf: "" });
    setEditOpen(true);
  }

  async function openEdit(id: string) {
    try {
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

  async function saveDraft() {
    const id = draft.id ?? "";
    const payload = asRecord(draft) ?? {};
    try {
      const url = id ? `${BASE}/api/candidatos/${encodeURIComponent(id)}` : `${BASE}/api/candidatos`;
      const method = id ? "PUT" : "POST";
      await fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success(id ? "Candidato atualizado." : "Candidato criado.");
      setEditOpen(false);
      setPage(1);
      await sync();
    } catch {
      toast.error("Falha ao salvar candidato.");
    }
  }

  async function deleteCandidate(id: string) {
    const c = items.find((x) => x.id === id);
    if (!confirm(`Excluir o candidato "${c?.nome ?? ""}"?`)) return;
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
        body: JSON.stringify(detail),
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

  async function applySuggestedToCandidate() {
    if (!detail || !suggested) return;
    const s = suggested;
    const rr = asRecord(detail) ?? {};
    rr.nome = pickString(s.nome, recordString(rr, "nome"));
    rr.email = pickString(s.email, recordString(rr, "email"));
    rr.fone = pickString(s.fone, recordString(rr, "fone"));
    rr.cidade = pickString(s.cidade, recordString(rr, "cidade"));
    rr.uf = pickString(s.uf, recordString(rr, "uf")).toUpperCase().slice(0, 2);
    rr.resumoProfissional = pickString(s.resumoProfissional, recordString(rr, "resumoProfissional"));
    rr.cvText = suggestedCvText || recordString(rr, "cvText");
    setDetail(rr as Candidato);
    setSuggestOpen(false);
    setSuggested(null);
    toast.success("Sugestões aplicadas no candidato (não esqueça de salvar).");
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            <input className="form-control w-[260px]" placeholder="Nome, email, vaga..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <div className="small text-muted mb-1">Status</div>
            <select className="form-select w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="triagem">Triagem</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
            </select>
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
                setQ("");
                setStatus("all");
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
                  const tag = statusTag(c.status);
                  const score = clamp(pickNumber(c.lastMatch?.score, 0), 0, 100);
                  const pass = !!c.lastMatch?.pass;
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
                        <div className="fw-semibold">{c.vagaTitle ?? "—"}</div>
                        <div className="text-muted small mono">{c.vagaCode ?? ""}</div>
                      </td>
                      <td className="nowrap">
                        <span className={`status-tag ${tag.cls}`}>{tag.label}</span>
                      </td>
                      <td className="nowrap">
                        <span className={`status-tag ${pass ? "ok" : ""}`}>
                          <span className="mono">{score}%</span>
                        </span>
                      </td>
                      <td className="text-end nowrap">
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openDetail(c.id)}>
                          Detalhes
                        </button>
                        <button className="btn-ghost px-3 py-2 me-1" type="button" onClick={() => void openEdit(c.id)}>
                          Editar
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--lt-border)" }}>
          <div className="text-muted-foreground text-sm">
            Página <span className="mono">{page}</span> de <span className="mono">{totalPages}</span> • Total{" "}
            <span className="mono">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-2" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹
            </button>
            <button
              className="btn-ghost px-3 py-2"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
            <select className="form-select w-[120px]" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) || 20)}>
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/pág
                </option>
              ))}
            </select>
          </div>
        </div>
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
                </div>
              </div>

              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>

            {!detail ? (
              <div className="text-muted-foreground py-10 text-center">Carregando…</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
                <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="fw-semibold">Currículo (texto)</div>
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => {
                        if (!detail) return;
                        fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(detail.id)}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(detail),
                        })
                          .then(() => toast.success("CV salvo."))
                          .catch(() => toast.error("Falha ao salvar CV."));
                      }}
                    >
                      Salvar CV
                    </button>
                  </div>
                  <textarea
                    className="form-control"
                    rows={10}
                    value={detail.cvText ?? ""}
                    onChange={(e) => setDetail({ ...detail, cvText: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="fw-semibold mb-2">Status / Vaga</div>
                    <div className="grid grid-cols-1 gap-2">
                      <select className="form-select" value={detail.status ?? ""} onChange={(e) => setDetail({ ...detail, status: e.target.value })}>
                        <option value="pendente">Pendente</option>
                        <option value="triagem">Triagem</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="reprovado">Reprovado</option>
                      </select>
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
                      <button className="btn-brand" type="button" onClick={() => void saveMeta()}>
                        Salvar
                      </button>
                    </div>
                  </div>

                  <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                    <div className="fw-semibold mb-2">Documentos</div>
                    <DocumentosBox
                      candidato={detail}
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
                </div>
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
                <select className="form-select" value={pickString(draft.status, "pendente")} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="triagem">Triagem</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
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
                    <input className="form-control" value={pickString(suggested?.[k], "")} readOnly />
                  </div>
                ))}
                <div>
                  <label className="mini-title mb-1 block">Resumo</label>
                  <textarea className="form-control" rows={3} value={pickString(suggested?.resumoProfissional, "")} readOnly />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setSuggestOpen(false)}>
                Cancelar
              </button>
              <button className="btn-brand" type="button" onClick={() => void applySuggestedToCandidate()}>
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
  onUploaded,
  onDeleted,
  uploadDocumento,
  deleteDocumento,
  uploadCvExtrair,
  onSuggested,
}: {
  candidato: Candidato;
  onUploaded: (doc: Documento) => void;
  onDeleted: (docId: string) => void;
  uploadDocumento: (candId: string, tipo: string, descricao: string, file: File) => Promise<Documento>;
  deleteDocumento: (candId: string, docId: string) => Promise<void>;
  uploadCvExtrair: (candId: string, file: File, enviarParaGpt: boolean) => Promise<unknown>;
  onSuggested: (payload: Record<string, unknown>, cvText: string) => void;
}) {
  const [tipo, setTipo] = useState("curriculo");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [enviarParaGpt, setEnviarParaGpt] = useState(true);

  const docs = Array.isArray(candidato.documentos) ? candidato.documentos : [];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="curriculo">Currículo</option>
          <option value="documento">Documento</option>
          <option value="outros">Outros</option>
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
                    {d.tipo ?? "—"} • {d.descricao ?? "Sem descrição"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <a className="btn-ghost px-3 py-2" href={d.url ?? "#"} target="_blank" rel="noreferrer" aria-disabled={!d.url}>
                    Download
                  </a>
                  <button
                    className="btn-ghost px-3 py-2 text-red-600"
                    type="button"
                    onClick={() => {
                      if (!confirm("Excluir documento?")) return;
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

