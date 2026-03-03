"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { loadAppsHistory, saveAppsHistory, type AppHistoryItem } from "@/features/portalvagas/appsStorage";
const STATUS_OPTIONS = ["Aplicado", "Triagem", "Entrevista", "Teste", "Proposta", "Aprovado", "Reprovado", "Desistiu"] as const;
const STATUS_COLORS: Record<string, string> = {
  Aprovado: "bg-green-600 text-white",
  Reprovado: "bg-red-600 text-white",
  Entrevista: "bg-blue-600 text-white",
  Teste: "bg-amber-500 text-black",
  Proposta: "bg-cyan-600 text-white",
  Triagem: "bg-slate-500 text-white",
  Desistiu: "bg-slate-800 text-white",
  Aplicado: "bg-slate-400 text-white",
};

function uuid() {
  return crypto.randomUUID?.() ?? `x${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function PortalVagasAppsSection() {
  const [items, setItems] = useState<AppHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "status">("new");
  const [editing, setEditing] = useState<AppHistoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    date: "",
    status: "Aplicado",
    link: "",
    notes: "",
    stages: { applied: true, screen: false, interview: false, test: false, offer: false },
  });

  const refresh = useCallback(() => {
    setItems(loadAppsHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = items
    .filter((x) => {
      if (statusFilter && (x.status || "") !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (x.title || "").toLowerCase().includes(q) ||
          (x.company || "").toLowerCase().includes(q) ||
          (x.location || "").toLowerCase().includes(q) ||
          (x.date || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "new") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      if (sort === "old") return (a.updatedAt || "").localeCompare(b.updatedAt || "");
      const order = (s: string) => ({ Aplicado: 1, Triagem: 2, Entrevista: 3, Teste: 4, Proposta: 5, Aprovado: 6, Reprovado: 7, Desistiu: 8 }[s] ?? 99);
      return order(a.status || "") - order(b.status || "");
    });

  function openModal(item?: AppHistoryItem) {
    if (item) {
      setEditing(item);
      setForm({
        title: item.title || "",
        company: item.company || "",
        location: item.location || "",
        date: item.date || "",
        status: item.status || "Aplicado",
        link: item.link || "",
        notes: item.notes || "",
        stages: { ...{ applied: false, screen: false, interview: false, test: false, offer: false }, ...item.stages },
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        company: "",
        location: "",
        date: "",
        status: "Aplicado",
        link: "",
        notes: "",
        stages: { applied: true, screen: false, interview: false, test: false, offer: false },
      });
    }
    setModalOpen(true);
  }

  function stagesFromStatus(status: string) {
    const idx = ["Aplicado", "Triagem", "Entrevista", "Teste", "Proposta", "Aprovado"].indexOf(status);
    const n = idx >= 0 ? Math.min(idx, 4) : 0;
    return {
      applied: n >= 0,
      screen: n >= 1,
      interview: n >= 2,
      test: n >= 3,
      offer: n >= 4,
    };
  }

  function save() {
    const now = new Date().toISOString();
    const h = loadAppsHistory();
    const payload: AppHistoryItem = {
      id: editing?.id ?? uuid(),
      title: form.title.trim() || "Sem título",
      company: form.company.trim(),
      location: form.location.trim(),
      date: form.date.trim(),
      status: form.status,
      link: form.link.trim(),
      notes: form.notes.trim(),
      stages: form.stages,
      timeline: editing?.timeline ?? [],
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    const idx = h.findIndex((x) => x.id === payload.id);
    const newItems = idx >= 0 ? [...h] : [...h, payload];
    if (idx >= 0) newItems[idx] = payload;
    saveAppsHistory(newItems);
    toast.success("Candidatura salva.");
    setModalOpen(false);
    refresh();
  }

  function remove(id: string) {
    if (!confirm("Remover esta candidatura do histórico?")) return;
    const h = loadAppsHistory();
    saveAppsHistory(h.filter((x) => x.id !== id));
    toast.success("Removido.");
    refresh();
  }

  function seed() {
    const now = new Date().toISOString();
    const examples: AppHistoryItem[] = [
      { id: uuid(), title: "Analista de Qualidade Jr", company: "Tech Corp", location: "São Paulo / Remoto", date: "15/02/2026", status: "Entrevista", link: "", notes: "Entrevista agendada para 20/02", stages: { applied: true, screen: true, interview: true, test: false, offer: false }, timeline: [], createdAt: now, updatedAt: now },
      { id: uuid(), title: "Desenvolvedor Full Stack", company: "Startup XYZ", location: "Remoto", date: "10/02/2026", status: "Triagem", link: "", notes: "", stages: { applied: true, screen: true, interview: false, test: false, offer: false }, timeline: [], createdAt: now, updatedAt: now },
    ];
    const h = loadAppsHistory();
    saveAppsHistory([...h, ...examples]);
    toast.success("Exemplos adicionados.");
    refresh();
  }

  function clear() {
    if (!confirm("Limpar todo o histórico de candidaturas?")) return;
    saveAppsHistory([]);
    toast.success("Histórico limpo.");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mini-title">Histórico de Candidaturas & Etapas</h4>
          <p className="text-muted-foreground text-sm">Acompanhe suas candidaturas (MVP: salvo neste navegador).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-sm" type="button" onClick={seed}>
            Inserir exemplo
          </button>
          <button className="btn-brand text-sm" type="button" onClick={() => openModal()}>
            Nova candidatura
          </button>
          <button className="btn-ghost text-sm text-red-600" type="button" onClick={clear}>
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="md:col-span-6">
          <input className="form-control" placeholder="Buscar por vaga, empresa, local..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status (todos)</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="new">Mais recentes</option>
            <option value="old">Mais antigas</option>
            <option value="status">Por status</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Nenhuma candidatura cadastrada.</p>
        ) : (
          filtered.map((app) => (
            <div key={app.id} className="rounded-xl border border-border/60 bg-white/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{app.title || "Sem título"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-slate-400 text-white"}`}>
                      {app.status || "Aplicado"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {app.company && <span>{app.company}</span>}
                    {app.location && <span>{app.location}</span>}
                    {app.date && <span>{app.date}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["applied", "screen", "interview", "test", "offer"].map((k, i) => {
                      const labels = ["Aplicado", "Triagem", "Entrevista", "Teste", "Proposta"];
                      const ok = (app.stages as Record<string, boolean>)?.[k];
                      return (
                        <span key={k} className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"}`}>
                          {labels[i]}
                        </span>
                      );
                    })}
                  </div>
                  {app.notes && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{app.notes}</p>}
                  {app.link && (
                    <a className="mt-2 inline-block text-sm text-blue-600 hover:underline" href={app.link} target="_blank" rel="noopener noreferrer">
                      Abrir vaga
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn-ghost px-2 py-1 text-sm" type="button" onClick={() => openModal(app)}>
                    Editar
                  </button>
                  <button className="btn-ghost px-2 py-1 text-sm text-red-600" type="button" onClick={() => remove(app.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Candidatura</h4>
              <button className="btn-ghost" type="button" onClick={() => setModalOpen(false)}>Fechar</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Vaga</label>
                <input className="form-control" placeholder="Ex.: Analista de Qualidade Jr" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Empresa</label>
                <input className="form-control" placeholder="Ex.: Liotécnica" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Local</label>
                <input className="form-control" placeholder="Ex.: São Paulo / Remoto" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data</label>
                <input className="form-control" placeholder="Ex.: 24/01/2026" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select className="form-select" value={form.status} onChange={(e) => { const s = e.target.value; setForm((f) => ({ ...f, status: s, stages: stagesFromStatus(s) })); }}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Link da vaga</label>
                <input className="form-control" placeholder="https://..." value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Etapas (pipeline)</label>
                <div className="flex flex-wrap gap-4 mt-1">
                  {(["applied", "screen", "interview", "test", "offer"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.stages[k]} onChange={(e) => setForm((f) => ({ ...f, stages: { ...f.stages, [k]: e.target.checked } }))} />
                      <span className="text-sm">{{ applied: "Aplicado", screen: "Triagem", interview: "Entrevista", test: "Teste", offer: "Proposta" }[k]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Notas / feedback</label>
                <textarea className="form-control" rows={3} placeholder="Ex.: entrevista marcada para 02/02 às 10:00" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-brand" type="button" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
