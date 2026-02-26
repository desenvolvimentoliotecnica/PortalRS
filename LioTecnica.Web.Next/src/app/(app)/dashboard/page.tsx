import { headers } from "next/headers";

import { requireMe } from "@/server/bff/requireMe";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";

import DashboardScreen from "@/features/dashboard/DashboardScreen";

export default async function DashboardPage() {
  await requireMe("/app/dashboard");
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const [kRes, fRes, sRes, vRes, aRes, tRes] = await Promise.all([
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/kpis"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/funil"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/recebidos-series?days=14"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/vagas"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/areas"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
    fetch(await legacyAbsoluteUrl("/Dashboard/_api/top-matches?minMatch=70&take=15"), { headers: { cookie }, cache: "no-store", redirect: "manual" }),
  ]);

  const isJson = (res: Response) => (res.headers.get("content-type") ?? "").toLowerCase().includes("application/json");

  const initialKpis = kRes.ok && isJson(kRes) ? ((await kRes.json()) as unknown) : null;
  const initialFunil = fRes.ok && isJson(fRes) ? ((await fRes.json()) as unknown) : null;
  const initialSeries = sRes.ok && isJson(sRes) ? ((await sRes.json()) as unknown) : null;
  const initialVagas = vRes.ok && isJson(vRes) ? ((await vRes.json()) as unknown) : [];
  const initialAreas = aRes.ok && isJson(aRes) ? ((await aRes.json()) as unknown) : [];
  const initialTopMatches = tRes.ok && isJson(tRes) ? ((await tRes.json()) as unknown) : [];

  return (
    <DashboardScreen
      initialKpis={initialKpis}
      initialFunil={initialFunil}
      initialSeries={initialSeries}
      initialVagas={initialVagas}
      initialAreas={initialAreas}
      initialTopMatches={initialTopMatches}
    />
  );
}
