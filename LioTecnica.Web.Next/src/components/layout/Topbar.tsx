"use client";

import type { BffNavItem } from "@/lib/schemas/bff";
import TopbarClient from "@/components/layout/TopbarClient";
import { useAuth } from "@/hooks/useAuth";

export default function Topbar({ navItems }: { navItems: BffNavItem[] }) {
  const { me } = useAuth();
  return <TopbarClient navItems={navItems} me={me} />;
}
