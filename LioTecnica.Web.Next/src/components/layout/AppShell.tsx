import type { ReactNode } from "react";

import AppShellClient from "@/components/layout/AppShellClient";

export default function AppShell({ children }: { children: ReactNode }) {
  return <AppShellClient>{children}</AppShellClient>;
}
