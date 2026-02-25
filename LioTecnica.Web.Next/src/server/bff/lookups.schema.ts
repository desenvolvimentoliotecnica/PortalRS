import { z } from "zod";

export const EnumOptionSchema = z.object({
  code: z.string(),
  text: z.string(),
});

export const EnumsByKeySchema = z.record(z.string(), z.array(EnumOptionSchema));

export type EnumsByKey = z.infer<typeof EnumsByKeySchema>;

