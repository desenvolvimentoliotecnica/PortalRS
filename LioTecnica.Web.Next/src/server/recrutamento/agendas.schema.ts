import { z } from "zod";

export const AgendaTypeSchema = z.object({
  code: z.string(),
  label: z.string(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export type AgendaType = z.infer<typeof AgendaTypeSchema>;

export const AgendaEventApiSchema = z.object({
  id: z.string(),
  title: z.string().optional().nullable(),
  startAtUtc: z.string(),
  endAtUtc: z.string().optional().nullable(),
  allDay: z.boolean().optional().default(false),
  status: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  candidate: z.string().optional().nullable(),
  vagaTitle: z.string().optional().nullable(),
  vagaCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  typeCode: z.string().optional().nullable(),
  typeColor: z.string().optional().nullable(),
  typeIcon: z.string().optional().nullable(),
});

export type AgendaEventApi = z.infer<typeof AgendaEventApiSchema>;

export const CandidatoListItemSchema = z.object({
  id: z.string(),
  nome: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
});

export type CandidatoListItem = z.infer<typeof CandidatoListItemSchema>;

export const VagaListItemSchema = z.object({
  id: z.string(),
  titulo: z.string().optional().nullable(),
  codigo: z.string().optional().nullable(),
});

export type VagaListItem = z.infer<typeof VagaListItemSchema>;

