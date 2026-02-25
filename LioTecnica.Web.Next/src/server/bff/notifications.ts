import "server-only";

import { legacyJson } from "@/server/legacy/fetch";
import { normalizeNotificationsList, type NotificationsList } from "@/server/bff/notifications.schema";

export async function getNotifications(take = 20): Promise<NotificationsList> {
  const json = await legacyJson<unknown>(`/bff/notifications?take=${encodeURIComponent(String(take))}`);
  return normalizeNotificationsList(json);
}

