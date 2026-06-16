/** Mapa enum → valor numérico (espelha SolicitacaoStatus no backend). */
const SOLICITACAO_STATUS_NUMBERS: Record<string, string> = {
    Rascunho: "0",
    PendenteAprovacao: "1",
    Aprovada: "2",
    Reprovada: "3",
    AjustesNecessarios: "4",
    PendenteAprovacaoRh: "5",
    Cancelada: "6",
    EmIntegracao: "7",
    Concluida: "8",
    PendenteAprovacaoAumentoHC: "10",
    PendenteTriagem: "11",
    EmTriagem: "12",
    DevolvidaTriagemGestor: "13",
    PendenteIntegracaoRm: "14",
    ErroIntegracaoRm: "15",
    AguardandoReprocessamentoRm: "16",
    EmProcessoSeletivo: "17",
    Suspensa: "18",
    EncerradaSemContratacao: "19",
    ContratacaoConcluida: "20",
    EmAndamento: "21",
};

export type SolicitacaoVagaContagens = {
    ativas: number;
    aprovadas: number;
    reprovadas: number;
    canceladas: number;
    todas: number;
    aguardandoDistribuicao: number;
    statusAtivosKeys: string[];
    statusAprovadosKeys: string[];
};

export function expandStatusKeys(keys: string[]): Set<string> {
    const set = new Set<string>();
    for (const key of keys) {
        set.add(key);
        const num = SOLICITACAO_STATUS_NUMBERS[key];
        if (num) set.add(num);
    }
    return set;
}

export const EMPTY_SOLICITACAO_CONTAGENS: SolicitacaoVagaContagens = {
    ativas: 0,
    aprovadas: 0,
    reprovadas: 0,
    canceladas: 0,
    todas: 0,
    aguardandoDistribuicao: 0,
    statusAtivosKeys: [],
    statusAprovadosKeys: [],
};
