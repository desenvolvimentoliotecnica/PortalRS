"use client";

import { useState } from "react";
import {
    Banknote,
    Calendar,
    CheckCircle2,
    Download,
    FileText,
    Loader2,
    User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import WizardStepCard from "../components/WizardStepCard";
import { downloadComprovanteEnvio, isMockPortalSession, type AdmissaoPortalSession } from "../publicApi";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";

interface Props {
    session: AdmissaoPortalSession;
    userName?: string | null;
    userEmail?: string | null;
    submittedAt?: Date | null;
    documentCount?: number;
}

export default function ConclusaoStep({
    session,
    userName,
    userEmail,
    submittedAt,
    documentCount = 0,
}: Props) {
    const { formData } = useAdmissaoWizardStore();
    const [downloading, setDownloading] = useState(false);
    const firstName = userName?.trim().split(/\s+/)[0] || "Candidato";
    const email = userEmail || String(formData.email ?? "");
    const dateStr = submittedAt
        ? submittedAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const handleDownload = async () => {
        if (isMockPortalSession(session)) {
            toast.info("Modo demonstração — comprovante indisponível.");
            return;
        }
        setDownloading(true);
        try {
            await downloadComprovanteEnvio(session);
            toast.success("Comprovante baixado com sucesso.");
        } catch {
            toast.error("Não foi possível baixar o comprovante.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <WizardStepCard
            icon={CheckCircle2}
            title="Processo de admissão concluído!"
            subtitle={`Parabéns, ${firstName}! Você concluiu todas as etapas do processo de admissão com sucesso.`}
        >
            <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="size-10 text-emerald-500" />
                </div>

                <p className="max-w-xl text-sm text-slate-600">
                    Recebemos suas informações e documentos. Nosso time de RH irá analisar seus dados e entrará em contato em breve.
                </p>

                <div className="mt-6 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm text-emerald-800">
                    <p className="font-semibold">E o que acontece agora?</p>
                    <p className="mt-1">
                        Nosso time de RH irá analisar seus dados e documentos. Em breve, entraremos em contato
                        {email ? ` pelo e-mail ${email}` : ""} com os próximos passos.
                    </p>
                </div>

                <div className="mt-8 w-full">
                    <h3 className="mb-4 text-left text-base font-semibold text-slate-900">Resumo do seu envio</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryItem icon={User} title="Dados preenchidos" desc="5 etapas concluídas" />
                        <SummaryItem icon={FileText} title="Documentos enviados" desc={`${documentCount} documento(s)`} />
                        <SummaryItem icon={Banknote} title="Informações bancárias" desc="Conta cadastrada" />
                        <SummaryItem icon={Calendar} title="Data do envio" desc={dateStr} />
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="mt-8 gap-2 rounded-xl"
                    onClick={handleDownload}
                    disabled={downloading}
                >
                    {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Baixar comprovante de envio (PDF)
                </Button>

                <p className="mt-6 text-sm text-slate-600">
                    Agradecemos por completar seu cadastro. <span className="font-semibold">Seja bem-vindo(a)! 🚀</span>
                </p>
            </div>
        </WizardStepCard>
    );
}

function SummaryItem({
    icon: Icon,
    title,
    desc,
}: {
    icon: React.ElementType;
    title: string;
    desc: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left">
            <Icon className="mb-2 size-5 text-[#0047BB]" />
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{desc}</p>
        </div>
    );
}
