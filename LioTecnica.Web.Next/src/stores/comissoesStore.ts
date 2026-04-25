import { create } from "zustand";

export type ComissaoStatus =
    | "Rascunho"
    | "PendenteAprovacao"
    | "PendenteAprovacaoRh"
    | "Aprovada"
    | "Reprovada"
    | "AjustesNecessarios"
    | "Comunicada";

export interface ComissaoEtapa {
    ordem: number;
    label: string;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    roleFilaId: string | null;
    roleFilaNome: string | null;
    status: "Pendente" | "Aprovado" | "Reprovado" | "Cancelado";
    dataUtc: string | null;
    observacao: string | null;
}

export interface Comissao {
    id: string;
    status: ComissaoStatus;
    solicitanteId: string;
    solicitanteNome: string | null;
    importadoPorId: string | null;
    importadoPorNome: string | null;
    importadaEmUtc: string | null;
    funcionarioId: string;
    funcionarioNome: string | null;
    tipoPagamentoExtra: number;
    valor: number;
    descricao: string;
    dataPagamento: string;
    competencia: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    approvedAtUtc: string | null;
    integracaoResultado: number | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
    etapas: ComissaoEtapa[];
}

interface ComissoesStore {
    items: Comissao[];
    setItems: (items: Comissao[]) => void;
    updateItem: (id: string, patch: Partial<Comissao>) => void;
    addItems: (novas: Comissao[]) => void;
    removeItem: (id: string) => void;
}

export const useComissoesStore = create<ComissoesStore>((set) => ({
    items: [],
    setItems: (items) => set({ items }),
    updateItem: (id, patch) =>
        set((s) => ({
            items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
    addItems: (novas) =>
        set((s) => ({ items: [...novas, ...s.items] })),
    removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
