import "server-only";

import { headers } from "next/headers";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";
import { BffNavigationSchema, type BffNavigation } from "@/server/bff/navigation.schema";

export async function getNavigation(): Promise<BffNavigation> {
  const h = await headers();

  const res = await fetch(await legacyAbsoluteUrl("/bff/navigation"), {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
    redirect: "manual",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`BFF_ERROR_${res.status}`);

  const json = await res.json();
  return BffNavigationSchema.parse(json);
}
