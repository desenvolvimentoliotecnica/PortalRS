"use client";

import { create } from "zustand";
import type { DependenteResponse } from "./publicApi";

export interface DadosPessoais {
    [key: string]: unknown;
    // Pessoal
    nome?: string | null; nomeSocial?: string | null; nomeAbreviado?: string | null;
    cpf?: string | null; rg?: string | null; rgOrgaoExpedidor?: string | null;
    rgUfExpedidor?: string | null; rgDataExpedicao?: string | null;
    // RIC (Registro Identidade Civil)
    regIdentidCivilNumero?: string | null; regIdentidCivilUf?: string | null;
    regIdentidCivilCidade?: string | null; regIdentidCivilOrgEmiss?: string | null;
    regIdentidCivilDataExped?: string | null;
    dataNascimento?: string | null; sexo?: number | null; estadoCivil?: number | null;
    nacionalidade?: string | null; paisNacionalidade?: string | null;
    nomeMae?: string | null; nomePai?: string | null;
    paisNascimento?: string | null; naturalCidade?: string | null; naturalUf?: string | null;
    grauInstrucao?: number | null; funcDoador?: string | null;
    origemFuncionario?: number | null;
    // Endereco
    cep?: string | null; logradouro?: string | null; numero?: string | null;
    complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
    pontoReferencia?: string | null; resideExterior?: string | null;
    // Códigos IBGE — preenchidos automaticamente via ViaCEP/lookup, obrigatórios TOTVS/eSocial
    municipioEnderecoIbge?: number | null;
    municipioNascimentoIbge?: number | null;
    // Contato
    email?: string | null; emailAlternativo?: string | null;
    telefone?: string | null; celular?: string | null;
    dddTelefone?: number | null; dddTelContato?: number | null;
    contatoEmergenciaNome?: string | null; contatoEmergenciaFone?: string | null;
    // Bancario
    bancoCodigo?: string | null; bancoNome?: string | null; agencia?: string | null;
    agenciaDigito?: string | null; conta?: string | null; contaDigito?: string | null; tipoConta?: number | null;
    // Trabalhista
    pisPasep?: string | null; ctps?: string | null; ctpsSerie?: string | null; ctpsUf?: string | null; ctpsModelo?: number | null;
    // Titulo Eleitor
    tituloEleitorNumero?: string | null; tituloEleitorZona?: string | null; tituloEleitorSecao?: string | null;
    tituloEleitorCidade?: string | null; tituloEleitorUf?: string | null;
    // CNH
    cnhNumero?: string | null; categoriaCnh?: string | null; cnhUf?: string | null;
    cnhOrgaoEmissor?: string | null; cnhDataExpedicao?: number | null; cnhPrimeiraHabilitacao?: number | null;
    validadeCnh?: string | null;
    // Reservista / Doc Militar
    reservistaNumero?: string | null;
    docMilitarTipo?: number | null; docMilitarNumero?: string | null; docMilitarSerie?: string | null;
    docMilitarRegiao?: number | null; docMilitarCircunscricao?: number | null;
    // Estrangeiro
    passaporte?: string | null; rnmRne?: string | null; validadeVisto?: string | null; tipoVisto?: string | null;
    tipoVistoEstrangeiro?: number | null;
    // CAGED (TOTVS)
    ocorrenciaCAGED?: number | null;
    // Saude e caracteristicas fisicas
    grupoSanguineo?: number | null; fatorRh?: number | null; possuiDeficiencia?: string | null;
    cartaoSus?: string | null; altura?: number | null; peso?: number | null;
    cutis?: number | null; cabelo?: number | null; olhos?: number | null;
    manequim?: number | null; sapato?: number | null;
}

export interface UploadedDoc {
    id?: string;
    tipo: number;
    nomeArquivo: string;
    tamanhoBytes: number;
    status: number;
    presignedUrl?: string;
    thumbnail?: string;
    createdAtUtc?: string;
}

export interface AiExtractionResult {
    tipo: number;
    isValid: boolean;
    confidence: number;
    documentType?: string | null;
    extractedFields: Record<string, string | null>;
    validationMessage: string | null;
    processing: boolean;
}

export const TOTAL_STEPS = 5; // legado — use buildWizardPlan().totalSteps em runtime

export const STEP_LABELS = [
    "Boas-vindas",
    "Documentos",
    "Seus Dados",
    "Dependentes",
    "Revisao e Envio",
];

interface AdmissaoWizardState {
    currentStep: number;
    completedSteps: Set<number>;
    wizardTotalSteps: number;
    formData: DadosPessoais;
    dependentes: DependenteResponse[];
    uploadedDocs: Map<number, UploadedDoc>;
    uploadedDocsVerso: Map<number, UploadedDoc>;
    aiExtractions: Map<number, AiExtractionResult>;
    aiExtractionsVerso: Map<number, AiExtractionResult>;
    isAutoSaving: boolean;
    lastSavedAt: Date | null;
    hasDependentes: boolean | null;

