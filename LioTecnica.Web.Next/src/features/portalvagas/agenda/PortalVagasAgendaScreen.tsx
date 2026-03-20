"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Button } from "@/components/ui/button";

type AgendaPreferences = {
  interviewMode: string;
  startDate: string;
  notice: string;
  notes: string;
  days: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean };
  times: { morning: boolean; afternoon: boolean; evening: boolean };
  preferredHours: string;
  timezone: string;
};

type AgendaBlock = {
  id: string;
  type: string;
  title: string;
  date: string;
  hours: string;
  notes: string;
  updatedAtUtc: string;
};

type AgendaModel = {
  preferences: AgendaPreferences;
  blocks: AgendaBlock[];
  updatedAt: string;
};

const BASE = "/app";
const STORAGE_KEY = "liotec_portal_agenda_v1";
const STORAGE_ENABLED = process.env.NEXT_PUBLIC_PORTALVAGAS_STORAGE === "1";

function nowIso() {
  return new Date().toISOString();
}

function defaultModel(): AgendaModel {
  return {
    preferences: {
      interviewMode: "",
      startDate: "",
      notice: "",
      notes: "",
      days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
      times: { morning: false, afternoon: false, evening: false },
      preferredHours: "",
      timezone: "America/Sao_Paulo",
    },
    blocks: [],
    updatedAt: nowIso(),
  };
}

function loadFromStorage(): AgendaModel | null {
  if (!STORAGE_ENABLED) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AgendaModel;
  } catch {
    return null;
  }
}

function saveToStorage(model: AgendaModel) {
  if (!STORAGE_ENABLED) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // ignore
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const status = res.status;
  if (status === 204) return { ok: true, status, data: null };
  const data = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status, data };
}

function mapAgendaResponse(payload: any): AgendaModel {
  const m = defaultModel();
  const prefs = payload?.preferences ?? {};
  m.preferences = {
    interviewMode: String(prefs?.formatoEntrevista ?? ""),
    startDate: String(prefs?.inicioDisponivel ?? ""),
    notice: String(prefs?.avisoPrevio ?? ""),
    notes: String(prefs?.observacoes ?? ""),
    days: {
      mon: !!prefs?.diaSeg,
      tue: !!prefs?.diaTer,
      wed: !!prefs?.diaQua,
      thu: !!prefs?.diaQui,
      fri: !!prefs?.diaSex,
      sat: !!prefs?.diaSab,
      sun: !!prefs?.diaDom,
    },
    times: {
      morning: !!prefs?.periodoManha,
      afternoon: !!prefs?.periodoTarde,
      evening: !!prefs?.periodoNoite,
    },
    preferredHours: String(prefs?.horarioPreferido ?? ""),
    timezone: String(prefs?.fusoHorario ?? "") || "America/Sao_Paulo",
  };
  m.blocks = Array.isArray(payload?.blocks)
    ? payload.blocks.map((b: any) => ({
        id: String(b?.id ?? ""),
        type: String(b?.tipo ?? ""),
        title: String(b?.titulo ?? ""),
        date: String(b?.data ?? ""),
        hours: String(b?.horario ?? ""),
        notes: String(b?.observacoes ?? ""),
        updatedAtUtc: String(b?.updatedAtUtc ?? nowIso()),
      }))
    : [];
  m.updatedAt = String(prefs?.updatedAtUtc ?? nowIso());
  return m;
}

