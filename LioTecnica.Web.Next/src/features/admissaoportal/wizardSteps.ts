import { sortDocumentosSolicitados, type DocSolicitadoItem } from "./admissaoDocumentoCatalog";
import type { UploadedDoc } from "./useAdmissaoWizardStore";
import {
    validateRequiredDocuments,
    type DocEnviadoForValidation,
} from "./portalValidation";

export type WizardStepKind =
    | "welcome"
    | "dados-pessoais"
    | "documentos"
    | "revisao"
    | "conclusao";

export interface MainWizardStep {
    step: number;
    kind: Exclude<WizardStepKind, "welcome">;
    label: string;
    subtitle: string;
}

/** 4 etapas principais (steps 1–4). Step 0 = boas-vindas. */
export const MAIN_WIZARD_STEPS: MainWizardStep[] = [
    { step: 1, kind: "dados-pessoais", label: "Dados Pessoais", subtitle: "Informações básicas" },
    { step: 2, kind: "documentos", label: "Documentos", subtitle: "Envio de documentos" },
    { step: 3, kind: "revisao", label: "Revisão", subtitle: "Confira seus dados" },
    { step: 4, kind: "conclusao", label: "Conclusão", subtitle: "Finalizar processo" },
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
    2: "documentos",
    3: "revisao",
    4: "conclusao",
};

export function buildWizardPlan(documentosSolicitados: DocSolicitadoItem[]): WizardPlan {
    const documentSteps = sortDocumentosSolicitados(
        documentosSolicitados.filter((d) => d.obrigatorio),
    );
    const totalSteps = 5; // 0 welcome + 4 main

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
        if (isSubmitted) return 4;
        if (saved <= 0) return 0;

        // Formato atual (0–4)
        if (saved <= 4) return saved;

        // Formato anterior (0–6 com gerais/bancários): 1 pessoal, 2 gerais, 3 docs, 4 banc, 5 rev, 6 conclusão
        if (saved === 1) return 1;
        if (saved === 2) return 1;
        if (saved === 3) return 2;
        if (saved === 4) return 1;
        if (saved === 5) return 3;
        if (saved >= 6) return isSubmitted ? 4 : 3;

        // Formato legado expandido (docs individuais)
        const oldDocsStart = 1;
        const oldDadosStart = oldDocsStart + Math.max(documentSteps.length, 1);
        if (saved < oldDadosStart) return 2;
        if (saved >= oldDadosStart + 10) return 3;

        return Math.min(saved, 4);
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
    enviados: DocEnviadoForValidation[] = [],
): string[] {
    return validateRequiredDocuments(docs, uploadedDocs, uploadedDocsVerso, enviados);
}

/** @deprecated use validateAllDocuments */
export function validateSingleDocument(
    doc: DocSolicitadoItem,
    uploadedDocs: Map<number, UploadedDoc>,
    uploadedDocsVerso: Map<number, UploadedDoc>,
    enviados: DocEnviadoForValidation[] = [],
): string[] {
    return validateAllDocuments([doc], uploadedDocs, uploadedDocsVerso, enviados);
}
