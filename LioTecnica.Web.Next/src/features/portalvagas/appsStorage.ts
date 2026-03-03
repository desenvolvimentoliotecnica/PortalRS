/**
 * Armazenamento local do histórico de candidaturas (MVP).
 * Compartilhado entre PortalVagasAppsSection e PortalVagasScreen (ao enviar candidatura).
 */

const STORAGE_KEY = "liotec_portal_apps_history_v1";

export type AppHistoryItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  status: string;
  link: string;
  notes: string;
  stages: { applied?: boolean; screen?: boolean; interview?: boolean; test?: boolean; offer?: boolean };
  timeline: Array<{ at: string; label: string; text: string }>;
  createdAt: string;
  updatedAt: string;
};

function defaultItem(overrides: Partial<AppHistoryItem>): AppHistoryItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() ?? `x${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    title: "",
    company: "",
    location: "",
    date: new Date().toLocaleDateString("pt-BR"),
    status: "Aplicado",
    link: "",
    notes: "",
    stages: { applied: true, screen: false, interview: false, test: false, offer: false },
    timeline: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function loadAppsHistory(): AppHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const obj = JSON.parse(raw) as { items?: unknown[] };
    const items = Array.isArray(obj?.items) ? obj.items : [];
    return items.filter((x): x is AppHistoryItem => x != null && typeof x === "object" && "id" in x);
  } catch {
    return [];
  }
}

export function saveAppsHistory(items: AppHistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore
  }
}

/** Adiciona uma candidatura ao histórico (ex.: após enviar pelo formulário). */
export function addAppToHistory(app: Partial<AppHistoryItem>) {
  const items = loadAppsHistory();
  const newItem = defaultItem(app);
  saveAppsHistory([...items, newItem]);
}
