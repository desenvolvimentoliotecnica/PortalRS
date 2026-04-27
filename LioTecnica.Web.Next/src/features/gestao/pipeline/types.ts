/**
 * Tipos do pipeline operacional de vagas — espelha os DTOs do backend
 * (VagaPipelineResponse / VagaPipelineColuna / VagaPipelineItem).
 *
 * Origem 0=Manual, 1=AumentoQuadro, 2=SubstituicaoDesligamento, 3=SubstituicaoPromocao, 4=Direta.
 * Status segue o enum VagaStatus do backend.
 * Semaforo: "verde" | "amarelo" | "vermelho".
 */

export type VagaOrigemTipo = 0 | 1 | 2 | 3 | 4;

export const VAGA_ORIGEM_LABEL: Record<VagaOrigemTipo, string> = {
    0: "Manual",
    1: "Aumento de Quadro",
    2: "Substituição (Desligamento)",
    3: "Substituição (Promoção)",
    4: "Direta",
};

export const VAGA_ORIGEM_BADGE: Record<VagaOrigemTipo, string> = {
    0: "bg-zinc-500/15 text-zinc-700",
    1: "bg-emerald-500/15 text-emerald-700",
    2: "bg-amber-500/15 text-amber-700",
    3: "bg-violet-500/15 text-violet-700",
    4: "bg-sky-500/15 text-sky-700",
};

export interface VagaPipelineItem {
    id: string;
    codigo: string | null;
    titulo: string;
    origem: VagaOrigemTipo;
    centroCustoNome: string | null;
    funcaoNomeRm: string | null;
    status: number;
    dataAbertura: string | null;
    diasNoEstagio: number;
    totalCandidatos: number;
    candidatosAtivos: number;
    isZumbi: boolean;
    ciclosAusenteRm: number;
    semaforo: "verde" | "amarelo" | "vermelho";
    urgente: boolean;
}

export interface VagaPipelineColuna {
    estagio: number;
    nome: string;
    total: number;
    vagas: VagaPipelineItem[];
}

export interface VagaPipelineResponse {
    colunas: VagaPipelineColuna[];
    total: number;
}

export interface VagaPipelineFiltros {
    origem?: VagaOrigemTipo;
    centroCustoId?: string;
    q?: string;
    incluirZumbis?: boolean;
}
