"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    admissaoPortalFetch,
    saveAdmissaoPortalSession,
    getAdmissaoPortalSession,
    clearAdmissaoPortalSession,
    saveWizardProgress,
    type AdmissaoPortalSession,
} from "./publicApi";
import { type DadosPessoais as WizardDadosPessoais, useAdmissaoWizardStore } from "./useAdmissaoWizardStore";
import WizardLayout from "./components/WizardLayout";
import WizardSidebar from "./components/WizardSidebar";
import WelcomeStep from "./steps/WelcomeStep";
import DocumentUploadStep from "./steps/DocumentUploadStep";
import ReviewDataStep from "./steps/ReviewDataStep";
import DependentsStep from "./steps/DependentsStep";
import ReviewStep from "./steps/ReviewStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    FileText, CheckCircle2, Loader2, AlertCircle, LogOut,
} from "lucide-react";
import { validatePortalForm, validateDependentsStep, formatPortalValidationMessage, formatMissingDocumentsMessage } from "./portalValidation";
import { buildWizardPlan, validateSingleDocument } from "./wizardSteps";

/* types */
interface DocSolicitado { tipo: number; label: string; obrigatorio: boolean; jaEnviado: boolean; }
interface DocEnviado { id: string; tipo: number; lado: number; nomeArquivo: string; tamanhoBytes: number; status: number; observacaoRh: string | null; presignedUrl: string; createdAtUtc?: string; }
interface DadosPessoais { [key: string]: unknown; }
interface DependenteData { id: string; nomeCompleto: string; parentesco: number; cpf: string | null; dataNascimento: string; isPcd: boolean; }
interface PortalData {
    preAdmissaoId: string; nome: string; status: number;
    documentosSolicitados: DocSolicitado[];
    documentosEnviados: DocEnviado[];
    dadosPessoais: DadosPessoais;
    dependentes: DependenteData[];
    wizardCurrentStep: number | null;
    wizardCompletionPercent: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentoAdmissaoScreen() {
    const params = useSearchParams();
    const tenantId = params.get("tenantId") ?? "";
    const preAdmissaoId = params.get("preAdmissaoId") ?? "";

    const [phase, setPhase] = useState<"login" | "main" | "submitted">("login");
    const [session, setSession] = useState<AdmissaoPortalSession | null>(null);
    const [cpfInput, setCpfInput] = useState("");
    const [logging, setLogging] = useState(false);
    const [data, setData] = useState<PortalData | null>(null);
    const [loading, setLoading] = useState(false);
    // Prevents saveWizardProgress from overwriting the server step before loadData has restored it
    const hydratedRef = useRef(false);
    const stepMigratedRef = useRef(false);

    const {
        currentStep,
        formData,
        reset,
        setDependentes,
        setFormData,
        setHasDependentes,
        setStep,
        setWizardTotalSteps,
        setUploadedDoc,
        setUploadedDocVerso,
        computeCompletionPercent,
        uploadedDocs,
        uploadedDocsVerso,
        hasDependentes,
        dependentes,
        setLastSavedAt,
    } = useAdmissaoWizardStore();

    const wizardPlan = useMemo(
        () => buildWizardPlan(data?.documentosSolicitados ?? []),
        [data?.documentosSolicitados],
    );

    // Sincroniza total de etapas e migra step legado uma vez após carregar dados
    useEffect(() => {
        if (!data) return;
        setWizardTotalSteps(wizardPlan.totalSteps);
        if (!stepMigratedRef.current && data.wizardCurrentStep != null) {
            stepMigratedRef.current = true;
            setStep(wizardPlan.migrateLegacyStep(data.wizardCurrentStep));
        }
    }, [data, wizardPlan, setWizardTotalSteps, setStep]);

    // Check existing session
    useEffect(() => {
        if (!tenantId) return;
        const existing = getAdmissaoPortalSession(tenantId);
        if (existing && existing.preAdmissaoId === preAdmissaoId) {
            setSession(existing);
            setPhase("main");
        }
    }, [tenantId, preAdmissaoId]);

    // Load data when in main phase
    const loadData = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}`, session.cpf);
            if (!res.ok) {
                const body = await res.json().catch(() => null) as { message?: string } | null;
                if (res.status === 401) {
                    clearAdmissaoPortalSession(session.tenantId);
                    setSession(null);
                    reset();
                    hydratedRef.current = false;
                    setPhase("login");
                    toast.error(body?.message || "Sessão expirada ou CPF não confere. Informe o CPF novamente.");
                    return;
                }
                toast.error(body?.message || "Erro ao carregar dados.");
                return;
            }
            const body = await res.json() as PortalData;
            setData(body);

            // Hydrate store
            setFormData(body.dadosPessoais as Partial<WizardDadosPessoais>);
            setDependentes(body.dependentes ?? []);
            if (body.dependentes && body.dependentes.length > 0) setHasDependentes(true);
            hydratedRef.current = true;

            // Hydrate uploaded docs — roteia frente/verso para slots corretos
            const storeSnapshot = useAdmissaoWizardStore.getState();
            for (const doc of body.documentosEnviados) {
                const existingFrente = storeSnapshot.uploadedDocs.get(doc.tipo);
                const existingVerso = storeSnapshot.uploadedDocsVerso.get(doc.tipo);
                const isVerso = doc.lado === 2;
                const existing = isVerso ? existingVerso : existingFrente;
                const serverUrl = doc.presignedUrl?.trim() || "";
                const previewUrl = serverUrl || existing?.thumbnail || existing?.presignedUrl;

                const docData = {
                    id: doc.id,
                    tipo: doc.tipo,
                    nomeArquivo: doc.nomeArquivo,
                    tamanhoBytes: doc.tamanhoBytes,
                    status: doc.status,
                    presignedUrl: previewUrl,
                    thumbnail: existing?.thumbnail,
                    createdAtUtc: doc.createdAtUtc,
                };
                if (doc.lado === 2) { // Verso = 2
                    setUploadedDocVerso(doc.tipo, docData);
                } else { // Frente = 1 ou Unico = 0
                    setUploadedDoc(doc.tipo, docData);
                }
            }
        } catch { toast.error("Erro de conexao."); }
        finally { setLoading(false); }
    }, [reset, session, setDependentes, setFormData, setHasDependentes, setStep, setUploadedDoc, setUploadedDocVerso]);

    useEffect(() => {
        if (phase === "main" && session) void loadData();
    }, [phase, session, loadData]);

    // Save wizard progress on step change — only after loadData has hydrated the store
    useEffect(() => {
        if (!session || phase !== "main" || !hydratedRef.current) return;
        const percent = computeCompletionPercent();
        saveWizardProgress(session, currentStep, percent).catch(() => {});
    }, [computeCompletionPercent, currentStep, session, phase]);

    async function handleLogin() {
        if (!cpfInput.trim() || !tenantId || !preAdmissaoId) return;
        setLogging(true);
        try {
            const headers = new Headers();
            headers.set("X-Tenant-Id", tenantId);
            headers.set("Content-Type", "application/json");
            const res = await apiFetch("/api/public/admissao-portal/login", {
                method: "POST",
                headers,
                body: JSON.stringify({ preAdmissaoId, cpf: cpfInput.trim() }),
            });
            if (!res.ok) { toast.error("CPF nao reconhecido ou acesso nao liberado."); return; }
            const body = await res.json();
            const sess: AdmissaoPortalSession = { tenantId, preAdmissaoId: body.preAdmissaoId, cpf: cpfInput.replace(/\D/g, ""), nome: body.nome };
            saveAdmissaoPortalSession(sess);
            setSession(sess);
            reset();
            hydratedRef.current = false;
            stepMigratedRef.current = false;
            setPhase("main");
        } catch { toast.error("Erro ao conectar."); }
        finally { setLogging(false); }
    }

    async function handleWizardNext(): Promise<boolean> {
        if (!session || !data) return true;

        const stepInfo = wizardPlan.resolveStep(currentStep);

        switch (stepInfo.kind) {
            case "welcome":
                return true;

            case "document": {
                if (!stepInfo.doc) return true;
                const missingDocs = validateSingleDocument(
                    stepInfo.doc,
                    uploadedDocs,
                    uploadedDocsVerso,
                    data.documentosEnviados,
                );
                if (missingDocs.length > 0) {
                    toast.error(formatMissingDocumentsMessage(missingDocs));
                    return false;
                }
                return true;
            }

            case "dados": {
                const errors = validatePortalForm(formData as Record<string, unknown>);
                if (errors.length > 0) {
                    toast.error(formatPortalValidationMessage(errors));
                    return false;
                }
                try {
                    await admissaoPortalFetch(
                        session.tenantId,
                        `/api/public/admissao-portal/${session.preAdmissaoId}/dados`,
                        session.cpf,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(formData),
                        },
                    );
                    setLastSavedAt(new Date());
                } catch {
                    toast.error("Erro ao salvar seus dados. Tente novamente.");
                    return false;
                }
                return true;
            }

            case "dependentes": {
                const depError = validateDependentsStep(hasDependentes, dependentes.length);
                if (depError) {
                    toast.error(depError);
                    return false;
                }
                return true;
            }

            default:
                return true;
        }
    }

    async function handleSubmit() {
        if (!session) return;

        // Fallback de segurança — ReviewStep já bloqueia e exibe painel inline
        const missing = validatePortalForm(formData as Record<string, unknown>);
        if (missing.length > 0) {
            toast.error(formatPortalValidationMessage(missing));
            setStep(wizardPlan.dadosStep);
            return;
        }

        // Save form data one final time
        await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/dados`, session.cpf, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        // Submit
        const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/submit`, session.cpf, { method: "POST" });
        if (!res.ok) {
            const b = await res.json().catch(() => ({}));
            toast.error(b.message || "Erro ao enviar.");
            return;
        }
        setPhase("submitted");
    }

    function handleLogout() {
        if (tenantId) clearAdmissaoPortalSession(tenantId);
        setSession(null);
        reset();
        setPhase("login");
        setCpfInput("");
    }

    if (!tenantId || !preAdmissaoId) {
        return (
            <div className="flex-1 flex items-start justify-center px-4 py-10">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-border/40 bg-card p-5 sm:p-8 shadow-sm text-center space-y-4">
                    <div className="mx-auto size-16 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="size-8 text-red-500" />
                    </div>
                    <p className="text-lg font-medium">Link invalido</p>
                    <p className="text-sm text-muted-foreground">Verifique o link recebido do RH e tente novamente.</p>
                </div>
            </div>
            </div>
        );
    }

    /* LOGIN */
    if (phase === "login") {
        return (
            <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-14">
            <div className="w-full max-w-md py-0">
                <div className="rounded-xl border border-border/40 bg-card p-5 sm:p-8 shadow-sm space-y-6">
                    <div className="text-center">
                        <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <FileText className="size-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Portal de Admissao</h1>
                        <p className="text-muted-foreground text-sm mt-1">Informe seu CPF para acessar o portal</p>
                    </div>
                    <div className="space-y-3">
                        <Input
                            placeholder="000.000.000-00"
                            value={cpfInput}
                            onChange={e => setCpfInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleLogin()}
                            maxLength={14}
                            className="text-center text-lg tracking-wider h-12"
                        />
                        <Button className="w-full min-h-[48px] text-base" size="lg" onClick={handleLogin} disabled={logging || !cpfInput.trim()}>
                            {logging ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                            Acessar Portal
                        </Button>
                    </div>
                </div>
            </div>
            </div>
        );
    }

    /* SUBMITTED */
    if (phase === "submitted") {
        return (
            <div className="flex-1 flex items-start justify-center px-4 py-10">
            <div className="w-full max-w-md">
                <div className="rounded-xl border border-border/40 bg-card p-5 sm:p-8 shadow-sm text-center space-y-4">
                    <div className="mx-auto size-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="size-10 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold">Dados Enviados!</h1>
                    <p className="text-muted-foreground">Seus documentos e dados foram enviados com sucesso. O RH entrara em contato em breve.</p>
                    <Button variant="outline" size="lg" onClick={handleLogout}>Voltar ao inicio</Button>
                </div>
            </div>
            </div>
        );
    }

    /* MAIN — Wizard */
    const isSubmitted = data?.status === 2;
    const stepInfo = wizardPlan.resolveStep(currentStep);
    const isWelcome = stepInfo.kind === "welcome";
    const isDocument = stepInfo.kind === "document";
    const isReview = stepInfo.kind === "review";
    const docCount = wizardPlan.documentSteps.length;

    return (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Sidebar (desktop only) */}
            {data && (
                <WizardSidebar nome={session?.nome} isSubmitted={isSubmitted} plan={wizardPlan} />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col px-4 sm:px-8 py-4 pb-[4.5rem] overflow-hidden">
                {/* Mobile top bar: candidato + logout */}
                <div className="lg:hidden flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold truncate">{session?.nome || "Candidato"}</span>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="size-4" />
                    </Button>
                </div>
                {/* Desktop top bar: logout only */}
                <div className="hidden lg:flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="size-4 mr-1" />
                        <span className="text-xs">Sair</span>
                    </Button>
                </div>

                {isSubmitted && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4 dark:bg-blue-900/20 dark:border-blue-800">
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Seus dados ja foram enviados e estao em revisao pelo RH.
                        </p>
                    </div>
                )}

                {loading && !data ? (
                    <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
                ) : data ? (
                    <WizardLayout
                        plan={wizardPlan}
                        hideNext={isReview}
                        hideBack={isWelcome}
                        hideStepHeader={isWelcome || isDocument}
                        contentScrollable={stepInfo.kind === "dados" || stepInfo.kind === "dependentes" || isReview}
                        nextLabel={isWelcome ? "Começar" : "Continuar"}
                        onNext={handleWizardNext}
                    >
                        {isWelcome && (
                            <WelcomeStep nome={data.nome} documentCount={docCount} />
                        )}
                        {isDocument && session && stepInfo.doc && (
                            <DocumentUploadStep
                                session={session}
                                documentosSolicitados={data.documentosSolicitados}
                                onDataRefresh={loadData}
                                disabled={isSubmitted}
                                activeDocument={stepInfo.doc}
                                docIndex={(stepInfo.docIndex ?? 0) + 1}
                                totalDocs={docCount}
                            />
                        )}
                        {stepInfo.kind === "dados" && session && (
                            <ReviewDataStep session={session} disabled={isSubmitted} />
                        )}
                        {stepInfo.kind === "dependentes" && session && (
                            <DependentsStep session={session} disabled={isSubmitted} />
                        )}
                        {isReview && (
                            <ReviewStep onSubmit={handleSubmit} disabled={isSubmitted} />
                        )}
                    </WizardLayout>
                ) : null}
            </div>
        </div>
    );
}
