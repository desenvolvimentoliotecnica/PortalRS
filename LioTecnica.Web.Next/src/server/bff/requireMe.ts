import "server-only";

import { redirect } from "next/navigation";

import { getMe } from "@/server/bff/client";

/**
 * Enforce cookie-based auth (source of truth is the legacy app).
 * If unauthenticated, redirect to the Next login page.
 */
export async function requireMe(returnUrlPath: string) {
  const me = await getMe().catch(() => null);
  if (!me) {
    redirect(`/login?returnUrl=${encodeURIComponent(returnUrlPath)}`);
  }
  return me;
}

