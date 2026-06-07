"use client";

import Brand from "@/components/layout/Brand";
import type { NavGrupoResponse } from "@/lib/schemas/navegacao";
import SidebarNavClient from "@/features/navigation/SidebarNavClient";
import { useSidebar } from "@/contexts/SidebarContext";

export default function Sidebar({ grupos }: { grupos: NavGrupoResponse[] }) {
  const { isCollapsed } = useSidebar();
  const environment = process.env.NEXT_PUBLIC_APP_ENVIRONMENT?.trim() || "LOCAL";
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "dev";

  return (
    <div className="flex h-full flex-col">
      <Brand />
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <SidebarNavClient grupos={grupos} isCollapsed={isCollapsed} />
      </div>
      {!isCollapsed && (
        <div className="border-t border-white/10 bg-black/5 px-4 py-4">
          <div className="text-xs font-semibold text-white/85">Ambiente</div>
          <div className="text-xs text-white/70">
            {environment} <span className="text-white/40">v{version}</span>
          </div>
        </div>
      )}
    </div>
  );
}
