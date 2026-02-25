import { z } from "zod";

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
