import { z } from "zod";

export const VagaListItemSchema = z
  .object({
    id: z.string(),
    codigo: z.string().optional().nullable(),
    titulo: z.string().optional().nullable(),
    area: z.string().optional().nullable(),
    modalidade: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    threshold: z.number().optional().nullable(),
    matchMinimoPercentual: z.number().optional().nullable(),
    requisitosTotal: z.number().optional().nullable(),
    requisitosObrigatorios: z.number().optional().nullable(),
    updatedAt: z.string().optional().nullable(),
    requisitos: z.array(z.unknown()).optional().nullable(),
    hasDetail: z.boolean().optional().nullable(),
  })
  .passthrough();

export type VagaListItem = z.infer<typeof VagaListItemSchema>;

export const VagaDetailSchema = VagaListItemSchema.passthrough();
export type VagaDetail = z.infer<typeof VagaDetailSchema>;

export const LookupItemSchema = z
  .object({
    id: z.string().optional().nullable(),
    nome: z.string().optional().nullable(),
    codigo: z.string().optional().nullable(),
    label: z.string().optional().nullable(),
    value: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
  })
  .passthrough();

export type LookupItem = z.infer<typeof LookupItemSchema>;

export const MatchingCandidateSchema = z
  .object({
    id: z.string(),
    nome: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    score: z.number().optional().nullable(),
    match: z.number().optional().nullable(),
    status: z.string().optional().nullable(),
  })
  .passthrough();

export type MatchingCandidate = z.infer<typeof MatchingCandidateSchema>;

