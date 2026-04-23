"use client";

import type { NavGrupoResponse } from "@/lib/schemas/navegacao";
import TopbarClient from "@/components/layout/TopbarClient";
import { useAuth } from "@/hooks/useAuth";

export default function Topbar({ grupos }: { grupos: NavGrupoResponse[] }) {
  const { me } = useAuth();
  return <TopbarClient grupos={grupos} me={me} />;
}
