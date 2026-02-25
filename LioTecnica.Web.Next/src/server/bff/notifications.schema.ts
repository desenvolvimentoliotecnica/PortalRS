import { z } from "zod";

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

