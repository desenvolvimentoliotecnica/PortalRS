import "server-only";

import { headers } from "next/headers";
import { BffMeSchema, type BffMe } from "@/server/bff/schema";
import { legacyAbsoluteUrl } from "@/server/legacy/urls";

export async function getMe(): Promise<BffMe> {
  const h = await headers();

  if (h.get("x-mock-auth") === "1") {
    return {
      isAuthenticated: true,
      tenantId: "dev",
      displayName: "Dev User",
      email: "dev@example.com",
      roles: ["Admin"],
      isAdmin: true,
      isOwnerContext: false,
    };
  }

  const res = await fetch(await legacyAbsoluteUrl("/bff/me"), {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
    redirect: "manual",
  });

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`BFF_ERROR_${res.status}`);

  const json = await res.json();
  return BffMeSchema.parse(json);
}
