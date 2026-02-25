import "server-only";

import { headers } from "next/headers";

import { legacyAbsoluteUrl } from "@/server/legacy/urls";

type LegacyFetchInit = RequestInit & {
  /**
   * When true (default), forwards the incoming request cookies to the legacy app
   * so cookie-based auth works in SSR.
   */
  forwardCookies?: boolean;
};

export async function legacyFetch(path: string, init: LegacyFetchInit = {}) {
  const h = await headers();
  const forwardCookies = init.forwardCookies ?? true;

  const nextHeaders = new Headers(init.headers);
  if (forwardCookies && !nextHeaders.has("cookie")) {
    nextHeaders.set("cookie", h.get("cookie") ?? "");
  }
  if (!nextHeaders.has("accept")) {
    nextHeaders.set("accept", "application/json");
  }

  return fetch(await legacyAbsoluteUrl(path), {
    ...init,
    headers: nextHeaders,
    cache: init.cache ?? "no-store",
    redirect: init.redirect ?? "manual",
  });
}

export async function legacyJson<T>(path: string, init: LegacyFetchInit = {}): Promise<T> {
  const res = await legacyFetch(path, init);
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`LEGACY_ERROR_${res.status}`);
  return (await res.json()) as T;
}

