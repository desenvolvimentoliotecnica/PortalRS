import { sortDocumentosSolicitados, type DocSolicitadoItem } from "./admissaoDocumentoCatalog";
import { TIPOS_COM_VERSO } from "./constants";
import type { UploadedDoc } from "./useAdmissaoWizardStore";

export type WizardStepKind =
    | "welcome"
    | "dados-pessoais"
    | "dados-gerais"
    | "documentos"
    | "bancario"
    | "revisao"
    | "conclusao";

export interface MainWizardStep {
    step: number;
    kind: Exclude<WizardStepKind, "welcome">;
    label: string;
    subtitle: string;
}

/** 6 etapas principais (steps 1–6). Step 0 = boas-vindas. */
export const MAIN_WIZARD_STEPS: MainWizardStep[] = [
    { step: 1, kind: "dados-pessoais", label: "Dados Pessoais", subtitle: "Informações básicas" },
    { step: 2, kind: "dados-gerais", label: "Dados Gerais", subtitle: "Endereço e contato" },
    { step: 3, kind: "documentos", label: "Documentos", subtitle: "Envio de documentos" },
    { step: 4, kind: "bancario", label: "Informações Bancárias", subtitle: "Dados da conta" },
    { step: 5, kind: "revisao", label: "Revisão", subtitle: "Confira seus dados" },
    { step: 6, kind: "conclusao", label: "Conclusão", subtitle: "Finalizar processo" },
];

export interface WizardStepInfo {
    kind: WizardStepKind;
    mainStep?: MainWizardStep;
}

export interface WizardPlan {
    documentSteps: DocSolicitadoItem[];
    totalSteps: number;
    mainSteps: MainWizardStep[];
    resolveStep: (step: number) => WizardStepInfo;
    stepLabel: (step: number) => string;
    mainStepIndex: (step: number) => number;
    migrateLegacyStep: (saved: number, isSubmitted?: boolean) => number;
}

const STEP_KIND_BY_NUMBER: Record<number, WizardStepKind> = {
    0: "welcome",
    1: "dados-pessoais",
    2: "dados-gerais",
    3: "documentos",
    4: "bancario",
    5: "revisao",
    6: "conclusao",
};

export function buildWizardPlan(documentosSolicitados: DocSolicitadoItem[]): WizardPlan {
    const documentSteps = sortDocumentosSolicitados(
        documentosSolicitados.filter((d) => d.obrigatorio),
    );
    const totalSteps = 7; // 0 welcome + 6 main

    function resolveStep(step: number): WizardStepInfo {
        const clamped = Math.min(Math.max(0, step), totalSteps - 1);
        const kind = STEP_KIND_BY_NUMBER[clamped] ?? "welcome";
        const mainStep = MAIN_WIZARD_STEPS.find((s) => s.step === clamped);
        return { kind, mainStep };
    }

    function stepLabel(step: number): string {
        const info = resolveStep(step);
        if (info.kind === "welcome") return "Boas-vindas";
        return info.mainStep?.label ?? "Portal de Admissão";
    }

    function mainStepIndex(step: number): number {
        if (step <= 0) return -1;
        return Math.min(step - 1, MAIN_WIZARD_STEPS.length - 1);
    }

    function migrateLegacyStep(saved: number, isSubmitted = false): number {
        if (isSubmitted) return 6;
        if (saved <= 0) return 0;

        // Novo formato (0–6)
        if (saved <= 6) return saved;

        // Formato anterior: welcome + N docs + 10 dados + dependentes + review
        const oldDocsStart = 1;
        const oldDadosStart = oldDocsStart + Math.max(documentSteps.length, 1);
        const oldDadosEnd = oldDadosStart + 9;
        const oldDependentes = oldDadosEnd + 1;
        const oldReview = oldDependentes + 1;

        if (saved < oldDadosStart) return 3;
        if (saved <= oldDadosEnd) {
            const sectionIndex = saved - oldDadosStart;
            if (sectionIndex === 0) return 1;
            if (sectionIndex <= 2) return 2;
            if (sectionIndex === 3) return 4;
            return 2;
        }
        if (saved === oldDependentes) return 2;
        if (saved >= oldReview) return 5;

        return Math.min(saved, 6);
    }

    return {
        documentSteps,
        totalSteps,
        mainSteps: MAIN_WIZARD_STEPS,
        resolveStep,
        stepLabel,
        mainStepIndex,
        migrateLegacyStep,
    };
}

/** Valida todos os documentos obrigatórios (etapa Documentos única). */
export function validateAllDocuments(
    docs: DocSolicitadoItem[],
    uploadedDocs: Map<number, UploadedDoc>,
    uploadedDocsVerso: Map<number, UploadedDoc>,
    enviados: { tipo: number; lado: number }[] = [],
): string[] {
    const missing: string[] = [];
    for (const doc of docs.filter((d) => d.obrigatorio)) {
        const hasFrente = uploadedDocs.has(doc.tipo)
            || enviados.some((d) => d.tipo === doc.tipo && d.lado !== 2);
        if (!hasFrente) {
            missing.push(doc.label);
            continue;
        }
        if (TIPOS_COM_VERSO.has(doc.tipo)) {
            const hasVerso = uploadedDocsVerso.has(doc.tipo)
                || enviados.some((d) => d.tipo === doc.tipo && d.lado === 2);
            if (!hasVerso) missing.push(`${doc.label} (verso)`);
        }
    }
    return missing;
}

/** @deprecated use validateAllDocuments */
export function validateSingleDocument(
    doc: DocSolicitadoItem,
    uploadedDocs: Map<number, UploadedDoc>,
    uploadedDocsVerso: Map<number, UploadedDoc>,
    enviados: { tipo: number; lado: number }[] = [],
): string[] {
    return validateAllDocuments([doc], uploadedDocs, uploadedDocsVerso, enviados);
}
