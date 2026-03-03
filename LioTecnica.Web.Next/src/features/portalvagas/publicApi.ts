"use client";

import { apiFetch } from "@/lib/api";

const STORAGE_PREFIX = "renderrh.portalCandidate.";

export type PortalCandidateSession = {
  tenantId: string;
  id: string;
  nome?: string;
  email?: string;
};

function key(tenantId: string) {
  return `${STORAGE_PREFIX}${tenantId.toLowerCase()}`;
}

export function savePortalCandidateSession(session: PortalCandidateSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(session.tenantId), JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function getPortalCandidateSession(tenantId: string): PortalCandidateSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PortalCandidateSession> | null;
    if (!parsed?.id) return null;
    return {
      tenantId,
      id: String(parsed.id),
      nome: parsed.nome ? String(parsed.nome) : undefined,
      email: parsed.email ? String(parsed.email) : undefined,
    };
  } catch {
    return null;
  }
}

export function clearPortalCandidateSession(tenantId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(tenantId));
  } catch {
    // ignore
  }
}

export function portalCandidateBasePath(tenantId: string): string | null {
  const session = getPortalCandidateSession(tenantId);
  if (!session?.id) return null;
  return `/api/public/portal-candidates/${encodeURIComponent(session.id)}`;
}

export async function portalAuthFetch(
  tenantId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("X-Tenant-Id")) headers.set("X-Tenant-Id", tenantId);
  return apiFetch(path, { ...init, headers });
}

export async function portalCandidateFetch(
  tenantId: string,
  suffix: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = portalCandidateBasePath(tenantId);
  if (!base) {
    return new Response(JSON.stringify({ message: "Candidate session not found." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const headers = new Headers(init.headers);
  if (!headers.has("X-Tenant-Id")) headers.set("X-Tenant-Id", tenantId);
  return apiFetch(`${base}${suffix}`, { ...init, headers });
}