    setStep: (step: number) => void;
    setWizardTotalSteps: (n: number) => void;
    setFormField: (field: string, value: unknown) => void;
    setFormData: (data: Partial<DadosPessoais>) => void;
    mergeAiFields: (fields: Record<string, string | null>) => void;
    overwriteAiFields: (fields: Record<string, string | null>) => void;
    clearFormData: () => void;
    setDependentes: (deps: DependenteResponse[]) => void;
    addDependente: (dep: DependenteResponse) => void;
    updateDependente: (id: string, dep: DependenteResponse) => void;
    removeDependente: (id: string) => void;
    setHasDependentes: (v: boolean) => void;
    setUploadedDoc: (tipo: number, doc: UploadedDoc) => void;
    setUploadedDocVerso: (tipo: number, doc: UploadedDoc) => void;
    removeUploadedDoc: (tipo: number) => void;
    removeUploadedDocVerso: (tipo: number) => void;
    clearAiExtraction: (tipo: number) => void;
    clearAiExtractionVerso: (tipo: number) => void;
    setAiExtraction: (tipo: number, result: AiExtractionResult) => void;
    setAiExtractionVerso: (tipo: number, result: AiExtractionResult) => void;
    markStepComplete: (step: number) => void;
    setAutoSaving: (v: boolean) => void;
    setLastSavedAt: (d: Date) => void;
    computeCompletionPercent: () => number;
    reset: () => void;
}

export const useAdmissaoWizardStore = create<AdmissaoWizardState>((set, get) => ({
    currentStep: 0,
    completedSteps: new Set<number>(),
    wizardTotalSteps: TOTAL_STEPS,
    formData: {},
    dependentes: [],
    uploadedDocs: new Map(),
    uploadedDocsVerso: new Map(),
    aiExtractions: new Map(),
    aiExtractionsVerso: new Map(),
    isAutoSaving: false,
    lastSavedAt: null,
    hasDependentes: null,

    setStep: (step) => set({ currentStep: step }),

    setWizardTotalSteps: (n) => set({ wizardTotalSteps: Math.max(1, n) }),

    setFormField: (field, value) =>
        set((s) => ({ formData: { ...s.formData, [field]: value } })),

    setFormData: (data) =>
        set((s) => ({ formData: { ...s.formData, ...data } })),

    mergeAiFields: (fields) =>
        set((s) => {
            const merged = { ...s.formData };
            for (const [key, value] of Object.entries(fields)) {
                if (value != null && value !== "" && (merged[key] == null || merged[key] === "")) {
                    merged[key] = value;
                }
            }
            return { formData: merged };
        }),

    overwriteAiFields: (fields) =>
        set((s) => {
            const merged = { ...s.formData };
            for (const [key, value] of Object.entries(fields)) {
                if (value != null && value !== "") {
                    merged[key] = value;
                }
            }
            return { formData: merged };
        }),

    clearFormData: () => set({ formData: {} }),

    setDependentes: (deps) => set({ dependentes: deps }),
    addDependente: (dep) => set((s) => ({ dependentes: [...s.dependentes, dep] })),
    updateDependente: (id, dep) =>
        set((s) => ({ dependentes: s.dependentes.map((d) => (d.id === id ? dep : d)) })),
    removeDependente: (id) =>
        set((s) => ({ dependentes: s.dependentes.filter((d) => d.id !== id) })),
    setHasDependentes: (v) => set({ hasDependentes: v }),

    setUploadedDoc: (tipo, doc) =>
        set((s) => {
            const m = new Map(s.uploadedDocs);
            m.set(tipo, doc);
            return { uploadedDocs: m };
        }),

    setUploadedDocVerso: (tipo, doc) =>
        set((s) => {
            const m = new Map(s.uploadedDocsVerso);
            m.set(tipo, doc);
            return { uploadedDocsVerso: m };
        }),

    removeUploadedDoc: (tipo) =>
        set((s) => {
            const m = new Map(s.uploadedDocs);
            m.delete(tipo);
            const ai = new Map(s.aiExtractions);
            ai.delete(tipo);
            return { uploadedDocs: m, aiExtractions: ai };
        }),

    removeUploadedDocVerso: (tipo) =>
        set((s) => {
            const m = new Map(s.uploadedDocsVerso);
            m.delete(tipo);
            const ai = new Map(s.aiExtractionsVerso);
            ai.delete(tipo);
            return { uploadedDocsVerso: m, aiExtractionsVerso: ai };
        }),

    clearAiExtraction: (tipo) =>
        set((s) => {
            const m = new Map(s.aiExtractions);
            m.delete(tipo);
            return { aiExtractions: m };
        }),

    clearAiExtractionVerso: (tipo) =>
        set((s) => {
            const m = new Map(s.aiExtractionsVerso);
            m.delete(tipo);
            return { aiExtractionsVerso: m };
        }),

    setAiExtraction: (tipo, result) =>
        set((s) => {
            const m = new Map(s.aiExtractions);
            m.set(tipo, result);
            return { aiExtractions: m };
        }),

    setAiExtractionVerso: (tipo, result) =>
        set((s) => {
            const m = new Map(s.aiExtractionsVerso);
            m.set(tipo, result);
            return { aiExtractionsVerso: m };
        }),

    markStepComplete: (step) =>
        set((s) => {
            const next = new Set(s.completedSteps);
            next.add(step);
            return { completedSteps: next };
        }),

    setAutoSaving: (v) => set({ isAutoSaving: v }),
    setLastSavedAt: (d) => set({ lastSavedAt: d }),

    computeCompletionPercent: () => {
        const s = get();
        const mainSteps = 4;
        const done = [1, 2, 3, 4].filter(
            (step) => s.completedSteps.has(step) || s.currentStep > step,
        ).length;
        return Math.min(100, Math.round((done / mainSteps) * 100));
    },

    reset: () =>
        set({
            currentStep: 0,
            completedSteps: new Set(),
            wizardTotalSteps: TOTAL_STEPS,
            formData: {},
            dependentes: [],
            uploadedDocs: new Map(),
            uploadedDocsVerso: new Map(),
            aiExtractions: new Map(),
            aiExtractionsVerso: new Map(),
            isAutoSaving: false,
            lastSavedAt: null,
            hasDependentes: null,
        }),
}));
