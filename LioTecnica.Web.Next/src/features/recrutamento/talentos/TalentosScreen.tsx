"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import PaginationBar from "@/components/pagination/PaginationBar";

const BASE = "/app";

type TalentListItem = {
  id: string;
  nome?: string | null;
  cpf?: string | null;
  email?: string | null;
  fone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string | null;
  cvImportStatus?: string | number | null;
  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
  versao?: number | null;
};

type Paged = { items: TalentListItem[]; totalCount: number; page: number; pageSize: number };
type VagaOption = { id: string; label: string };

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
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapPaged(payload: unknown): Paged {
  const r = asRecord(payload) ?? {};
  const itemsRaw = Array.isArray(r.items) ? (r.items as unknown[]) : [];
  const items: TalentListItem[] = itemsRaw
    .map((x) => {
      const it = asRecord(x);
      if (!it) return null;
      const id = pickString(it.id, "");
      if (!id) return null;
      return {
        id,
        nome: pickString(it.nome, "") || null,
        cpf: pickString(it.cpf, "") || null,
        email: pickString(it.email, "") || null,
        fone: pickString(it.fone, "") || null,
        cidade: pickString(it.cidade, "") || null,
        uf: pickString(it.uf, "") || null,
        origem: pickString(it.origem, "") || null,
        cvImportStatus: it.cvImportStatus ?? null,
        createdAtUtc: pickString(it.createdAtUtc, "") || null,
        updatedAtUtc: pickString(it.updatedAtUtc, "") || null,
        versao: typeof it.versao === "number" ? it.versao : Number.isFinite(Number(it.versao)) ? Number(it.versao) : null,
      };
    })
    .filter(Boolean) as TalentListItem[];
  return {
    items,
    totalCount: pickNumber(r.totalCount, items.length),
    page: Math.max(1, pickNumber(r.page, 1)),
    pageSize: Math.max(1, pickNumber(r.pageSize, 20)),
  };
}

function mapVagaOptions(payload: unknown): VagaOption[] {
  const list = Array.isArray(payload) ? (payload as unknown[]) : Array.isArray(asRecord(payload)?.items) ? ((asRecord(payload)!.items as unknown[]) ?? []) : [];
  return list
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      const titulo = pickString(r.titulo, "");
      const codigo = pickString(r.codigo, "");
      if (!id) return null;
      return { id, label: codigo ? `${titulo} (${codigo})` : titulo };
    })
    .filter(Boolean) as VagaOption[];
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function mapCvImportStatus(status: unknown) {
  const byNumber: Record<number, string> = {
    0: "Pendente",
    1: "Em processamento",
    2: "Pendente de validação",
    3: "Concluído",
  };
  const byString: Record<string, string> = {
    Pendente: "Pendente",
    EmProcessamento: "Em processamento",
    PendenteValidacao: "Pendente de validação",
    Concluido: "Concluído",
  };
  if (typeof status === "number") return byNumber[status] ?? "-";
  const s = pickString(status, "");
  if (!s) return "-";
  return byString[s] ?? byNumber[Number(s)] ?? s;
}

