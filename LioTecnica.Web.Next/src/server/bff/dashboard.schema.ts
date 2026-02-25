import { z } from "zod";

export const DashboardKpisSchema = z.object({
  openVagas: z.number().int().nonnegative(),
  cvsHoje: z.number().int().nonnegative(),
  pendentesMatch: z.number().int().nonnegative(),
  aprovados7Dias: z.number().int().nonnegative(),
  vagasForaSla: z.number().int().nonnegative(),
});

export type DashboardKpis = z.infer<typeof DashboardKpisSchema>;
