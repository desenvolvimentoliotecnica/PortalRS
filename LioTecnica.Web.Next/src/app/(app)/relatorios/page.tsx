import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";

import RelatoriosScreen from "@/features/relatorios/RelatoriosScreen";

function isJson(res: Response) {
  return (res.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

export default async function RelatoriosPage() {
  await requireMe("/app/relatorios");

  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const [catalogRes, vagasRes] = await Promise.all([
    fetch(await legacyAbsoluteUrl("/Relatorios/_api/catalog"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Relatorios/_api/vagas"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
  ]);

  const initialCatalog = catalogRes.ok && isJson(catalogRes) ? ((await catalogRes.json()) as unknown) : [];
  const initialVagas = vagasRes.ok && isJson(vagasRes) ? ((await vagasRes.json()) as unknown) : [];

  return <RelatoriosScreen initialCatalog={initialCatalog} initialVagas={initialVagas} />;
}

