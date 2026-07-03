"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";
import { applyBrandingDefaults, fetchPublicBranding } from "@/lib/tenant-branding";
import { createMockPortalSession } from "./publicApi";
import { useAdmissaoWizardStore } from "./useAdmissaoWizardStore";
import { buildWizardPlan } from "./wizardSteps";
import { buildMockDocumentosSolicitados, MOCK_PORTAL_FORM, MOCK_VAGA } from "./mockPortalData";
import WizardLayout from "./components/WizardLayout";
import WizardSidebar from "./components/WizardSidebar";
import AdmissaoPortalHeader from "./components/AdmissaoPortalHeader";
import AdmissaoHelpModal from "./components/AdmissaoHelpModal";
import WelcomeStep from "./steps/WelcomeStep";
import DadosPessoaisStep from "./steps/DadosPessoaisStep";
import DocumentUploadStep from "./steps/DocumentUploadStep";
import ReviewStep from "./steps/ReviewStep";
import ConclusaoStep from "./steps/ConclusaoStep";

interface Props {
    tenantId: string;
}

export default function DocumentoAdmissaoMockScreen({ tenantId }: Props) {
    const session = useMemo(() => createMockPortalSession(tenantId), [tenantId]);
    const documentosSolicitados = useMemo(() => buildMockDocumentosSolicitados(), []);
    const wizardPlan = useMemo(() => buildWizardPlan(documentosSolicitados), [documentosSolicitados]);

    const [helpOpen, setHelpOpen] = useState(false);
    const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
    const [nomeEmpresa, setNomeEmpresa] = useState("Portal de RH");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const {
        currentStep,
        reset,
        setFormData,
        setStep,
        setWizardTotalSteps,
        markStepComplete,
        uploadedDocs,
    } = useAdmissaoWizardStore();

    useEffect(() => {
        reset();
        setFormData(MOCK_PORTAL_FORM);
        setWizardTotalSteps(wizardPlan.totalSteps);
        setStep(0);
    }, [reset, setFormData, setStep, setWizardTotalSteps, wizardPlan.totalSteps, tenantId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const branding = await fetchPublicBranding(tenantId);
            if (cancelled) return;
            const resolved = applyBrandingDefaults(branding);
            setNomeEmpresa(resolved.nomePortal);
            setLogoUrl(resolved.logoUrl);
        })();
        return () => { cancelled = true; };
    }, [tenantId]);

    const stepInfo = wizardPlan.resolveStep(currentStep);
    const isWelcome = stepInfo.kind === "welcome";
    const isConclusao = stepInfo.kind === "conclusao";
    const isSubmitted = currentStep === 4;

    function handleWelcomeStart() {
        markStepComplete(0);
        setStep(1);
    }

    async function handleWizardNext(): Promise<boolean> {
        if (stepInfo.kind === "revisao") {
            setSubmittedAt(new Date());
            markStepComplete(3);
            setStep(4);
            toast.info("Modo demonstração — envio simulado.");
            return false;
        }
        return true;
    }

    function handleClosePreview() {
        window.close();
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
                <span className="inline-flex items-center gap-2 font-medium">
                    <Eye className="size-4 shrink-0" />
                    Modo demonstração — visualização do portal do candidato. Nenhum dado será salvo.
                </span>
            </div>

            <AdmissaoPortalHeader
                nomeEmpresa={nomeEmpresa}
                logoUrl={logoUrl}
                userName={session.nome}
                onLogout={handleClosePreview}
                onOpenHelp={() => setHelpOpen(true)}
            />

            <AdmissaoHelpModal open={helpOpen} onOpenChange={setHelpOpen} session={session} />

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {!isWelcome && (
                    <WizardSidebar
                        nome={session.nome}
                        isSubmitted={isSubmitted}
                        plan={wizardPlan}
                        onOpenHelp={() => setHelpOpen(true)}
                    />
                )}

                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                    {!isWelcome && (
                        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <span className="text-sm font-semibold truncate">{session.nome}</span>
                            <button
                                type="button"
                                onClick={handleClosePreview}
                                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" />
                                Fechar
                            </button>
                        </div>
                    )}

                    <WizardLayout
                        plan={wizardPlan}
                        hideNext={isWelcome || isConclusao}
                        hideBack={isWelcome || isConclusao}
                        hideFooter={isWelcome}
                        showStepper={!isWelcome}
                        isSubmitted={isSubmitted}
                        contentScrollable
                        nextLabel={stepInfo.kind === "revisao" ? "Confirmar e finalizar" : "Continuar"}
                        nextClassName={stepInfo.kind === "revisao" ? "bg-[#0047BB] hover:bg-[#003a99]" : undefined}
                        onNext={handleWizardNext}
                    >
                        {isWelcome && (
                            <WelcomeStep
                                vaga={MOCK_VAGA}
                                onStart={handleWelcomeStart}
                            />
                        )}
                        {stepInfo.kind === "dados-pessoais" && (
                            <DadosPessoaisStep session={session} />
                        )}
                        {stepInfo.kind === "documentos" && (
                            <DocumentUploadStep
                                session={session}
                                documentosSolicitados={documentosSolicitados}
                                onDataRefresh={() => {}}
                            />
                        )}
                        {stepInfo.kind === "revisao" && (
                            <ReviewStep
                                documentosEnviados={Array.from(uploadedDocs.values()).map((d) => ({
                                    tipo: d.tipo,
                                    nomeArquivo: d.nomeArquivo,
                                }))}
                                onEditStep={setStep}
                            />
                        )}
                        {isConclusao && (
                            <ConclusaoStep
                                session={session}
                                userName={session.nome}
                                userEmail={String(MOCK_PORTAL_FORM.email ?? "")}
                                submittedAt={submittedAt}
                                documentCount={uploadedDocs.size}
                            />
                        )}
                    </WizardLayout>
                </div>
            </div>
        </div>
    );
}
