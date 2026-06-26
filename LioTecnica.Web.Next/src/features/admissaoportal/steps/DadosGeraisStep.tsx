"use client";

import { useCallback } from "react";
import { Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import WizardStepCard from "../components/WizardStepCard";
import DependentsInline from "../components/DependentsInline";
import {
    ESTADO_CIVIL_OPTIONS,
    PortalField,
    PortalSectionTitle,
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

export default function DadosGeraisStep({ session, disabled }: Props) {
    const { formData, setFormField } = useAdmissaoWizardStore();
    usePortalFormAutoSave(session);

    const set = useCallback((field: string, value: string | number | null) => {
        setFormField(field, value);
    }, [setFormField]);

    const handleCep = useCallback((raw: string) => {
        const digits = raw.replace(/\D/g, "");
        set("cep", digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5, 8)}` : digits);
        if (digits.length === 8) {
            fetch(`https://viacep.com.br/ws/${digits}/json/`)
                .then((r) => r.json())
                .then((d: Record<string, string>) => {
                    if (!d.erro) {
                        if (d.logradouro) set("logradouro", d.logradouro);
                        if (d.bairro) set("bairro", d.bairro);
                        if (d.localidade) set("cidade", d.localidade);
                        if (d.uf) set("uf", d.uf);
                    }
                })
                .catch(() => {});
        }
    }, [set]);

    return (
        <WizardStepCard
            icon={Home}
            title="Dados Gerais"
            subtitle="Preencha suas informações de endereço e contato."
        >
            <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <PortalField label="CEP">
                        <Input
                            value={String(formData.cep ?? "")}
                            onChange={(e) => handleCep(e.target.value)}
                            disabled={disabled}
                            placeholder="00000-000"
                            className="h-11 rounded-lg border-slate-200"
                        />
                    </PortalField>
                    <PortalTextField
                        label="Logradouro"
                        value={String(formData.logradouro ?? "")}
                        onChange={(v) => set("logradouro", v)}
                        disabled={disabled}
                        className="sm:col-span-2"
                    />
                    <PortalTextField
                        label="Número"
                        value={String(formData.numero ?? "")}
                        onChange={(v) => set("numero", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Complemento"
                        value={String(formData.complemento ?? "")}
                        onChange={(v) => set("complemento", v)}
                        disabled={disabled}
                        placeholder="Apto 45 (opcional)"
                        className="sm:col-span-2"
                    />
                    <PortalTextField
                        label="Bairro"
                        value={String(formData.bairro ?? "")}
                        onChange={(v) => set("bairro", v)}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="Cidade"
                        value={String(formData.cidade ?? "")}
                        onChange={(v) => set("cidade", v)}
                        disabled={disabled}
                    />
                    <PortalSelectField
                        label="Estado"
                        value={String(formData.uf ?? "")}
                        onChange={(v) => set("uf", v)}
                        options={UF_OPTIONS}
                        disabled={disabled}
                    />
                    <PortalTextField
                        label="País"
                        value={String(formData.paisNacionalidade ?? "BRA")}
                        onChange={(v) => set("paisNacionalidade", v)}
                        disabled={disabled}
                    />
                </div>

                <div>
                    <PortalSectionTitle>Contato</PortalSectionTitle>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <PortalTextField
                            label="E-mail"
                            type="email"
                            value={String(formData.email ?? "")}
                            onChange={(v) => set("email", v)}
                            disabled={disabled}
                            className="sm:col-span-2"
                        />
                        <PortalTextField
                            label="Telefone celular"
                            value={String(formData.celular ?? "")}
                            onChange={(v) => set("celular", v)}
                            disabled={disabled}
                        />
                        <PortalTextField
                            label="Telefone fixo (opcional)"
                            value={String(formData.telefone ?? "")}
                            onChange={(v) => set("telefone", v)}
                            disabled={disabled}
                        />
                    </div>
                </div>

                <div>
                    <PortalSectionTitle>Outras informações</PortalSectionTitle>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <PortalSelectField
                            label="Estado civil"
                            value={formData.estadoCivil ?? 0}
                            onChange={(v) => set("estadoCivil", Number(v))}
                            options={ESTADO_CIVIL_OPTIONS}
                            disabled={disabled}
                        />
                        <PortalSelectField
                            label="Possui alguma deficiência?"
                            value={formData.possuiDeficiencia ?? "N"}
                            onChange={(v) => set("possuiDeficiencia", v)}
                            options={[{ value: "N", label: "Não" }, { value: "S", label: "Sim" }]}
                            disabled={disabled}
                        />
                    </div>
                </div>

                <div>
                    <PortalSectionTitle>Dependentes</PortalSectionTitle>
                    <p className="mt-1 text-sm text-slate-500">
                        Cadastre cônjuges, filhos ou outros dependentes, se houver.
                    </p>
                    <div className="mt-4">
                        <DependentsInline session={session} disabled={disabled} />
                    </div>
                </div>
            </div>
        </WizardStepCard>
    );
}
