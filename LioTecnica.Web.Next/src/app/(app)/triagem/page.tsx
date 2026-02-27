import { requireMe } from "@/server/bff/requireMe";
import TriagemScreen from "@/features/recrutamento/triagem/TriagemScreen";
import { headers } from "next/headers";

import { legacyAbsoluteUrl } from "@/server/legacy/urls";

export default async function TriagemPage() {
  await requireMe("/app/triagem");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const [vRes, cRes] = await Promise.all([
    fetch(await legacyAbsoluteUrl("/Triagem/_api/vagas"), { headers: { cookie }, cache: "no-store" }),
    fetch(await legacyAbsoluteUrl("/Triagem/_api/candidatos"), { headers: { cookie }, cache: "no-store" }),
  ]);

  const initialVagas = vRes.ok ? ((await vRes.json()) as unknown) : [];
  const initialCands = cRes.ok ? ((await cRes.json()) as unknown) : [];

  return <TriagemScreen initialVagas={initialVagas} initialCands={initialCands} />;
}

