"use client";

export type FitIaNivel = "baixo" | "parcial" | "adequado" | "bom" | "excelente";

const NIVEIS: {
  code: FitIaNivel;
  label: string;
  activeClass: string;
  idleClass: string;
}[] = [
  { code: "baixo", label: "Baixo fit", activeClass: "bg-sky-500 text-white ring-sky-600/40", idleClass: "bg-sky-100 text-sky-800/50" },
  { code: "parcial", label: "Fit parcial", activeClass: "bg-cyan-500 text-white ring-cyan-600/40", idleClass: "bg-cyan-100 text-cyan-900/40" },
  { code: "adequado", label: "Adequado", activeClass: "bg-emerald-500 text-white ring-emerald-700/30", idleClass: "bg-emerald-100 text-emerald-900/40" },
  { code: "bom", label: "Bom fit", activeClass: "bg-amber-500 text-white ring-amber-600/40", idleClass: "bg-amber-100 text-amber-900/40" },
  { code: "excelente", label: "Excelente fit", activeClass: "bg-orange-600 text-white ring-orange-700/40", idleClass: "bg-orange-100 text-orange-900/40" },
];

export function normalizeFitIaNivel(value: unknown): FitIaNivel | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "baixo" || s === "parcial" || s === "adequado" || s === "bom" || s === "excelente") return s;
  return null;
}

type Props = {
  nivel: string | null | undefined;
  motivo?: string | null;
  loading?: boolean;
  hasVaga?: boolean;
  className?: string;
};

export function TermometroFitVaga({ nivel, motivo, loading, hasVaga = true, className }: Props) {
  const active = normalizeFitIaNivel(nivel);
  const activeMeta = active ? NIVEIS.find((n) => n.code === active) : null;
  const statusHint = loading
    ? "Avaliando aderência com IA…"
    : !activeMeta
      ? "Aguardando análise da IA…"
      : !hasVaga
        ? "Avaliação geral (sem vaga)"
        : null;

  return (
    <div className={`rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 ${className ?? ""}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Termômetro de fit</p>
        {activeMeta ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {NIVEIS.findIndex((n) => n.code === active) + 1}/5
          </span>
        ) : null}
      </div>
      {statusHint ? <p className="mb-1.5 text-[11px] text-muted-foreground">{statusHint}</p> : null}

      <div className="grid grid-cols-5 gap-1" role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={active ? NIVEIS.findIndex((n) => n.code === active) + 1 : undefined} aria-label="Termômetro de fit à vaga">
        {NIVEIS.map((n) => {
          const isActive = active === n.code;
          return (
            <div
              key={n.code}
              title={n.label}
              className={`flex h-7 items-center justify-center rounded px-0.5 text-center text-[9px] font-semibold leading-tight ${
                isActive ? `${n.activeClass} ring-2` : n.idleClass
              } ${!active && !loading ? "opacity-60" : ""}`}
            >
              <span className="line-clamp-2">{n.label.replace(" fit", "")}</span>
            </div>
          );
        })}
      </div>

      {motivo?.trim() ? (
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{motivo.trim()}</p>
      ) : null}
    </div>
  );
}
