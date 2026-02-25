import "server-only";

import { headers } from "next/headers";
import { env } from "@/lib/env";

export function legacyOrigin(): string | null {
  return env.LEGACY_ORIGIN ?? null;
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function legacyAbsoluteUrl(path: string): Promise<string> {
  const base = legacyOrigin() ?? (await requestOrigin());
  return new URL(path, base).toString();
}
