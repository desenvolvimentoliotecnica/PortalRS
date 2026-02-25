import { z } from "zod";

export const DocumentoSchema = z
  .object({
    id: z.string(),
    tipo: z.string().optional().nullable(),
    nomeArquivo: z.string().optional().nullable(),
    descricao: z.string().optional().nullable(),
    tamanhoBytes: z.number().optional().nullable(),
    url: z.string().optional().nullable(),
    createdAt: z.string().optional().nullable(),
  })
  .passthrough();

export type Documento = z.infer<typeof DocumentoSchema>;

export const CandidatoSchema = z
  .object({
    id: z.string(),
    nome: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    fone: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    vagaId: z.string().optional().nullable(),
    vagaTitle: z.string().optional().nullable(),
    vagaCode: z.string().optional().nullable(),
    cvText: z.string().optional().nullable(),
    resumoProfissional: z.string().optional().nullable(),
    lastMatch: z
      .object({
        score: z.number().optional().nullable(),
        pass: z.boolean().optional().nullable(),
        at: z.string().optional().nullable(),
        vagaId: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    documentos: z.array(DocumentoSchema).optional().nullable(),
    updatedAt: z.string().optional().nullable(),
    talentoId: z.string().optional().nullable(),
  })
  .passthrough();

export type Candidato = z.infer<typeof CandidatoSchema>;

export const CandidatosPagedSchema = z
  .object({
    items: z.array(CandidatoSchema).optional().nullable(),
    totalCount: z.number().optional().nullable(),
    page: z.number().optional().nullable(),
    pageSize: z.number().optional().nullable(),
  })
  .passthrough();

export type CandidatosPaged = z.infer<typeof CandidatosPagedSchema>;

