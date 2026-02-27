import { z } from "zod";

export const ApiLoginResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpirationMinutes: z.number().int().nonnegative(),
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  tenantId: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  funcionarioId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  visibilityScope: z.number().int().optional(),
  vagasDataScope: z.number().int().optional(),
  isReadOnly: z.boolean().optional(),
});

export type ApiLoginResponse = z.infer<typeof ApiLoginResponseSchema>;

export const ApiOwnerLoginResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpirationMinutes: z.number().int().nonnegative(),
  ownerId: z.string(),
  email: z.string(),
  tenantId: z.string(),
  roles: z.array(z.string()),
});

export type ApiOwnerLoginResponse = z.infer<typeof ApiOwnerLoginResponseSchema>;

export const ApiCurrentUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  tenantId: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  funcionarioId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  visibilityScope: z.number().int().optional(),
  vagasDataScope: z.number().int().optional(),
  isReadOnly: z.boolean().optional(),
});

export type ApiCurrentUser = z.infer<typeof ApiCurrentUserSchema>;

export const ApiSwitchTenantResponseSchema = z.object({
  accessToken: z.string(),
  tenantId: z.string(),
});

export type ApiSwitchTenantResponse = z.infer<typeof ApiSwitchTenantResponseSchema>;

export const ApiMenuForCurrentUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  route: z.string(),
  icon: z.string().optional().default(""),
  order: z.number().int().optional().default(0),
  parentId: z.string().nullable().optional(),
  permissionKey: z.string().optional().default(""),
  openInNewTab: z.boolean().optional().default(false),
});

export type ApiMenuForCurrentUser = z.infer<typeof ApiMenuForCurrentUserSchema>;

