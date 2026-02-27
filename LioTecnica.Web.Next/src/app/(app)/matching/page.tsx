import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import MatchingScreen from "@/features/recrutamento/matching/MatchingScreen";

export const dynamic = "force-static";

export default async function MatchingPage() {
  await requireMe("/app/matching");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const vagasRes = await fetch(await legacyAbsoluteUrl("/api/vagas"), { headers: { cookie }, cache: "no-store" });
  const initialVagas = vagasRes.ok ? ((await vagasRes.json()) as unknown) : [];
  return <MatchingScreen initialVagas={initialVagas} />;
}

