import { getMe } from "@/server/bff/client";
import type { BffNavItem } from "@/server/bff/navigation.schema";
import TopbarClient from "@/components/layout/TopbarClient";

export default async function Topbar({ navItems }: { navItems: BffNavItem[] }) {
  const me = await getMe().catch(() => null);
  return <TopbarClient navItems={navItems} me={me} />;
}
