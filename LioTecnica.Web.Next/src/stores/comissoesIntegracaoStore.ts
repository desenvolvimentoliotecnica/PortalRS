import { create } from "zustand";

export interface ComissaoIntegracaoItem {
    id: string;
    nome: string;
    cpf: string | null;
    competencia: string;
    valorBruto: number;
    approvedAtUtc: string | null;
    integracaoResultado: number | null; // null=Pendente, 1=Sucesso
    integracaoMensagem: string | null;
    comunicadoEmUtc: string | null;
}

interface ComissoesIntegracaoStore {
    items: ComissaoIntegracaoItem[];
    addApproved: (item: ComissaoIntegracaoItem) => void;
    markCommunicated: (id: string, mensagem: string, comunicadoEmUtc: string) => void;
}

export const useComissoesIntegracaoStore = create<ComissoesIntegracaoStore>((set) => ({
    items: [],
    addApproved: (item) =>
        set((s) => ({
            items: s.items.some((i) => i.id === item.id) ? s.items : [...s.items, item],
        })),
    markCommunicated: (id, mensagem, comunicadoEmUtc) =>
        set((s) => ({
            items: s.items.map((i) =>
                i.id === id
                    ? { ...i, integracaoResultado: 1, integracaoMensagem: mensagem, comunicadoEmUtc }
                    : i
            ),
        })),
}));
