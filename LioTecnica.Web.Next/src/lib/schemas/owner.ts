import { z } from "zod";

/* ─── Tenant List Item ─── */
export const TenantListItemSchema = z.object({
    tenantId: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    createdAtUtc: z.string(),
    updatedAtUtc: z.string(),
});
export type TenantListItem = z.infer<typeof TenantListItemSchema>;

/* ─── Tenant Detail ─── */
export const TenantDetailSchema = z.object({
    tenantId: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    createdAtUtc: z.string(),
    updatedAtUtc: z.string(),
    createdByOwnerId: z.string().nullable().optional(),
    createdByOwnerEmail: z.string().nullable().optional(),
});
export type TenantDetail = z.infer<typeof TenantDetailSchema>;

/* ─── Migration Status ─── */
export const TenantMigrationStatusSchema = z.object({
    tenantId: z.string(),
    isUpToDate: z.boolean(),
    pendingCount: z.number(),
    pendingMigrationIds: z.array(z.string()).optional().default([]),
    errorMessage: z.string().nullable().optional(),
});
export type TenantMigrationStatus = z.infer<typeof TenantMigrationStatusSchema>;

/* ─── Migration Apply Result ─── */
export const MigrationApplyResultSchema = z.object({
    appliedCount: z.number(),
});

/* ─── Combined: Tenant + Migration Status (for listing page) ─── */
export type TenantWithStatus = TenantListItem & {
    isUpToDate: boolean | null;
    pendingCount: number;
    migrationError: string | null;
};
