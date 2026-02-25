import "server-only";

import { EnumsByKeySchema, type EnumsByKey } from "@/server/bff/lookups.schema";
import { legacyJson } from "@/server/legacy/fetch";

export async function getEnums(): Promise<EnumsByKey> {
  const json = await legacyJson<unknown>("/bff/lookups/enums");
  return EnumsByKeySchema.parse(json);
}

