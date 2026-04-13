"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import RenderRHLogo from "@/components/brand/RenderRHLogo";

export default function Brand() {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <div
      className={cn(
        "flex items-center border-b border-white/10 py-4 px-4 transition-all duration-200",
        isCollapsed ? "flex-col gap-2 justify-center" : "gap-3 justify-between",
      )}
    >
      <RenderRHLogo
        variant="on-dark"
        size={40}
        showWordmark={!isCollapsed}
      />

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
