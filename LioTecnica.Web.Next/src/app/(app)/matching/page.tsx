import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import MatchingScreen from "@/features/recrutamento/matching/MatchingScreen";

interface Props {
  searchParams: Promise<{ vagaId?: string }>;
}

export default async function MatchingPage({ searchParams }: Props) {
  await requireMe("/app/matching");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const vagasRes = await fetch(await legacyAbsoluteUrl("/api/vagas"), { headers: { cookie }, cache: "no-store" });
  const initialVagas = vagasRes.ok ? ((await vagasRes.json()) as unknown) : [];
  const { vagaId } = await searchParams;
  return <MatchingScreen initialVagas={initialVagas} fixedVagaId={vagaId ?? null} />;
}
