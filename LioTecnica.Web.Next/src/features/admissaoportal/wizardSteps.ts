import { sortDocumentosSolicitados, type DocSolicitadoItem } from "./admissaoDocumentoCatalog";
import { DADOS_FORM_SECTIONS, type DadosSectionId } from "./dadosFormSections";
import { TIPOS_COM_VERSO } from "./constants";
import type { UploadedDoc } from "./useAdmissaoWizardStore";

export type WizardStepKind = "welcome" | "document" | "dados" | "dependentes" | "review";

export interface WizardStepInfo {
    kind: WizardStepKind;
    doc?: DocSolicitadoItem;
    docIndex?: number;
    dadosSectionId?: DadosSectionId;
    dadosSectionIndex?: number;
}

export interface WizardSidebarItem {
    step: number;
    label: string;
    isDocumentGroup?: boolean;
    documentEndStep?: number;
    isDadosGroup?: boolean;
    dadosEndStep?: number;
}

export interface WizardPlan {
    documentSteps: DocSolicitadoItem[];
    dadosSections: typeof DADOS_FORM_SECTIONS;
    totalSteps: number;
    docsStartStep: number;
    dadosStartStep: number;
    dadosEndStep: number;
    /** @deprecated use dadosStartStep */
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
    const dadosStartStep = docsStartStep + documentSteps.length;
    const dadosEndStep = dadosStartStep + DADOS_FORM_SECTIONS.length - 1;
    const dependentesStep = dadosEndStep + 1;
    const reviewStep = dependentesStep + 1;
    const totalSteps = reviewStep + 1;

    function resolveStep(step: number): WizardStepInfo {
        if (step <= 0) return { kind: "welcome" };
        if (step < dadosStartStep) {
            const docIndex = step - docsStartStep;
            return { kind: "document", docIndex, doc: documentSteps[docIndex] };
        }
        if (step <= dadosEndStep) {
            const dadosSectionIndex = step - dadosStartStep;
            const section = DADOS_FORM_SECTIONS[dadosSectionIndex];
            return {
                kind: "dados",
                dadosSectionId: section.id,
                dadosSectionIndex,
            };
        }
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
                return DADOS_FORM_SECTIONS[info.dadosSectionIndex ?? 0]?.label ?? "Seus Dados";
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
            documentEndStep: dadosStartStep - 1,
        },
        {
            step: dadosStartStep,
            label: `Seus Dados (${DADOS_FORM_SECTIONS.length})`,
            isDadosGroup: true,
            dadosEndStep,
        },
        { step: dependentesStep, label: "Dependentes" },
        { step: reviewStep, label: "Revisão e Envio" },
    ];

    function migrateLegacyStep(saved: number): number {
        if (saved <= 0) return 0;
        // Formato antigo: 0 welcome, 1 todos docs, 2 dados, 3 dep, 4 review
        if (saved <= 4 && documentSteps.length > 0) {
            if (saved === 0) return 0;
            if (saved === 1) return docsStartStep;
            if (saved === 2) return dadosStartStep;
            if (saved === 3) return dependentesStep;
            if (saved === 4) return reviewStep;
        }
        // Wizard anterior: um único step "dados" em dadosStartStep
        const oldDependentesStep = dadosStartStep + 1;
        if (saved === oldDependentesStep) return dependentesStep;
        return Math.min(Math.max(0, saved), totalSteps - 1);
    }

    return {
        documentSteps,
        dadosSections: DADOS_FORM_SECTIONS,
        totalSteps,
        docsStartStep,
        dadosStartStep,
        dadosEndStep,
        dadosStep: dadosStartStep,
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
