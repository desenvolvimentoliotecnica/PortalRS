"use client";

import Brand from "@/components/layout/Brand";
import type { BffNavItem } from "@/lib/schemas/bff";
import SidebarNavClient from "@/features/navigation/SidebarNavClient";
import { useSidebar } from "@/contexts/SidebarContext";

export default function Sidebar({ items }: { items: BffNavItem[] }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-full flex-col">
      <Brand />
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <SidebarNavClient items={items} isCollapsed={isCollapsed} />
      </div>
      {!isCollapsed && (
        <div className="border-t border-white/10 bg-black/5 px-4 py-4">
          <div className="text-xs font-semibold text-white/85">Ambiente</div>
          <div className="text-xs text-white/70">
            DEV <span className="text-white/40">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </div>
        </div>
      )}
    </div>
  );
}
