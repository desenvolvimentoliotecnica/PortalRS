"use client";

import {
    Building2,
    ClipboardList,
    Info,
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
            subtitle="Confira todas as informações antes de finalizar seu processo de admissão."
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
                    <ReviewRow label="Estado civil" value={formData.estadoCivil} />
                    <ReviewRow label="Órgão expedidor" value={formData.rgOrgaoExpedidor} />
                </ReviewCard>

                <ReviewCard
                    icon={User}
                    title="Dados Gerais"
                    onEdit={onEditStep ? () => onEditStep(2) : undefined}
                    disabled={disabled}
                >
                    <ReviewRow label="CEP" value={formData.cep} />
                    <ReviewRow label="Cidade/Estado" value={[formData.cidade, formData.uf].filter(Boolean).join(" - ")} />
                    <ReviewRow label="Endereço" value={[formData.logradouro, formData.numero].filter(Boolean).join(", ")} />
                    <ReviewRow label="País" value={formData.paisNacionalidade} />
                    <ReviewRow label="Bairro" value={formData.bairro} />
                    <ReviewRow label="E-mail" value={formData.email} />
                </ReviewCard>

                <ReviewCard
                    icon={ClipboardList}
                    title="Documentos"
                    onEdit={onEditStep ? () => onEditStep(3) : undefined}
                    disabled={disabled}
                >
                    {docsList.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhum documento enviado ainda.</p>
                    ) : (
                        docsList.map((doc, i) => {
                            const tipoCode = tipoDocumentoToCode(doc.tipo);
                            return (
                            <div key={`${tipoCode}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-700">
                                    {TIPO_DOC_LABELS[tipoCode] || `Documento ${doc.tipo}`}
                                </span>
                                <span className="truncate text-xs text-emerald-600">Enviado</span>
                            </div>
                            );
                        })
                    )}
                </ReviewCard>

                <ReviewCard
                    icon={Building2}
                    title="Informações Bancárias"
                    onEdit={onEditStep ? () => onEditStep(4) : undefined}
                    disabled={disabled}
                >
                    <ReviewRow label="Banco" value={[formData.bancoCodigo, formData.bancoNome].filter(Boolean).join(" - ")} />
                    <ReviewRow label="Conta" value={formData.conta} />
                    <ReviewRow label="Tipo de conta" value={formData.tipoConta} />
                    <ReviewRow label="Dígito" value={formData.contaDigito} />
                    <ReviewRow label="Agência" value={formData.agencia} />
                    <ReviewRow label="Favorecido" value={formData.nome} />
                </ReviewCard>
            </div>

            <div className="mt-6">
                <PortalInfoBox>
                    <Info className="mt-0.5 size-5 shrink-0" />
                    <p>
                        Após confirmar, seus dados serão enviados para análise do RH. Você não poderá alterá-los
                        diretamente após a confirmação.
                    </p>
                </PortalInfoBox>
            </div>
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
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    onEdit?: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Icon className="size-4 text-[#0047BB]" />
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                </div>
                {onEdit && !disabled && (
                    <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 gap-1 text-[#0047BB]">
                        <Pencil className="size-3.5" /> Editar
                    </Button>
                )}
            </div>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value?: unknown }) {
    const display = value == null || String(value).trim() === "" ? "—" : String(value);
    return (
        <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="max-w-[55%] truncate text-right font-medium text-slate-800">{display}</span>
        </div>
    );
}
