/**
 * Shared urgency / SLA helpers — used across VagasScreen and WorkflowRHScreen.
 *
 * Supports both numeric keys (WorkflowRH / FilaRhItem) and string keys
 * (SolicitacoesScreen), so every screen speaks the same visual language.
 */

export type UrgenciaLevel = number | string | null | undefined;
export type SlaStatus = "ok" | "warning" | "overdue";
export type AgingBucket = "" | "0-3" | "4-7" | "8-15" | "15+";

interface UrgenciaMeta {
  label: string;
  /** Full badge classes (background + text) */
  badge: string;
  /** Text-only color class — for compact inline labels */
  text: string;
}

/** Unified urgency meta — numeric AND string keys resolved uniformly */
export const URGENCIA_MAP: Record<string, UrgenciaMeta> = {
  0:       { label: "Baixa",   badge: "bg-sky-500/15 text-sky-700",        text: "text-zinc-500"            },
  1:       { label: "Média",   badge: "bg-amber-500/15 text-amber-700",    text: "text-amber-600"           },
  2:       { label: "Alta",    badge: "bg-orange-500/15 text-orange-700",  text: "text-orange-600"          },
  3:       { label: "Crítica", badge: "bg-red-500/15 text-red-700",        text: "text-red-600 font-semibold" },
  Baixa:   { label: "Baixa",   badge: "bg-sky-500/15 text-sky-700",        text: "text-zinc-500"            },
  Media:   { label: "Média",   badge: "bg-amber-500/15 text-amber-700",    text: "text-amber-600"           },
  Alta:    { label: "Alta",    badge: "bg-orange-500/15 text-orange-700",  text: "text-orange-600"          },
  Critica: { label: "Crítica", badge: "bg-red-500/15 text-red-700",        text: "text-red-600 font-semibold" },
};

/** Returns the urgency meta for a given level (defaults to Média). */
export function urgenciaMeta(level: UrgenciaLevel): UrgenciaMeta {
  const key = String(level ?? 1);
  return URGENCIA_MAP[key] ?? URGENCIA_MAP["1"];
}

/** Returns number of full days elapsed since an ISO date string. */
export function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Derives an SLA traffic-light status.
 * - "overdue"  → SLA já venceu
 * - "warning"  → faltam ≤ 2 dias
 * - "ok"       → dentro do prazo
 */
export function slaStatus(
  slaPrazoDias: number | null | undefined,
  slaExcedido: boolean,
): SlaStatus {
  if (slaExcedido) return "overdue";
  if (slaPrazoDias != null && slaPrazoDias <= 2) return "warning";
  return "ok";
}

/**
 * Returns whether an item falls inside the given aging bucket
 * based on its creation/update date.
 *
 * @param isoDate  ISO date string of the item
 * @param bucket   "" = no filter, otherwise a range string
 */
export function matchesAgingBucket(isoDate: string | null | undefined, bucket: AgingBucket): boolean {
  if (!bucket || !isoDate) return true;
  const days = daysSince(isoDate);
  switch (bucket) {
    case "0-3":  return days <= 3;
    case "4-7":  return days >= 4 && days <= 7;
    case "8-15": return days >= 8 && days <= 15;
    case "15+":  return days > 15;
    default:     return true;
  }
}

/** Labels for aging bucket chips */
export const AGING_BUCKETS: { value: AgingBucket; label: string }[] = [
  { value: "0-3",  label: "0–3d"  },
  { value: "4-7",  label: "4–7d"  },
  { value: "8-15", label: "8–15d" },
  { value: "15+",  label: "+15d"  },
];
