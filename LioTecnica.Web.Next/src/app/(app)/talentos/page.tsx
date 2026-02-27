import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import TalentosScreen from "@/features/recrutamento/talentos/TalentosScreen";

export const dynamic = "force-static";

export default async function TalentosPage() {
  await requireMe("/app/talentos");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const [listRes, vagasRes] = await Promise.all([
    fetch(await legacyAbsoluteUrl("/Talentos/_api/list?page=1&pageSize=20"), { headers: { cookie }, cache: "no-store" }),
    fetch(await legacyAbsoluteUrl("/api/vagas"), { headers: { cookie }, cache: "no-store" }),
  ]);

  const initialList = listRes.ok ? ((await listRes.json()) as unknown) : null;
  const initialVagas = vagasRes.ok ? ((await vagasRes.json()) as unknown) : [];

  return <TalentosScreen initialList={initialList} initialVagas={initialVagas} />;
}

