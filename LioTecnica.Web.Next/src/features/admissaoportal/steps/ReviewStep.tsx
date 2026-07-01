"use client";

import React from "react";
import {
    ClipboardList,
    Pencil,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import WizardStepCard from "../components/WizardStepCard";
import { PortalInfoBox } from "../components/PortalField";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { TIPO_DOC_LABELS } from "../constants";
import { tipoDocumentoToCode } from "@/features/admissao/admissaoDocumentosPadrao";

interface Props {
    disabled?: boolean;
    documentosEnviados?: { tipo: number | string; nomeArquivo: string }[];
    onEditStep?: (step: number) => void;
}

export default function ReviewStep({ disabled, documentosEnviados = [], onEditStep }: Props) {
    const { formData, uploadedDocs } = useAdmissaoWizardStore();

    const docsList = documentosEnviados.length > 0
        ? documentosEnviados
        : Array.from(uploadedDocs.values()).map((d) => ({
            tipo: d.tipo,
            nomeArquivo: d.nomeArquivo,
        }));

    return (
        <WizardStepCard
            icon={ClipboardList}
            title="Revisão"
            subtitle="Confira suas informações e documentos antes de finalizar."
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ReviewCard
                    icon={User}
                    title="Dados Pessoais"
                    onEdit={onEditStep ? () => onEditStep(1) : undefined}
                    disabled={disabled}
                >
                    <ReviewRow label="Nome completo" value={formData.nome} />
                    <ReviewRow label="CPF" value={formData.cpf} />
                    <ReviewRow label="Data de nascimento" value={formData.dataNascimento} />
                    <ReviewRow label="RG" value={formData.rg} />
                    <ReviewRow label="Nome da mãe" value={formData.nomeMae} />
                    <ReviewRow label="E-mail" value={formData.email} />
                    <ReviewRow label="Celular" value={formData.celular ?? formData.telefone} />
                </ReviewCard>

                <ReviewCard
                    icon={ClipboardList}
                    title="Documentos"
                    onEdit={onEditStep ? () => onEditStep(2) : undefined}
                    disabled={disabled}
                >
                    {docsList.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhum documento enviado ainda.</p>
                    ) : (
                        docsList.map((doc, i) => {
                            const tipoCode = tipoDocumentoToCode(doc.tipo);
                            return (
                            <div key={`${tipoCode}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-600">{TIPO_DOC_LABELS[tipoCode] ?? "Documento"}</span>
                                <span className="truncate text-slate-900 font-medium max-w-[55%]">{doc.nomeArquivo}</span>
                            </div>
                            );
                        })
                    )}
                </ReviewCard>
            </div>

            <PortalInfoBox>
                Ao confirmar, seus dados serão enviados para análise do RH. Você receberá retorno por e-mail se necessário.
            </PortalInfoBox>
        </WizardStepCard>
    );
}

function ReviewCard({
    icon: Icon,
    title,
    children,
    onEdit,
    disabled,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: React.ReactNode;
    onEdit?: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className="size-4 text-[#0047BB]" />
                    <h3 className="font-semibold text-sm">{title}</h3>
                </div>
                {onEdit && !disabled && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onEdit}>
                        <Pencil className="size-3.5" /> Editar
                    </Button>
                )}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-500 shrink-0">{label}</span>
            <span className="text-slate-900 font-medium text-right truncate">{value?.trim() || "—"}</span>
        </div>
    );
}