export default function PortalVagasAgendaScreen() {
  const [model, setModel] = useState<AgendaModel>(() => defaultModel());
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  const [blocksSearch, setBlocksSearch] = useState("");
  const [blocksSort, setBlocksSort] = useState<"new" | "old" | "date">("new");
  const [blocksTypeFilter, setBlocksTypeFilter] = useState("");

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<{ id: string; type: string; title: string; date: string; hours: string; notes: string }>(() => ({
    id: "",
    type: "Compromisso",
    title: "",
    date: "",
    hours: "",
    notes: "",
  }));

  const saveTimer = useRef<number | null>(null);

  const hydrate = useCallback(() => {
    if (!STORAGE_ENABLED) return;
    const stored = loadFromStorage() ?? defaultModel();
    setModel(stored);
    saveToStorage(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (STORAGE_ENABLED) {
      hydrate();
      return;
    }

    let alive = true;
    fetchJson<any>(`${BASE}/PortalVagas/Agenda`, { method: "GET" })
      .then(({ ok, status, data }) => {
        if (!alive) return;
        if (!ok) {
          if (status === 401 || status === 403) {
            setAuthRequired(true);
            setLoading(false);
            return;
          }
          toast.error("Falha ao carregar agenda.");
          setLoading(false);
          return;
        }
        setAuthRequired(false);
        const mapped = mapAgendaResponse(data);
        setModel(mapped);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        toast.error("Falha ao carregar agenda.");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [hydrate]);

  const blocks = useMemo(() => {
    let list = Array.isArray(model.blocks) ? [...model.blocks] : [];
    const search = blocksSearch.trim().toLowerCase();
    const typeFilter = blocksTypeFilter.trim();

    if (typeFilter) list = list.filter((b) => (b.type || "") === typeFilter);
    if (search) {
      list = list.filter((b) => {
        const blob = `${b.title || ""} ${b.date || ""} ${b.type || ""} ${b.hours || ""}`.toLowerCase();
        return blob.includes(search);
      });
    }

    if (blocksSort === "new") list.sort((a, b) => String(b.updatedAtUtc || "").localeCompare(String(a.updatedAtUtc || "")));
    if (blocksSort === "old") list.sort((a, b) => String(a.updatedAtUtc || "").localeCompare(String(b.updatedAtUtc || "")));
    if (blocksSort === "date") list.sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""), "pt-BR"));
    return list;
  }, [blocksSearch, blocksSort, blocksTypeFilter, model.blocks]);

  const setPreferences = useCallback((patch: Partial<AgendaPreferences>) => {
    setModel((m) => {
      const next: AgendaModel = { ...m, preferences: { ...m.preferences, ...patch }, updatedAt: nowIso() };
      if (STORAGE_ENABLED) saveToStorage(next);
      return next;
    });
  }, []);

  const persistPreferences = useCallback(
    async (prefs: AgendaPreferences) => {
      if (STORAGE_ENABLED) return;
      const body = {
        formatoEntrevista: prefs.interviewMode || "",
        inicioDisponivel: prefs.startDate || "",
        avisoPrevio: prefs.notice || "",
        observacoes: prefs.notes || "",
        diaSeg: !!prefs.days.mon,
        diaTer: !!prefs.days.tue,
        diaQua: !!prefs.days.wed,
        diaQui: !!prefs.days.thu,
        diaSex: !!prefs.days.fri,
        diaSab: !!prefs.days.sat,
        diaDom: !!prefs.days.sun,
        periodoManha: !!prefs.times.morning,
        periodoTarde: !!prefs.times.afternoon,
        periodoNoite: !!prefs.times.evening,
        horarioPreferido: prefs.preferredHours || "",
        fusoHorario: prefs.timezone || "",
      };
      const { ok } = await fetchJson<any>(`${BASE}/PortalVagas/Agenda`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!ok) throw new Error("save_failed");
    },
    [],
  );

  const savePreferencesDebounced = useCallback(
    (nextPrefs: AgendaPreferences) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void persistPreferences(nextPrefs).catch(() => toast.error("Falha ao salvar agenda."));
      }, 250);
    },
    [persistPreferences],
  );

  function openBlockModal(id?: string) {
    const existing = id ? model.blocks.find((b) => b.id === id) : null;
    setBlockForm({
      id: existing?.id || "",
      type: existing?.type || "Compromisso",
      title: existing?.title || "",
      date: existing?.date || "",
      hours: existing?.hours || "",
      notes: existing?.notes || "",
    });
    setBlockModalOpen(true);
  }

  async function saveBlock() {
    const title = blockForm.title.trim();
    const date = blockForm.date.trim();
    if (!title || !date) {
      toast.error("Informe Título e Data.");
      return;
    }

    if (STORAGE_ENABLED) {
      setModel((m) => {
        const id = blockForm.id || crypto.randomUUID();
        const updatedAtUtc = nowIso();
        const saved: AgendaBlock = {
          id,
          type: blockForm.type.trim() || "Outro",
          title,
          date,
          hours: blockForm.hours.trim(),
          notes: blockForm.notes.trim(),
          updatedAtUtc,
        };
        const blocks = [...(m.blocks || [])];
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx >= 0) blocks[idx] = saved;
        else blocks.push(saved);
        const next = { ...m, blocks, updatedAt: updatedAtUtc };
        saveToStorage(next);
        return next;
      });
      setBlockModalOpen(false);
      toast.success("Bloqueio salvo.");
      return;
    }

    const isUpdate = !!blockForm.id;
    const url = isUpdate
      ? `${BASE}/PortalVagas/Agenda/Blocks/${encodeURIComponent(blockForm.id)}`
      : `${BASE}/PortalVagas/Agenda/Blocks`;
    const method = isUpdate ? "PUT" : "POST";
    const body = {
      tipo: blockForm.type.trim() || "Outro",
      titulo: title,
      data: date,
      horario: blockForm.hours.trim(),
      observacoes: blockForm.notes.trim(),
    };

    const { ok, data } = await fetchJson<any>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!ok || !data?.id) {
      toast.error("Falha ao salvar bloqueio.");
      return;
    }

    setModel((m) => {
      const blocks = [...(m.blocks || [])];
      const saved: AgendaBlock = {
        id: String(data.id),
        type: String(data.tipo ?? body.tipo),
        title: String(data.titulo ?? body.titulo),
        date: String(data.data ?? body.data),
        hours: String(data.horario ?? body.horario),
        notes: String(data.observacoes ?? body.observacoes),
        updatedAtUtc: String(data.updatedAtUtc ?? nowIso()),
      };
      const idx = blocks.findIndex((b) => b.id === saved.id);
      if (idx >= 0) blocks[idx] = saved;
      else blocks.push(saved);
      return { ...m, blocks, updatedAt: nowIso() };
    });

    setBlockModalOpen(false);
    toast.success("Bloqueio salvo.");
  }

  async function deleteBlock(id: string) {
    if (!(await confirmDialog({ title: "Remover bloqueio", description: "Remover este bloqueio?", confirmText: "Remover", destructive: true }))) return;
    if (STORAGE_ENABLED) {
      setModel((m) => {
        const next = { ...m, blocks: (m.blocks || []).filter((b) => b.id !== id), updatedAt: nowIso() };
        saveToStorage(next);
        return next;
      });
      toast.success("Bloqueio removido.");
      return;
    }

    const { ok } = await fetchJson(`${BASE}/PortalVagas/Agenda/Blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!ok) {
      toast.error("Falha ao remover bloqueio.");
      return;
    }
    setModel((m) => ({ ...m, blocks: (m.blocks || []).filter((b) => b.id !== id), updatedAt: nowIso() }));
    toast.success("Bloqueio removido.");
  }

  async function resetAgenda() {
    if (!(await confirmDialog({ title: "Limpar agenda", description: "Limpar esta aba?", confirmText: "Limpar", destructive: true }))) return;
    if (STORAGE_ENABLED) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      const d = defaultModel();
      saveToStorage(d);
      setModel(d);
      toast.success("Aba limpa.");
      return;
    }

    // Remove blocks first.
    for (const b of model.blocks || []) {
      await fetchJson(`${BASE}/PortalVagas/Agenda/Blocks/${encodeURIComponent(b.id)}`, { method: "DELETE" }).catch(() => null);
    }
    // Reset preferences.
    await persistPreferences(defaultModel().preferences).catch(() => null);
    // Reload.
    const { ok, data } = await fetchJson<any>(`${BASE}/PortalVagas/Agenda`, { method: "GET" });
    if (ok) setModel(mapAgendaResponse(data));
    toast.success("Aba limpa.");
  }

  const prefs = model.preferences;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-extrabold">Disponibilidade &amp; Agenda</div>
          <div className="text-muted-foreground text-sm">
            Configure seus melhores horários para entrevistas e seus bloqueios.
            {STORAGE_ENABLED ? " (MVP: salvo neste navegador)" : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled>
            Voltar às seções
          </Button>
          <Button variant="outline" size="sm" className="hidden" disabled>
            Inserir exemplo
          </Button>
          <Button variant="outline" size="sm" className="hidden" disabled>
            Baixar resumo
          </Button>
          <Button variant="outline" size="sm" onClick={() => void resetAgenda()}>
            Limpar
          </Button>
        </div>
      </div>

      {!STORAGE_ENABLED && authRequired ? (
        <div className="card-soft p-4">
          <div className="font-bold">Você precisa entrar para editar sua agenda.</div>
          <div className="text-muted-foreground mt-1 text-sm">
            Abra o Portal Vagas legado para autenticar e depois volte aqui.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a href="/PortalVagas" target="_blank" rel="noopener">Abrir Portal Vagas</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Voltar ao app</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="card-soft p-4">
        <div className="font-extrabold mb-2">Preferências gerais</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mini-title mb-1 block">Formato preferido de entrevista</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={prefs.interviewMode}
              onChange={(e) => {
                const next = { ...prefs, interviewMode: e.target.value };
                setPreferences({ interviewMode: next.interviewMode });
                void persistPreferences(next).catch(() => toast.error("Falha ao salvar agenda."));
              }}
              disabled={loading}
            >
              <option value="">Selecionar</option>
              <option value="Online">Online</option>
              <option value="Presencial">Presencial</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Indiferente">Indiferente</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="mini-title mb-1 block">Data de início disponível</label>
            <input
              className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={prefs.startDate}
              placeholder="Ex.: Imediato / 10/02/2026"
              onChange={(e) => {
                const next = { ...prefs, startDate: e.target.value };
                setPreferences({ startDate: next.startDate });
                savePreferencesDebounced(next);
              }}
              disabled={loading}
            />
          </div>

          <div className="md:col-span-4">
            <label className="mini-title mb-1 block">Aviso prévio (se aplicável)</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={prefs.notice}
              onChange={(e) => {
                const next = { ...prefs, notice: e.target.value };
                setPreferences({ notice: next.notice });
                void persistPreferences(next).catch(() => toast.error("Falha ao salvar agenda."));
              }}
              disabled={loading}
            >
              <option value="">Selecionar</option>
              <option value="Sem aviso">Sem aviso</option>
              <option value="7 dias">7 dias</option>
              <option value="15 dias">15 dias</option>
              <option value="30 dias">30 dias</option>
              <option value="A combinar">A combinar</option>
            </select>
          </div>

          <div className="md:col-span-12">
            <label className="mini-title mb-1 block">Observações (opcional)</label>
            <input
              className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={prefs.notes}
              placeholder="Ex.: prefiro entrevistas entre 9h e 11h, com confirmação por WhatsApp"
              onChange={(e) => {
                const next = { ...prefs, notes: e.target.value };
                setPreferences({ notes: next.notes });
                savePreferencesDebounced(next);
              }}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="card-soft p-4">
        <div className="font-extrabold mb-2">Dias preferidos</div>
        <div className="text-muted-foreground text-sm mb-3">Selecione os dias em que você costuma estar disponível.</div>

        <div className="flex flex-wrap gap-3">
          {[
            ["Seg", "mon"],
            ["Ter", "tue"],
            ["Qua", "wed"],
            ["Qui", "thu"],
            ["Sex", "fri"],
            ["Sáb", "sat"],
            ["Dom", "sun"],
          ].map(([label, key]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={(prefs.days as any)[key]}
                onChange={(e) => {
                  const days = { ...prefs.days, [key]: e.target.checked } as AgendaPreferences["days"];
                  const next = { ...prefs, days };
                  setPreferences({ days });
                  void persistPreferences(next).catch(() => toast.error("Falha ao salvar agenda."));
                }}
                disabled={loading}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <hr className="my-4" />

        <div className="font-extrabold mb-2">Períodos do dia</div>
        <div className="flex flex-wrap gap-3">
          {[
            ["Manhã", "morning"],
            ["Tarde", "afternoon"],
            ["Noite", "evening"],
          ].map(([label, key]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={(prefs.times as any)[key]}
                onChange={(e) => {
                  const times = { ...prefs.times, [key]: e.target.checked } as AgendaPreferences["times"];
                  const next = { ...prefs, times };
                  setPreferences({ times });
                  void persistPreferences(next).catch(() => toast.error("Falha ao salvar agenda."));
                }}
                disabled={loading}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 mt-4">
          <div className="md:col-span-6">
            <label className="mini-title mb-1 block">Horário preferido (opcional)</label>
            <input
              className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={prefs.preferredHours}
              placeholder="Ex.: 09:00–11:00"
              onChange={(e) => {
                const next = { ...prefs, preferredHours: e.target.value };
                setPreferences({ preferredHours: next.preferredHours });
                savePreferencesDebounced(next);
              }}
              disabled={loading}
            />
          </div>
          <div className="md:col-span-6">
            <label className="mini-title mb-1 block">Fuso horário</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={prefs.timezone}
              onChange={(e) => {
                const next = { ...prefs, timezone: e.target.value };
                setPreferences({ timezone: next.timezone });
                void persistPreferences(next).catch(() => toast.error("Falha ao salvar agenda."));
              }}
              disabled={loading}
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (Brasília)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/Lisbon">Europe/Lisbon</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-extrabold">Bloqueios (indisponibilidades)</div>
            <div className="text-muted-foreground text-sm">Use para datas/horários em que você não pode fazer entrevista.</div>
          </div>
          <Button size="sm" onClick={() => openBlockModal()}>
            Adicionar bloqueio
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-12 mt-3">
          <div className="md:col-span-6">
            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="Buscar bloqueio..." value={blocksSearch} onChange={(e) => setBlocksSearch(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={blocksSort} onChange={(e) => setBlocksSort(e.target.value as any)}>
              <option value="new">Mais recentes</option>
              <option value="old">Mais antigos</option>
              <option value="date">Por data (asc)</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={blocksTypeFilter} onChange={(e) => setBlocksTypeFilter(e.target.value)}>
              <option value="">Tipo (todos)</option>
              <option value="Entrevista">Entrevista</option>
              <option value="Compromisso">Compromisso</option>
              <option value="Viagem">Viagem</option>
              <option value="Saúde">Saúde</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {blocks.length ? (
            blocks.map((b) => (
              <div key={b.id} className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-extrabold truncate">{b.title}</div>
                      <span className="badge-soft text-xs">{b.type || "Outro"}</span>
                    </div>
                    <div className="text-muted-foreground text-sm mt-1">
                      {b.date || "—"} {b.hours ? <span className="ml-2">{b.hours}</span> : null}
                    </div>
                    {b.notes ? <div className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">{b.notes}</div> : null}
                    <div className="text-muted-foreground text-xs mt-2">Atualizado: {new Date(b.updatedAtUtc).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openBlockModal(b.id)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void deleteBlock(b.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-sm py-6 text-center">Nenhum bloqueio cadastrado.</div>
          )}
        </div>
      </div>

      {blockModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Bloqueio</div>
                <div className="text-lg font-extrabold">{blockForm.id ? "Editar" : "Adicionar"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setBlockModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Tipo</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={blockForm.type} onChange={(e) => setBlockForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="Compromisso">Compromisso</option>
                  <option value="Entrevista">Entrevista</option>
                  <option value="Viagem">Viagem</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="md:col-span-8">
                <label className="mini-title mb-1 block">Título</label>
                <input
                  className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={blockForm.title}
                  placeholder="Ex.: consulta médica / prova / viagem"
                  onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Data</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockForm.date} placeholder="Ex.: 28/01/2026" onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))} />
              </div>

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Horário (opcional)</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockForm.hours} placeholder="Ex.: 14:00–16:00" onChange={(e) => setBlockForm((f) => ({ ...f, hours: e.target.value }))} />
              </div>

              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Observações (opcional)</label>
                <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={3} value={blockForm.notes} placeholder="Ex.: sem disponibilidade neste período" onChange={(e) => setBlockForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBlockModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => void saveBlock()}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

