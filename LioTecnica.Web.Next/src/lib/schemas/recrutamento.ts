import { z } from "zod";

/* ─── Vagas ─── */

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

/* ─── Candidatos ─── */

export const DocumentoSchema = z
    .object({
        id: z.string(),
        tipo: z.string().optional().nullable(),
        nomeArquivo: z.string().optional().nullable(),
        descricao: z.string().optional().nullable(),
        tamanhoBytes: z.number().optional().nullable(),
        url: z.string().optional().nullable(),
        contentType: z.string().optional().nullable(),
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
        fonte: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        vagaId: z.string().optional().nullable(),
        vagaTitle: z.string().optional().nullable(),
        vagaCode: z.string().optional().nullable(),
        cvText: z.string().optional().nullable(),
        resumoProfissional: z.string().optional().nullable(),
        obs: z.string().optional().nullable(),
        lastMatch: z
            .object({
                score: z.number().optional().nullable(),
                pass: z.boolean().optional().nullable(),
                at: z.string().optional().nullable(),
                atUtc: z.string().optional().nullable(),
                vagaId: z.string().optional().nullable(),
            })
            .optional()
            .nullable(),
        documentos: z.array(DocumentoSchema).optional().nullable(),
        updatedAt: z.string().optional().nullable(),
        updatedAtUtc: z.string().optional().nullable(),
        createdAt: z.string().optional().nullable(),
        createdAtUtc: z.string().optional().nullable(),
        talentoId: z.string().optional().nullable(),
        applicationRecruiterUserId: z.string().optional().nullable(),
        applicationRecruiterUserName: z.string().optional().nullable(),
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

/* ─── Agendas ─── */

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
    typeLabel: z.string().optional().nullable(),
    typeColor: z.string().optional().nullable(),
    typeIcon: z.string().optional().nullable(),
});

export type AgendaEventApi = z.infer<typeof AgendaEventApiSchema>;

export const AgendaCandidatoListItemSchema = z.object({
    id: z.string(),
    nome: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
});

export type AgendaCandidatoListItem = z.infer<typeof AgendaCandidatoListItemSchema>;

export const AgendaVagaListItemSchema = z.object({
    id: z.string(),
    titulo: z.string().optional().nullable(),
    codigo: z.string().optional().nullable(),
});

export type AgendaVagaListItem = z.infer<typeof AgendaVagaListItemSchema>;
