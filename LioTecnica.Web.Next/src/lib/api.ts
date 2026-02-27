/**
 * Client-side API helpers.
 *
 * Supports both same-origin and external API base via NEXT_PUBLIC_API_BASE.
 * Automatically attaches JWT bearer token + tenant header when available.
 */

import { env } from "@/lib/env";
import { clearSession, getAccessToken, getTenantId, setTenantId, tryGetTenantIdFromJwt } from "@/lib/session";

function resolveUrl(path: string): string {
    // Accept absolute URLs as-is.
    if (/^https?:\/\//i.test(path)) return path;

    // Normalize accidental basePath prefix for API calls (older code used "/app/api/...").
    const normalized = path.startsWith("/app/api/") ? path.slice("/app".length) : path;

    const base = (env.API_BASE ?? "").trim();
    if (!base) return normalized;
    if (!normalized.startsWith("/")) return `${base.replace(/\/+$/, "")}/${normalized}`;
    return `${base.replace(/\/+$/, "")}${normalized}`;
}

export async function apiFetch(
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Tenant: required by RHPortal.Api middleware for most /api routes.
    let tenantId = getTenantId();
    if (!tenantId && token) {
        const fromJwt = tryGetTenantIdFromJwt(token);
        if (fromJwt) {
            tenantId = fromJwt;
            setTenantId(fromJwt);
        }
    }
    if (tenantId && !headers.has("X-Tenant-Id")) {
        headers.set("X-Tenant-Id", tenantId);
    }

    const url = resolveUrl(path);

    const res = await fetch(url, {
        ...init,
        headers,
    });

    if (res.status === 401) {
        clearSession();
    }
    return res;
}

export async function apiJson<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const res = await apiFetch(path, init);

    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    return (await res.json()) as T;
}
