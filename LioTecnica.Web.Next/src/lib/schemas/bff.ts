import { z } from "zod";

/* ─── BFF Me (auth) ─── */

export const BffMeSchema = z.object({
    isAuthenticated: z.boolean(),
    tenantId: z.string(),
    displayName: z.string(),
    email: z.string(),
    roles: z.array(z.string()),
    isAdmin: z.boolean(),
    isOwnerContext: z.boolean(),
});

export type BffMe = z.infer<typeof BffMeSchema>;

/* ─── Navigation ─── */

export type BffNavItem = {
    id: string;
    label: string;
    href: string;
    icon?: string | null;
    openInNewTab: boolean;
    children: BffNavItem[];
};

export const BffNavItemSchema: z.ZodType<BffNavItem> = z.lazy(() =>
    z.object({
        id: z.string(),
        label: z.string(),
        href: z.string(),
        icon: z.string().nullable().optional(),
        openInNewTab: z.boolean(),
        children: z.array(BffNavItemSchema),
    }),
);

export const BffNavigationSchema = z.object({
    items: z.array(BffNavItemSchema),
});

export type BffNavigation = z.infer<typeof BffNavigationSchema>;

/* ─── Dashboard KPIs ─── */

export const DashboardKpisSchema = z.object({
    openVagas: z.number().int().nonnegative(),
    cvsHoje: z.number().int().nonnegative(),
    pendentesMatch: z.number().int().nonnegative(),
    aprovados7Dias: z.number().int().nonnegative(),
    vagasForaSla: z.number().int().nonnegative(),
});

export type DashboardKpis = z.infer<typeof DashboardKpisSchema>;

/* ─── Notifications ─── */

export const NotificationItemSchema = z
    .object({
        id: z.string(),
        title: z.string().optional(),
        message: z.string().optional(),
        level: z.string().optional(),
        url: z.string().optional().nullable(),
        createdAt: z.string().optional(),
        createdAtUtc: z.string().optional(),
        read: z.boolean().optional(),
        seenCount: z.number().int().nonnegative().optional(),
        readCount: z.number().int().nonnegative().optional(),
    })
    .passthrough();

export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationsListSchema = z
    .object({
        unreadCount: z.number().int().nonnegative().optional(),
        UnreadCount: z.number().int().nonnegative().optional(),
        items: z.array(NotificationItemSchema).optional(),
        Items: z.array(NotificationItemSchema).optional(),
    })
    .passthrough();

export type NotificationsList = {
    unreadCount: number;
    items: NotificationItem[];
};

export function normalizeNotificationsList(raw: unknown): NotificationsList {
    if (Array.isArray(raw)) {
        return { unreadCount: 0, items: [] };
    }

    const parsed = NotificationsListSchema.parse(raw);
    const unreadCount = parsed.unreadCount ?? parsed.UnreadCount ?? 0;
    const items = parsed.items ?? parsed.Items ?? [];
    return { unreadCount, items };
}

/* ─── Lookups / Enums ─── */

export const EnumOptionSchema = z.object({
    code: z.string(),
    text: z.string(),
});

export const EnumsByKeySchema = z.record(z.string(), z.array(EnumOptionSchema));

export type EnumsByKey = z.infer<typeof EnumsByKeySchema>;
