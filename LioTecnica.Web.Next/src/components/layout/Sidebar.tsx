"use client";

import Brand from "@/components/layout/Brand";
import type { BffNavItem } from "@/lib/schemas/bff";
import SidebarNavClient from "@/features/navigation/SidebarNavClient";

export default function Sidebar({ items, collapsed = false }: { items: BffNavItem[]; collapsed?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <Brand collapsed={collapsed} />
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <SidebarNavClient items={items} collapsed={collapsed} />
      </div>
      {!collapsed && (
        <div className="border-t border-white/10 bg-black/5 px-4 py-4">
          <div className="text-xs font-semibold text-white/85">Ambiente</div>
          <div className="text-xs text-white/70">DEV</div>
        </div>
      )}
    </div>
  );
}