export default function TalentosScreen({
  initialList,
  initialVagas,
}: {
  initialList: unknown;
  initialVagas: unknown;
}) {
  const initialPaged = initialList ? mapPaged(initialList) : { items: [], totalCount: 0, page: 1, pageSize: 20 };

  const [items, setItems] = useState<TalentListItem[]>(initialPaged.items);
  const [totalCount, setTotalCount] = useState(initialPaged.totalCount);
  const [page, setPage] = useState(initialPaged.page);
  const [pageSize, setPageSize] = useState(initialPaged.pageSize);

  const [q, setQ] = useState("");
  const [origem, setOrigem] = useState("");

  const vagas = useMemo(() => mapVagaOptions(initialVagas), [initialVagas]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEnviarGpt, setImportEnviarGpt] = useState(true);

  const [cadCandOpen, setCadCandOpen] = useState(false);
  const [cadCandTalentoId, setCadCandTalentoId] = useState<string>("");
  const [cadCandVagaId, setCadCandVagaId] = useState<string>("");

  async function sync(nextPage = page, nextPageSize = pageSize, nextQ = q, nextOrigem = origem) {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextOrigem) params.set("origem", nextOrigem);
    const data = await fetchJson<unknown>(`${BASE}/Talentos/_api/list?${params.toString()}`);
    const mapped = mapPaged(data);
    setItems(mapped.items);
    setTotalCount(mapped.totalCount);
    setPage(mapped.page);
    setPageSize(mapped.pageSize);
  }

  async function openDetail(id: string) {
    try {
      const data = await fetchJson<unknown>(`${BASE}/Talentos/_api/${encodeURIComponent(id)}`);
      setDetail(asRecord(data));
      setDetailOpen(true);
    } catch {
      toast.error("Falha ao carregar detalhes.");
    }
  }

  async function openEdit(id: string) {
    try {
      const data = await fetchJson<unknown>(`${BASE}/Talentos/_api/${encodeURIComponent(id)}`);
      const r = asRecord(data) ?? {};
      setEditDraft({ ...r });
      setEditOpen(true);
    } catch {
      toast.error("Falha ao abrir edição.");
    }
  }

  function openNew() {
    setEditDraft({ nome: "", email: "", origem: "Manual", fone: "", cidade: "", uf: "" });
    setEditOpen(true);
  }

  async function saveEdit() {
    const id = pickString(editDraft.id, "");
    const url = id ? `${BASE}/Talentos/_api/${encodeURIComponent(id)}` : `${BASE}/Talentos/_api`;
    const method = id ? "PUT" : "POST";
    try {
      await fetchJson(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDraft) });
      toast.success(id ? "Talento atualizado." : "Talento criado.");
      setEditOpen(false);
      await sync(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar talento.");
    }
  }

  async function deleteTalent(id: string, nome?: string | null) {
    if (!confirm(`Eliminar talento "${nome ?? ""}"?`)) return;
    try {
      await fetchJson(`${BASE}/Talentos/_api/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Talento eliminado.");
      await sync(1);
    } catch {
      toast.error("Falha ao eliminar talento.");
    }
  }

  async function importPdf() {
    if (!importFile) return toast.error("Selecione um PDF.");
    const ext = (importFile.name || "").toLowerCase().slice(-4);
    if (ext !== ".pdf") return toast.error("Apenas PDF.");
    const form = new FormData();
    form.append("arquivo", importFile);
    form.append("enviarParaGpt", importEnviarGpt ? "true" : "false");
    try {
      const resp = await fetchJson<unknown>(`${BASE}/Talentos/_api/import-pdf`, { method: "POST", body: form });
      const r = asRecord(resp) ?? {};
      const jobId = pickString(r.jobId, "");
      toast.success(jobId ? `Import iniciado (job ${jobId}).` : "Import concluído.");
      setImportOpen(false);
      setImportFile(null);
      await sync(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar PDF.");
    }
  }

  async function cadastrarCandidato() {
    if (!cadCandTalentoId || !cadCandVagaId) {
      toast.error("Selecione talento e vaga.");
      return;
    }
    try {
      const tal = await fetchJson<unknown>(`${BASE}/Talentos/_api/${encodeURIComponent(cadCandTalentoId)}`);
      const t = asRecord(tal) ?? {};
      const payload = {
        nome: pickString(t.nome, ""),
        email: pickString(t.email, ""),
        fone: pickString(t.fone, "") || null,
        cidade: pickString(t.cidade, "") || null,
        uf: pickString(t.uf, "").toUpperCase().slice(0, 2) || null,
        fonte: "Talentos",
        status: "Triagem",
        vagaId: cadCandVagaId,
        obs: "Criado a partir do Talentos.",
        cvText: pickString(t.cvText, "") || null,
        lastMatch: null,
        documentos: null,
      };
      await fetchJson(`${BASE}/api/candidatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Candidato cadastrado.");
      setCadCandOpen(false);
      setCadCandTalentoId("");
      setCadCandVagaId("");
    } catch {
      toast.error("Falha ao cadastrar candidato.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Talentos</h4>
          <div className="text-muted-foreground text-sm">
            Base de talentos — cadastrar manualmente ou importar PDF.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" type="button" onClick={() => void sync()}>
            Atualizar
          </button>
          <button className="btn-ghost" type="button" onClick={openNew}>
            Novo talento
          </button>
          <button className="btn-ghost" type="button" onClick={() => setImportOpen(true)}>
            Importar PDF
          </button>
          <button className="btn-brand" type="button" onClick={() => setCadCandOpen(true)}>
            Cadastrar candidato
          </button>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div>
            <div className="fw-bold">Lista de talentos</div>
            <div className="text-muted-foreground text-sm">
              Filtre por origem ou busque por nome/email.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[220px]">
              <label className="mini-title mb-1 block">Buscar</label>
              <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nome, email..." />
            </div>
            <div className="min-w-[160px]">
              <label className="mini-title mb-1 block">Origem</label>
              <select className="form-select" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                <option value="">Todas</option>
                <option value="Email">Email</option>
                <option value="Site">Site</option>
                <option value="Candidatura">Candidatura</option>
                <option value="Pasta">Pasta</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => void sync(1, pageSize, q, origem)}
            >
              Aplicar
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Email</th>
                <th>Fone</th>
                <th>Cidade / UF</th>
                <th>Origem</th>
                <th>Status CV</th>
                <th>Criado em</th>
                <th>Atualizado em</th>
                <th>Versão</th>
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.nome ?? "-"}</td>
                    <td className="mono">{t.cpf ?? "-"}</td>
                    <td>{t.email ?? "-"}</td>
                    <td>{t.fone ?? "-"}</td>
                    <td>{[t.cidade, t.uf].filter(Boolean).join(" / ") || "-"}</td>
                    <td>{t.origem ?? "-"}</td>
                    <td>{mapCvImportStatus(t.cvImportStatus)}</td>
                    <td>{formatDate(t.createdAtUtc)}</td>
                    <td>{formatDate(t.updatedAtUtc)}</td>
                    <td className="mono">{t.versao != null ? String(t.versao) : "-"}</td>
                    <td className="text-end nowrap">
                      <button className="btn-ghost px-3 py-2" type="button" onClick={() => { setCadCandOpen(true); setCadCandTalentoId(t.id); }}>
                        Candidato
                      </button>
                      <button className="btn-ghost px-3 py-2" type="button" onClick={() => void openDetail(t.id)}>
                        Detalhes
                      </button>
                      <button className="btn-ghost px-3 py-2" type="button" onClick={() => void openEdit(t.id)}>
                        Editar
                      </button>
                      <button className="btn-ghost px-3 py-2 text-red-700" type="button" onClick={() => void deleteTalent(t.id, t.nome)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="text-center text-muted py-4">
                    Nenhum talento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={(p) => void sync(p, pageSize, q, origem)}
          onPageSizeChange={(s) => void sync(1, s || 20, q, origem)}
        />
      </div>

      {detailOpen && detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-4xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Detalhes</p>
                <div className="text-lg font-extrabold">{pickString(detail.nome, "-")}</div>
                <div className="text-muted-foreground text-sm">{pickString(detail.email, "")}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {["cpf", "fone", "cidade", "uf", "origem"].map((k) => (
                <div key={k} className="card-soft p-3" style={{ boxShadow: "none" }}>
                  <div className="mini-title mb-1">{k.toUpperCase()}</div>
                  <div className="font-semibold">{pickString(detail[k], "-")}</div>
                </div>
              ))}
              <div className="card-soft p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Resumo</div>
                <div className="text-muted-foreground whitespace-pre-wrap text-sm">
                  {pickString(detail.resumoProfissional, "-")}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setDetailOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">{pickString(editDraft.id, "") ? "Editar talento" : "Novo talento"}</p>
                <div className="text-lg font-extrabold">Cadastro</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setEditOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Nome</label>
                <input className="form-control" value={pickString(editDraft.nome, "")} onChange={(e) => setEditDraft({ ...editDraft, nome: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Email</label>
                <input className="form-control" value={pickString(editDraft.email, "")} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Fone</label>
                <input className="form-control" value={pickString(editDraft.fone, "")} onChange={(e) => setEditDraft({ ...editDraft, fone: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Cidade</label>
                <input className="form-control" value={pickString(editDraft.cidade, "")} onChange={(e) => setEditDraft({ ...editDraft, cidade: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">UF</label>
                <input className="form-control" value={pickString(editDraft.uf, "")} onChange={(e) => setEditDraft({ ...editDraft, uf: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mini-title mb-1 block">Origem</label>
                <select className="form-select" value={pickString(editDraft.origem, "Manual")} onChange={(e) => setEditDraft({ ...editDraft, origem: e.target.value })}>
                  <option value="Manual">Manual</option>
                  <option value="Email">Email</option>
                  <option value="Site">Site</option>
                  <option value="Candidatura">Candidatura</option>
                  <option value="Pasta">Pasta</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button className="btn-brand" type="button" onClick={() => void saveEdit()}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Importar currículo</p>
                <div className="text-lg font-extrabold">PDF</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setImportOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input className="form-control" type="file" accept="application/pdf" onChange={(e) => setImportFile(e.currentTarget.files?.[0] ?? null)} />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={importEnviarGpt} onChange={(e) => setImportEnviarGpt(e.target.checked)} />
                Enviar ao GPT para extrair dados
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setImportOpen(false)}>
                Cancelar
              </button>
              <button className="btn-brand" type="button" onClick={() => void importPdf()}>
                Importar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cadCandOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="mini-title mb-1">Cadastrar candidato</p>
                <div className="text-lg font-extrabold">Talento → Vaga</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setCadCandOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mini-title mb-1 block">Talento</label>
                <select className="form-select" value={cadCandTalentoId} onChange={(e) => setCadCandTalentoId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome ?? "-"} {t.email ? `• ${t.email}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mini-title mb-1 block">Vaga</label>
                <select className="form-select" value={cadCandVagaId} onChange={(e) => setCadCandVagaId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setCadCandOpen(false)}>
                Cancelar
              </button>
              <button className="btn-brand" type="button" onClick={() => void cadastrarCandidato()}>
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

