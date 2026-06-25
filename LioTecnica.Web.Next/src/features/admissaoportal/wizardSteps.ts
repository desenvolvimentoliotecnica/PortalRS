import { sortDocumentosSolicitados, type DocSolicitadoItem } from "./admissaoDocumentoCatalog";
import { TIPOS_COM_VERSO } from "./constants";
import type { UploadedDoc } from "./useAdmissaoWizardStore";

export type WizardStepKind = "welcome" | "document" | "dados" | "dependentes" | "review";

export interface WizardStepInfo {
    kind: WizardStepKind;
    doc?: DocSolicitadoItem;
    docIndex?: number;
}

export interface WizardSidebarItem {
    step: number;
    label: string;
    isDocumentGroup?: boolean;
    documentEndStep?: number;
}

export interface WizardPlan {
    documentSteps: DocSolicitadoItem[];
    totalSteps: number;
    docsStartStep: number;
    dadosStep: number;
    dependentesStep: number;
    reviewStep: number;
    resolveStep: (step: number) => WizardStepInfo;
    stepLabel: (step: number) => string;
    sidebarItems: WizardSidebarItem[];
    migrateLegacyStep: (saved: number) => number;
}

export function buildWizardPlan(documentosSolicitados: DocSolicitadoItem[]): WizardPlan {
    const documentSteps = sortDocumentosSolicitados(
        documentosSolicitados.filter((d) => d.obrigatorio),
    );
    const docsStartStep = 1;
    const dadosStep = docsStartStep + documentSteps.length;
    const dependentesStep = dadosStep + 1;
    const reviewStep = dependentesStep + 1;
    const totalSteps = reviewStep + 1;

    function resolveStep(step: number): WizardStepInfo {
        if (step <= 0) return { kind: "welcome" };
        if (step < dadosStep) {
            const docIndex = step - docsStartStep;
            return { kind: "document", docIndex, doc: documentSteps[docIndex] };
        }
        if (step === dadosStep) return { kind: "dados" };
        if (step === dependentesStep) return { kind: "dependentes" };
        return { kind: "review" };
    }

    function stepLabel(step: number): string {
        const info = resolveStep(step);
        switch (info.kind) {
            case "welcome":
                return "Boas-vindas";
            case "document":
                return info.doc?.label ?? `Documento ${(info.docIndex ?? 0) + 1}`;
            case "dados":
                return "Seus Dados";
            case "dependentes":
                return "Dependentes";
            case "review":
                return "Revisão e Envio";
        }
    }

    const sidebarItems: WizardSidebarItem[] = [
        { step: 0, label: "Boas-vindas" },
        {
            step: docsStartStep,
            label: `Documentos (${documentSteps.length})`,
            isDocumentGroup: true,
            documentEndStep: dadosStep - 1,
        },
        { step: dadosStep, label: "Seus Dados" },
        { step: dependentesStep, label: "Dependentes" },
        { step: reviewStep, label: "Revisão e Envio" },
    ];

    function migrateLegacyStep(saved: number): number {
        if (saved <= 0) return 0;
        // Formato antigo: 0 welcome, 1 todos docs, 2 dados, 3 dep, 4 review
        if (saved <= 4 && documentSteps.length > 0) {
            if (saved === 0) return 0;
            if (saved === 1) return docsStartStep;
            if (saved === 2) return dadosStep;
            if (saved === 3) return dependentesStep;
            if (saved === 4) return reviewStep;
        }
        return Math.min(Math.max(0, saved), totalSteps - 1);
    }

    return {
        documentSteps,
        totalSteps,
        docsStartStep,
        dadosStep,
        dependentesStep,
        reviewStep,
        resolveStep,
        stepLabel,
        sidebarItems,
        migrateLegacyStep,
    };
}

/** Valida um único documento obrigatório (frente + verso quando aplicável). */
export function validateSingleDocument(
    doc: DocSolicitadoItem,
    uploadedDocs: Map<number, UploadedDoc>,
    uploadedDocsVerso: Map<number, UploadedDoc>,
    enviados: { tipo: number; lado: number }[] = [],
): string[] {
    const missing: string[] = [];
    const hasFrente = uploadedDocs.has(doc.tipo)
        || enviados.some((d) => d.tipo === doc.tipo && d.lado !== 2);
    if (!hasFrente) {
        missing.push(doc.label);
        return missing;
    }
    if (TIPOS_COM_VERSO.has(doc.tipo)) {
        const hasVerso = uploadedDocsVerso.has(doc.tipo)
            || enviados.some((d) => d.tipo === doc.tipo && d.lado === 2);
        if (!hasVerso) missing.push(`${doc.label} (verso)`);
    }
    return missing;
}
