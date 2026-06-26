"use client";

import { useCallback } from "react";
import { Info, User } from "lucide-react";
import WizardStepCard from "../components/WizardStepCard";
import {
    ESTADO_CIVIL_OPTIONS,
    PortalInfoBox,
    PortalSelectField,
    PortalTextField,
    UF_OPTIONS,
} from "../components/PortalField";
import { usePortalFormAutoSave } from "../hooks/usePortalFormAutoSave";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import type { AdmissaoPortalSession } from "../publicApi";

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
}

export default function DadosPessoaisStep({ session, disabled }: Props) {
    const { formData, setFormField } = useAdmissaoWizardStore();
    usePortalFormAutoSave(session);

    const set = useCallback((field: string, value: string | number | null) => {
        setFormField(field, value);
    }, [setFormField]);

    return (
        <WizardStepCard
            icon={User}
            title="Dados Pessoais"
            subtitle="Preencha suas informações pessoais conforme seus documentos."
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <PortalTextField
                    label="Nome completo"
                    value={String(formData.nome ?? "")}
                    onChange={(v) => set("nome", v)}
                    disabled={disabled}
                    className="sm:col-span-2"
                />
                <PortalTextField
                    label="Data de nascimento"
                    type="date"
                    value={String(formData.dataNascimento ?? "")}
                    onChange={(v) => set("dataNascimento", v)}
                    disabled={disabled}
                />
                <PortalSelectField
                    label="Estado civil"
                    value={formData.estadoCivil ?? 0}
                    onChange={(v) => set("estadoCivil", Number(v))}
                    options={ESTADO_CIVIL_OPTIONS}
                    disabled={disabled}
                />
                <PortalTextField
                    label="CPF"
                    value={String(formData.cpf ?? "")}
                    onChange={() => {}}
                    disabled
                    className="bg-slate-50"
                />
                <PortalTextField
                    label="RG"
                    value={String(formData.rg ?? "")}
                    onChange={(v) => set("rg", v)}
                    disabled={disabled}
                />
                <PortalTextField
                    label="Órgão expedidor"
                    value={String(formData.rgOrgaoExpedidor ?? "")}
                    onChange={(v) => set("rgOrgaoExpedidor", v)}
                    disabled={disabled}
                />
                <PortalTextField
                    label="Data de expedição"
                    type="date"
                    value={String(formData.rgDataExpedicao ?? "")}
                    onChange={(v) => set("rgDataExpedicao", v)}
                    disabled={disabled}
                />
                <PortalTextField
                    label="Nacionalidade"
                    value={String(formData.nacionalidade ?? "")}
                    onChange={(v) => set("nacionalidade", v)}
                    disabled={disabled}
                    placeholder="Brasileira"
                />
                <PortalTextField
                    label="Naturalidade"
                    value={String(formData.naturalCidade ?? "")}
                    onChange={(v) => set("naturalCidade", v)}
                    disabled={disabled}
                    className="sm:col-span-2"
                />
                <PortalSelectField
                    label="UF"
                    value={String(formData.naturalUf ?? "")}
                    onChange={(v) => set("naturalUf", v)}
                    options={UF_OPTIONS}
                    disabled={disabled}
                />
                <PortalTextField
                    label="Nome da mãe"
                    value={String(formData.nomeMae ?? "")}
                    onChange={(v) => set("nomeMae", v)}
                    disabled={disabled}
                    className="sm:col-span-2"
                />
                <PortalTextField
                    label="Nome do pai"
                    value={String(formData.nomePai ?? "")}
                    onChange={(v) => set("nomePai", v)}
                    disabled={disabled}
                    className="sm:col-span-2"
                />
            </div>

            <div className="mt-6">
                <PortalInfoBox>
                    <Info className="mt-0.5 size-5 shrink-0" />
                    <p>
                        <span className="font-semibold">Importante:</span> As informações devem ser iguais às dos seus documentos oficiais.
                    </p>
                </PortalInfoBox>
            </div>
        </WizardStepCard>
    );
}
