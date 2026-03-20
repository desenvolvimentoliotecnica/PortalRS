"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { loadAppsHistory, saveAppsHistory, type AppHistoryItem } from "@/features/portalvagas/appsStorage";
import { usePortalVagasLocale } from "@/features/portalvagas/usePortalVagasLocale";
import { t } from "@/features/portalvagas/strings";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Button } from "@/components/ui/button";
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
  const locale = usePortalVagasLocale();
  const s = t(locale).apps;
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
    timeline: [] as Array<{ at: string; label: string; text: string }>,
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
        timeline: Array.isArray(item.timeline) ? [...item.timeline] : [],
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
        timeline: [],
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
      timeline: form.timeline,
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

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Remover candidatura", description: "Remover esta candidatura do histórico?", confirmText: "Remover", destructive: true }))) return;
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

  async function clear() {
    if (!(await confirmDialog({ title: "Limpar histórico", description: "Limpar todo o histórico de candidaturas?", confirmText: "Limpar", destructive: true }))) return;
    saveAppsHistory([]);
    toast.success("Histórico limpo.");
    refresh();
  }

  function downloadAppsSummary() {
    const lines: string[] = [];
    lines.push(s.summaryHeader);
    lines.push(s.summaryGenerated + " " + new Date().toLocaleString(locale === "en-US" ? "en-US" : "pt-BR"));
    lines.push("");
    if (filtered.length === 0) {
      lines.push(s.noApps);
    } else {
      filtered.forEach((a) => {
        lines.push(`- ${a.title || "—"} | ${a.company || "—"} | ${a.location || "—"} | ${a.status || "Aplicado"} | ${a.date || "—"}`);
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const dl = document.createElement("a");
    dl.href = URL.createObjectURL(blob);
    dl.download = locale === "en-US" ? "application-history-liotecnica.txt" : "historico-candidaturas-liotecnica.txt";
    document.body.appendChild(dl);
    dl.click();
    URL.revokeObjectURL(dl.href);
    dl.remove();
    toast.success(s.downloadSuccess);
  }

  function importFromMyApps() {
    const w = typeof window !== "undefined" ? (window as unknown as { myApps?: unknown[] }) : null;
    const arr = w?.myApps;
    if (!Array.isArray(arr) || arr.length === 0) {
      toast.info("Nada para importar. O array myApps não foi encontrado (legado).");
      return;
    }
    const now = new Date().toISOString();
    const existing = loadAppsHistory();
    const existingIds = new Set(existing.map((x) => x.id));
    let added = 0;
    for (const a of arr) {
      const item = a as Record<string, unknown>;
      const title = String(item?.title ?? item?.titulo ?? "").trim();
      const company = String(item?.company ?? item?.empresa ?? "").trim();
      if (!title && !company) continue;
      const id = (item?.id ? String(item.id) : uuid()) as string;
      if (existingIds.has(id)) continue;
      existingIds.add(id);
      existing.push({
        id,
        title: title || "Sem título",
        company,
        location: String(item?.location ?? item?.local ?? "").trim(),
        date: String(item?.date ?? item?.data ?? new Date().toLocaleDateString("pt-BR")),
        status: String(item?.status ?? "Aplicado"),
        link: String(item?.link ?? "").trim(),
        notes: String(item?.notes ?? item?.observacoes ?? "").trim(),
        stages: { applied: true, screen: false, interview: false, test: false, offer: false },
        timeline: Array.isArray(item?.timeline) ? (item.timeline as Array<{ at: string; label: string; text: string }>) : [],
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
    saveAppsHistory(existing);
    toast.success(added > 0 ? `${added} candidatura(s) importada(s).` : "Nenhuma candidatura nova para importar.");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="mini-title">{s.title}</h4>
          <p className="text-muted-foreground text-sm">{s.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={seed}>
            {s.insertExample}
          </Button>
          <Button variant="outline" size="sm" onClick={importFromMyApps}>
            {s.importFromMyApps}
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            {s.newApp}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadAppsSummary}>
            {s.downloadSummary}
          </Button>
          <Button variant="destructive" size="sm" onClick={clear}>
            {s.clear}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="md:col-span-6">
          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder={s.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{s.statusAll}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="new">{s.sortNew}</option>
            <option value="old">{s.sortOld}</option>
            <option value="status">{s.sortStatus}</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{s.noApps}</p>
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
                  {Array.isArray(app.timeline) && app.timeline.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {app.timeline.map((ev, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="font-medium">{ev.at}</span>
                          {ev.label && <span>{ev.label}</span>}
                          {ev.text && <span>— {ev.text}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {app.notes && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{app.notes}</p>}
                  {app.link && (
                    <a className="mt-2 inline-block text-sm text-blue-600 hover:underline" href={app.link} target="_blank" rel="noopener noreferrer">
                      Abrir vaga
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openModal(app)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(app.id)}>
                    Excluir
                  </Button>
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
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Fechar</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Vaga</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Ex.: Analista de Qualidade Jr" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Empresa</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Ex.: Liotécnica" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Local</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Ex.: São Paulo / Remoto" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Ex.: 24/01/2026" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => { const s = e.target.value; setForm((f) => ({ ...f, status: s, stages: stagesFromStatus(s) })); }}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Link da vaga</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="https://..." value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
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
                <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={3} placeholder="Ex.: entrevista marcada para 02/02 às 10:00" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Timeline (eventos)</label>
                <div className="space-y-2 mt-1">
                  {form.timeline.map((ev, i) => (
                    <div key={i} className="flex gap-2 items-center rounded border p-2 bg-white/50">
                      <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm text-xs flex-1" placeholder="Data" value={ev.at} onChange={(e) => setForm((f) => ({ ...f, timeline: f.timeline.map((t, j) => j === i ? { ...t, at: e.target.value } : t) }))} />
                      <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm text-xs flex-1" placeholder="Etapa" value={ev.label} onChange={(e) => setForm((f) => ({ ...f, timeline: f.timeline.map((t, j) => j === i ? { ...t, label: e.target.value } : t) }))} />
                      <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm text-xs flex-1" placeholder="Detalhe" value={ev.text} onChange={(e) => setForm((f) => ({ ...f, timeline: f.timeline.map((t, j) => j === i ? { ...t, text: e.target.value } : t) }))} />
                      <Button variant="destructive" size="sm" onClick={() => setForm((f) => ({ ...f, timeline: f.timeline.filter((_, j) => j !== i) }))}>×</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, timeline: [...f.timeline, { at: new Date().toLocaleDateString("pt-BR"), label: "", text: "" }] }))}>
                    + Adicionar evento
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
