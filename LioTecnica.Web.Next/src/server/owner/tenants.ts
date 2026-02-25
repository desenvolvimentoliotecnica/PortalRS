import "server-only";

import { legacyFetch, legacyJson } from "@/server/legacy/fetch";
import {
    TenantListItemSchema,
    TenantDetailSchema,
    TenantMigrationStatusSchema,
    MigrationApplyResultSchema,
    type TenantListItem,
    type TenantDetail,
    type TenantMigrationStatus,
    type TenantWithStatus,
} from "@/server/owner/tenants.schema";

/* ─── List all tenants ─── */

export async function listTenants(): Promise<TenantListItem[]> {
    const raw = await legacyJson<unknown[]>("/Owner/_api/tenants");
    return raw.map((item) => TenantListItemSchema.parse(item));
}

/* ─── Get migration status for all tenants ─── */

export async function getMigrationStatus(): Promise<TenantMigrationStatus[]> {
    try {
        const raw = await legacyJson<unknown[]>("/Owner/_api/tenants/migrations/status");
        return raw.map((item) => TenantMigrationStatusSchema.parse(item));
    } catch {
        return [];
    }
}

/* ─── Get tenants with status (combined) ─── */

export async function getTenantsWithStatus(): Promise<TenantWithStatus[]> {
    const [tenants, statuses] = await Promise.all([listTenants(), getMigrationStatus()]);

    const statusMap = new Map<string, TenantMigrationStatus>();
    for (const s of statuses) {
        statusMap.set(s.tenantId.toLowerCase(), s);
    }

    return tenants.map((t) => {
        const st = statusMap.get(t.tenantId.toLowerCase());
        return {
            ...t,
            isUpToDate: st?.isUpToDate ?? null,
            pendingCount: st?.pendingCount ?? 0,
            migrationError: st?.errorMessage ?? null,
        };
    });
}

/* ─── Get tenant details ─── */

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
    try {
        const raw = await legacyJson<unknown>(`/Owner/_api/tenants/${encodeURIComponent(tenantId)}`);
        return TenantDetailSchema.parse(raw);
    } catch {
        return null;
    }
}

/* ─── Create tenant ─── */

export async function createTenant(
    tenantId: string,
    name: string,
): Promise<{ success: boolean; error?: string }> {
    const res = await legacyFetch("/Owner/_api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: tenantId.trim().toLowerCase(), name: name.trim() }),
    });
    if (res.ok) return { success: true };
    const body = await res.text().catch(() => "");
    try {
        const json = JSON.parse(body);
        return { success: false, error: json?.detail || json?.title || body };
    } catch {
        return { success: false, error: body || `Erro ${res.status}` };
    }
}

/* ─── Delete tenant ─── */

export async function deleteTenant(
    tenantId: string,
): Promise<{ success: boolean; error?: string }> {
    const res = await legacyFetch(`/Owner/_api/tenants/${encodeURIComponent(tenantId)}`, {
        method: "DELETE",
    });
    if (res.ok) return { success: true };
    const body = await res.text().catch(() => "");
    return { success: false, error: body || `Erro ${res.status}` };
}

/* ─── Apply migrations ─── */

export async function applyMigrations(
    tenantId: string,
): Promise<{ success: boolean; appliedCount?: number; error?: string }> {
    const res = await legacyFetch(
        `/Owner/_api/tenants/${encodeURIComponent(tenantId)}/migrations/apply`,
        { method: "POST" },
    );
    if (res.ok) {
        const json = await res.json().catch(() => null);
        const parsed = MigrationApplyResultSchema.safeParse(json);
        return { success: true, appliedCount: parsed.success ? parsed.data.appliedCount : 0 };
    }
    const body = await res.text().catch(() => "");
    return { success: false, error: body || `Erro ${res.status}` };
}

/* ─── Seed tenant ─── */

export async function seedTenant(
    tenantId: string,
): Promise<{ success: boolean; error?: string }> {
    const res = await legacyFetch(`/Owner/_api/tenants/${encodeURIComponent(tenantId)}/seed`, {
        method: "POST",
    });
    if (res.ok) return { success: true };
    const body = await res.text().catch(() => "");
    return { success: false, error: body || `Erro ${res.status}` };
}
