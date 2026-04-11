import { create } from "zustand";

export type ComissaoStatus =
    | "Rascunho"
    | "PendenteAprovacao"
    | "Aprovada"
    | "Reprovada"
    | "AjustesNecessarios"
    | "Comunicada";

export interface Comissao {
    id: string;
    prestadorNome: string;
    prestadorCpf: string;
    competencia: string;
    percentual: number;
    valorBase: number;
    valorBruto: number;
    status: ComissaoStatus;
    observacao: string | null;
    aprovadoPorNome: string | null;
    aprovadoEmUtc: string | null;
    mensagemComunicado: string | null;
    comunicadoEmUtc: string | null;
    createdAtUtc: string;
}

const SEED: Comissao[] = [
    {
        id: "a1", prestadorNome: "Ana Clara Silva", prestadorCpf: "111.222.333-44",
        competencia: "2025-03", percentual: 5, valorBase: 18000, valorBruto: 18900,
        status: "PendenteAprovacao", observacao: null,
        aprovadoPorNome: null, aprovadoEmUtc: null, mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
        id: "a2", prestadorNome: "Bruno Henrique Costa", prestadorCpf: "222.333.444-55",
        competencia: "2025-03", percentual: 7, valorBase: 12000, valorBruto: 12840,
        status: "PendenteAprovacao", observacao: "Referente ao projeto Alpha.",
        aprovadoPorNome: null, aprovadoEmUtc: null, mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
        id: "a3", prestadorNome: "Carla Mendes Ferreira", prestadorCpf: "333.444.555-66",
        competencia: "2025-02", percentual: 4, valorBase: 9500, valorBruto: 9880,
        status: "Aprovada", observacao: null,
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 5 * 86400000).toISOString(),
        mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
        id: "a4", prestadorNome: "Diego Rocha Santos", prestadorCpf: "444.555.666-77",
        competencia: "2025-02", percentual: 6, valorBase: 15000, valorBruto: 15900,
        status: "Comunicada", observacao: null,
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 12 * 86400000).toISOString(),
        mensagemComunicado: "Sua comissão ref. Fev/2025 foi processada. Verifique seu comprovante.",
        comunicadoEmUtc: new Date(Date.now() - 8 * 86400000).toISOString(),
        createdAtUtc: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
        id: "a5", prestadorNome: "Elena Ribeiro Lima", prestadorCpf: "555.666.777-88",
        competencia: "2025-02", percentual: 5, valorBase: 21000, valorBruto: 22050,
        status: "Reprovada", observacao: "Valores divergentes com o relatório contábil.",
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 11 * 86400000).toISOString(),
        mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
        id: "a6", prestadorNome: "Fábio Augusto Nunes", prestadorCpf: "666.777.888-99",
        competencia: "2025-03", percentual: 8, valorBase: 13000, valorBruto: 14040,
        status: "AjustesNecessarios", observacao: "Percentual não confere com o contrato vigente.",
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 3 * 86400000).toISOString(),
        mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
];

interface ComissoesStore {
    items: Comissao[];
    setItems: (items: Comissao[]) => void;
    updateItem: (id: string, patch: Partial<Comissao>) => void;
    addItems: (novas: Comissao[]) => void;
}

export const useComissoesStore = create<ComissoesStore>((set) => ({
    items: SEED,
    setItems: (items) => set({ items }),
    updateItem: (id, patch) =>
        set((s) => ({
            items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
    addItems: (novas) =>
        set((s) => ({ items: [...novas, ...s.items] })),
}));
