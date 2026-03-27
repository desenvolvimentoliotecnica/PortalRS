"use client";

import { apiFetch } from "@/lib/api";

const STORAGE_PREFIX = "renderrh.admissaoPortal.";

export type AdmissaoPortalSession = {
    tenantId: string;
    preAdmissaoId: string;
    cpf: string;
    nome?: string;
};

function key(tenantId: string) {
    return `${STORAGE_PREFIX}${tenantId.toLowerCase()}`;
}

export function saveAdmissaoPortalSession(session: AdmissaoPortalSession) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key(session.tenantId), JSON.stringify(session)); } catch {}
}

export function getAdmissaoPortalSession(tenantId: string): AdmissaoPortalSession | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(key(tenantId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AdmissaoPortalSession> | null;
        if (!parsed?.preAdmissaoId || !parsed?.cpf) return null;
        return {
            tenantId,
            preAdmissaoId: String(parsed.preAdmissaoId),
            cpf: String(parsed.cpf),
            nome: parsed.nome ? String(parsed.nome) : undefined,
        };
    } catch { return null; }
}

export function clearAdmissaoPortalSession(tenantId: string) {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(key(tenantId)); } catch {}
}

export async function admissaoPortalFetch(
    tenantId: string,
    path: string,
    cpf: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("X-Tenant-Id")) headers.set("X-Tenant-Id", tenantId);
    headers.set("X-Cpf", cpf);
    return apiFetch(path, { ...init, headers });
}
