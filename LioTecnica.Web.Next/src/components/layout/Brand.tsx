"use client";

import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";

export default function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const { toggle } = useSidebar();

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-white/10 py-4 transition-all duration-200",
        collapsed ? "justify-center px-2" : "px-4",
      )}
    >
      <div
        aria-label="LT"
        className="text-lt-primary grid shrink-0 place-items-center rounded-xl bg-white font-extrabold shadow"
        style={{ width: collapsed ? 36 : 40, height: collapsed ? 36 : 40, fontSize: collapsed ? "0.7rem" : undefined }}
      >
        LT
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">Portal RH</div>
            <div className="truncate text-xs text-white/75">Nova UI (Next)</div>
          </div>
          <button
            type="button"
            onClick={toggle}
            title="Recolher menu"
            className="shrink-0 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose aria-hidden className="size-4" />
            <span className="sr-only">Recolher menu</span>
          </button>
        </div>
      )}
    </div>
  );
}
