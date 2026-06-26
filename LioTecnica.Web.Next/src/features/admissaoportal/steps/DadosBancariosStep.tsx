"use client";

import { useCallback } from "react";
import { Building2, Info } from "lucide-react";
import WizardStepCard from "../components/WizardStepCard";
import {
    BANKS,
    PortalInfoBox,
    PortalSectionTitle,
    PortalSelectField,
    PortalTextField,
    TIPO_CONTA_OPTIONS,
} from "../components/PortalField";
import { usePortalFormAutoSave } from "../hooks/usePortalFormAutoSave";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import type { AdmissaoPortalSession } from "../publicApi";

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
}

export default function DadosBancariosStep({ session, disabled }: Props) {
    const { formData, setFormField } = useAdmissaoWizardStore();
    usePortalFormAutoSave(session);

    const set = useCallback((field: string, value: string | number | null) => {
        setFormField(field, value);
    }, [setFormField]);

    const bankOptions = BANKS.map((b) => ({
        value: b.code,
        label: `${b.name} (${b.code})`,
    }));

    const handleBankChange = (code: string) => {
        const bank = BANKS.find((b) => b.code === code);
        set("bancoCodigo", code);
        set("bancoNome", bank?.name ?? null);
    };

    return (
        <WizardStepCard
            icon={Building2}
            title="Informações Bancárias"
            subtitle="Informe os dados da conta bancária onde você deseja receber seu salário."
        >
            <PortalInfoBox>
                <Info className="mt-0.5 size-5 shrink-0" />
                <p>
                    <span className="font-semibold">Importante:</span> A conta deve estar em seu nome. Não aceitamos contas conjuntas ou de terceiros.
                </p>
            </PortalInfoBox>

            <div className="mt-6">
                <PortalSectionTitle>Dados da conta</PortalSectionTitle>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <PortalSelectField
                        label="Banco"
                        value={String(formData.bancoCodigo ?? "")}
                        onChange={handleBankChange}
                        options={[{ value: "", label: "Selecione..." }, ...bankOptions]}
                        disabled={disabled}
                        className="sm:col-span-2"
                    />
                    <PortalSelectField
                        label="Tipo de conta"
                        value={formData.tipoConta ?? 0}
                        onChange={(v) => set("tipoConta", Number(v))}
                        options={TIPO_CONTA_OPTIONS}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Agência"
                        value={String(formData.agencia ?? "")}
                        onChange={(v) => set("agencia", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Dígito da agência"
                        value={String(formData.agenciaDigito ?? "")}
                        onChange={(v) => set("agenciaDigito", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Conta"
                        value={String(formData.conta ?? "")}
                        onChange={(v) => set("conta", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Dígito da conta"
                        value={String(formData.contaDigito ?? "")}
                        onChange={(v) => set("contaDigito", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Favorecido"
                        value={String(formData.nome ?? "")}
                        onChange={(v) => set("nome", v)}
                        disabled={disabled}
                        className="sm:col-span-2"
                    />
                </div>
            </div>

            <div className="mt-6">
                <PortalInfoBox>
                    <Info className="mt-0.5 size-5 shrink-0" />
                    <p>Certifique-se de que os dados estão corretos para evitar problemas no recebimento do seu salário.</p>
                </PortalInfoBox>
            </div>
        </WizardStepCard>
    );
}
