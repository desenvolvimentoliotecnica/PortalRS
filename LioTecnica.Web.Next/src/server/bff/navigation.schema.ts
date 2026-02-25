import { z } from "zod";

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
