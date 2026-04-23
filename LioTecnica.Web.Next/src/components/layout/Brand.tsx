"use client";

import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";

export default function Brand() {
  const { isCollapsed, toggle } = useSidebar();

  // Header white-label da sidebar. Evitamos branding específico (Render / Quali IT):
  // ícone neutro + rótulo "Portal de RH" funcionam para qualquer tenant.
  // Quando a sidebar estiver colapsada, só o ícone aparece.
  return (
    <div
      className={cn(
        "flex items-center border-b border-white/10 py-4 px-4 transition-all duration-200",
        isCollapsed ? "flex-col gap-2 justify-center" : "gap-3 justify-between",
      )}
    >
      <div className={cn("flex items-center gap-3 min-w-0", isCollapsed && "justify-center")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 shrink-0">
          <Building2 aria-hidden className="size-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight text-white">
              Portal de RH
            </div>
            <div className="truncate text-[10px] uppercase tracking-[0.18em] text-white/60">
              Gestão de pessoas
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        onClick={toggle}
        className="shrink-0 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        {isCollapsed ? (
          <PanelLeftOpen aria-hidden className="size-4" />
        ) : (
          <PanelLeftClose aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
}
