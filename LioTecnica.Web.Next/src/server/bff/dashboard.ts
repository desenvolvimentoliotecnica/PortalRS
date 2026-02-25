import "server-only";

import { headers } from "next/headers";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import { DashboardKpisSchema, type DashboardKpis } from "@/server/bff/dashboard.schema";

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const h = await headers();

  if (h.get("x-mock-auth") === "1") {
    return {
      openVagas: 12,
      cvsHoje: 4,
      pendentesMatch: 18,
      aprovados7Dias: 6,
      vagasForaSla: 2,
    };
  }

  const res = await fetch(await legacyAbsoluteUrl("/bff/dashboard/kpis"), {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
    redirect: "manual",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`BFF_ERROR_${res.status}`);

  const json = await res.json();
  return DashboardKpisSchema.parse(json);
}
