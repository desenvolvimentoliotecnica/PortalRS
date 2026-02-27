import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    LEGACY_ORIGIN: z.string().url().optional(),
  },
  runtimeEnv: {
    LEGACY_ORIGIN: process.env.LEGACY_ORIGIN,
  },
});
