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
import AdmissaoPortalHeader from "./components/AdmissaoPortalHeader";
import WelcomeStep from "./steps/WelcomeStep";
import DocumentUploadStep from "./steps/DocumentUploadStep";
import DadosPessoaisStep from "./steps/DadosPessoaisStep";
import DadosGeraisStep from "./steps/DadosGeraisStep";
import DadosBancariosStep from "./steps/DadosBancariosStep";
import ReviewStep from "./steps/ReviewStep";
import ConclusaoStep from "./steps/ConclusaoStep";
import AdmissaoHelpModal from "./components/AdmissaoHelpModal";
import { savePortalFormNow } from "./hooks/usePortalFormAutoSave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    FileText, Loader2, AlertCircle, LogOut,
} from "lucide-react";
import { formatMissingDocumentsMessage } from "./portalValidation";
import { buildWizardPlan, validateAllDocuments } from "./wizardSteps";
import {
    resolveLadoDocumentoCode,
    resolveStatusDocumentoCode,
    tipoDocumentoToCode,
} from "@/features/admissao/admissaoDocumentosPadrao";

/* types */
interface DocSolicitado { tipo: number; label: string; obrigatorio: boolean; jaEnviado: boolean; }
interface DocEnviado { id: string; tipo: number | string; lado: number | string; nomeArquivo: string; tamanhoBytes: number; status: number | string; observacaoRh: string | null; presignedUrl: string; createdAtUtc?: string; }
interface DadosPessoais { [key: string]: unknown; }
interface DependenteData { id: string; nomeCompleto: string; parentesco: number; cpf: string | null; dataNascimento: string; isPcd: boolean; }
interface PortalInformacoesVaga {
    cargo?: string | null;
    area?: string | null;
    localTrabalho?: string | null;
    tipoContratacao?: string | null;
    salario?: string | null;
    dataInicioPrevista?: string | null;
}
interface PortalWelcomeContext {
    nomeEmpresa?: string | null;
    logoUrl?: string | null;
    vaga?: PortalInformacoesVaga | null;
}
interface PortalData {
    preAdmissaoId: string; nome: string; status: number;
    documentosSolicitados: DocSolicitado[];
    documentosEnviados: DocEnviado[];
    dadosPessoais: DadosPessoais;
    dependentes: DependenteData[];
    wizardCurrentStep: number | null;
    wizardCompletionPercent: number | null;
    welcome?: PortalWelcomeContext | null;
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
    const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
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
        setLastSavedAt,
        markStepComplete,
    } = useAdmissaoWizardStore();

    const wizardPlan = useMemo(
        () => buildWizardPlan(data?.documentosSolicitados ?? []),
        [data?.documentosSolicitados],
    );

    const rejeicoesPorTipo = useMemo(() => {
        const map = new Map<number, string>();
        for (const d of data?.documentosEnviados ?? []) {
            if (resolveStatusDocumentoCode(d.status) !== 2) continue;
            map.set(tipoDocumentoToCode(d.tipo), d.observacaoRh || "O RH solicitou o reenvio deste documento.");
        }
        return map;
    }, [data?.documentosEnviados]);

    // Sincroniza total de etapas e migra step legado uma vez após carregar dados
    useEffect(() => {
        if (!data) return;
        setWizardTotalSteps(wizardPlan.totalSteps);
        if (stepMigratedRef.current) return;
        stepMigratedRef.current = true;
        const isSubmittedStatus = data.status === 2;
        if (isSubmittedStatus) {
            setSubmittedAt(new Date());
            setStep(6);
            return;
        }
        if (data.wizardCurrentStep != null) {
            setStep(wizardPlan.migrateLegacyStep(data.wizardCurrentStep, false));
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

            // Hydrate uploaded docs — roteia frente/verso para slots corretos (ignora rejeitados)
            const storeSnapshot = useAdmissaoWizardStore.getState();
            for (const doc of body.documentosEnviados) {
                if (resolveStatusDocumentoCode(doc.status) === 2) continue;
                const tipo = tipoDocumentoToCode(doc.tipo);
                const lado = resolveLadoDocumentoCode(doc.lado);
                const existingFrente = storeSnapshot.uploadedDocs.get(tipo);
                const existingVerso = storeSnapshot.uploadedDocsVerso.get(tipo);
                const isVerso = lado === 2;
                const existing = isVerso ? existingVerso : existingFrente;
                const serverUrl = doc.presignedUrl?.trim() || "";
                const previewUrl = serverUrl || existing?.thumbnail || existing?.presignedUrl;

                const docData = {
                    id: doc.id,
                    tipo,
                    nomeArquivo: doc.nomeArquivo,
                    tamanhoBytes: doc.tamanhoBytes,
                    status: resolveStatusDocumentoCode(doc.status),
                    presignedUrl: previewUrl,
                    thumbnail: existing?.thumbnail,
                    createdAtUtc: doc.createdAtUtc,
                };
                if (lado === 2) {
                    setUploadedDocVerso(tipo, docData);
                } else {
                    setUploadedDoc(tipo, docData);
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

            case "dados-pessoais":
            case "dados-gerais":
            case "bancario": {
                try {
                    await savePortalFormNow(session, formData);
                    setLastSavedAt(new Date());
                } catch {
                    toast.error("Erro ao salvar seus dados. Tente novamente.");
                    return false;
                }
                return true;
            }

            case "documentos": {
                const missingDocs = validateAllDocuments(
                    wizardPlan.documentSteps,
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

            case "revisao":
                await handleSubmit();
                return false;

            case "conclusao":
                return false;

            default:
                return true;
        }
    }

    async function handleSaveAndExit() {
        if (!session) return;
        try {
            await savePortalFormNow(session, formData);
            setLastSavedAt(new Date());
            const percent = computeCompletionPercent();
            await saveWizardProgress(session, currentStep, percent);
            toast.success("Progresso salvo. Você pode continuar depois pelo mesmo link.");
        } catch {
            toast.error("Erro ao salvar progresso.");
        }
    }

    async function handleSubmit() {
        if (!session) return;

        await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/dados`, session.cpf, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/submit`, session.cpf, { method: "POST" });
        if (!res.ok) {
            const b = await res.json().catch(() => ({}));
            toast.error(b.message || "Erro ao enviar.");
            return;
        }
        setSubmittedAt(new Date());
        markStepComplete(5);
        setStep(6);
        await loadData();
    }

    function handleWelcomeStart() {
        markStepComplete(0);
        setStep(1);
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

    /* MAIN — Wizard */
    const isSubmitted = data?.status === 2 || currentStep === 6;
    const stepInfo = wizardPlan.resolveStep(currentStep);
    const isWelcome = stepInfo.kind === "welcome";
    const isConclusao = stepInfo.kind === "conclusao";

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
            <AdmissaoPortalHeader
                nomeEmpresa={data?.welcome?.nomeEmpresa}
                logoUrl={data?.welcome?.logoUrl}
                userName={session?.nome ?? data?.nome}
                onLogout={handleLogout}
                onOpenHelp={() => setHelpOpen(true)}
            />

            <AdmissaoHelpModal open={helpOpen} onOpenChange={setHelpOpen} session={session} />

            <div className="flex flex-1 min-h-0 overflow-hidden">
            {data && !isWelcome && (
                <WizardSidebar
                    nome={session?.nome}
                    isSubmitted={isSubmitted}
                    plan={wizardPlan}
                    onOpenHelp={() => setHelpOpen(true)}
                />
            )}

            <div className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${isWelcome ? "" : ""}`}>
                {!isWelcome && (
                    <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <span className="text-sm font-semibold truncate">{session?.nome || "Candidato"}</span>
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="size-4" />
                        </Button>
                    </div>
                )}

                {loading && !data ? (
                    <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
                ) : data ? (
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
                        onSaveAndExit={isWelcome || isConclusao || isSubmitted ? undefined : handleSaveAndExit}
                    >
                        {isWelcome && (
                            <WelcomeStep
                                vaga={data.welcome?.vaga}
                                onStart={handleWelcomeStart}
                                disabled={isSubmitted}
                            />
                        )}
                        {stepInfo.kind === "dados-pessoais" && session && (
                            <DadosPessoaisStep session={session} disabled={isSubmitted} />
                        )}
                        {stepInfo.kind === "dados-gerais" && session && (
                            <DadosGeraisStep session={session} disabled={isSubmitted} />
                        )}
                        {stepInfo.kind === "documentos" && session && (
                            <DocumentUploadStep
                                session={session}
                                documentosSolicitados={data.documentosSolicitados}
                                rejeicoesPorTipo={rejeicoesPorTipo}
                                onDataRefresh={loadData}
                                disabled={isSubmitted}
                            />
                        )}
                        {stepInfo.kind === "bancario" && session && (
                            <DadosBancariosStep session={session} disabled={isSubmitted} />
                        )}
                        {stepInfo.kind === "revisao" && (
                            <ReviewStep
                                disabled={isSubmitted}
                                documentosEnviados={data.documentosEnviados}
                                onEditStep={setStep}
                            />
                        )}
                        {isConclusao && session && (
                            <ConclusaoStep
                                session={session}
                                userName={session?.nome ?? data.nome}
                                userEmail={String(formData.email ?? "")}
                                submittedAt={submittedAt}
                                documentCount={data.documentosEnviados?.length ?? 0}
                            />
                        )}
                    </WizardLayout>
                ) : null}
            </div>
            </div>
        </div>
    );
}
