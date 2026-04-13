"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Sparkles, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useAdmissaoWizardStore, type DadosPessoais } from "../useAdmissaoWizardStore";
import {
    admissaoPortalFetch,
    type AdmissaoPortalSession,
} from "../publicApi";

const SEXO_OPTIONS = [
    { value: 0, label: "Nao Informado" }, { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" }, { value: 3, label: "Outro" },
];
const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Nao Informado" }, { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" }, { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viuvo(a)" }, { value: 5, label: "Uniao Estavel" }, { value: 6, label: "Separado(a)" },
];
const TIPO_CONTA_OPTIONS = [
    { value: 0, label: "Conta Corrente" }, { value: 1, label: "Conta Poupanca" }, { value: 2, label: "Conta Salario" },
];
const GRAU_INSTRUCAO_OPTIONS = [
    { value: 1, label: "Analfabeto" }, { value: 2, label: "Fundamental Incompleto" },
    { value: 3, label: "Fundamental Completo" }, { value: 4, label: "Medio Incompleto" },
    { value: 5, label: "Medio Completo" }, { value: 6, label: "Superior Incompleto" },
    { value: 7, label: "Superior Completo" }, { value: 8, label: "Pos-Graduacao" },
    { value: 9, label: "Mestrado" }, { value: 10, label: "Doutorado" },
];
const CUTIS_OPTIONS = [
    { value: 1, label: "Branca" }, { value: 2, label: "Morena" },
    { value: 3, label: "Negra" }, { value: 4, label: "Amarela" }, { value: 5, label: "Indigena" },
];
const CABELO_OPTIONS = [
    { value: 1, label: "Preto" }, { value: 2, label: "Castanho" },
    { value: 3, label: "Loiro" }, { value: 4, label: "Ruivo" }, { value: 5, label: "Grisalho" },
];
const OLHOS_OPTIONS = [
    { value: 1, label: "Castanho" }, { value: 2, label: "Azul" },
    { value: 3, label: "Verde" }, { value: 4, label: "Preto" },
];

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
}

export default function ReviewDataStep({ session, disabled }: Props) {
    const { formData, setFormField, setAutoSaving, setLastSavedAt } = useAdmissaoWizardStore();
    const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const set = useCallback((field: string, value: string | number | null) => {
        setFormField(field, value);
    }, [setFormField]);

    // Auto-save with debounce
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setAutoSaving(true);
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
            } catch {}
            setAutoSaving(false);
        }, 2000);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [formData, session, setAutoSaving, setLastSavedAt]);

    // Fetch CEP
    const handleCep = useCallback((raw: string) => {
        set("cep", raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 8)}` : raw);
        if (raw.length === 8) {
            fetch(`https://viacep.com.br/ws/${raw}/json/`)
                .then(r => r.json())
                .then((d: Record<string, string>) => {
                    if (!d.erro) {
                        if (d.logradouro) set("logradouro", d.logradouro);
                        if (d.bairro) set("bairro", d.bairro);
                        if (d.localidade) set("cidade", d.localidade);
                        if (d.uf) set("uf", d.uf);
                    }
                }).catch(() => {});
        }
    }, [set]);

    const selectCls = "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Revise os dados preenchidos automaticamente. Corrija o que estiver errado e preencha o que faltar.
            </p>

            {/* Dados Pessoais */}
            <Section title="Seus Dados Pessoais" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nome Completo" field="nome" form={formData} set={set} disabled={disabled} />
                    <Field label="Nome Social" field="nomeSocial" form={formData} set={set} disabled={disabled} placeholder="Opcional" />
                    <Field label="Nome Abreviado" field="nomeAbreviado" form={formData} set={set} disabled={disabled} placeholder="Ex: JOAO" />
                    <Field label="CPF" field="cpf" form={formData} set={set} disabled className="bg-muted" />
                    <Field label="RG" field="rg" form={formData} set={set} disabled={disabled} />
                    <Field label="Orgao Expedidor" field="rgOrgaoExpedidor" form={formData} set={set} disabled={disabled} />
                    <Field label="UF Expedidor RG" field="rgUfExpedidor" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Data Emissao RG" field="rgDataExpedicao" form={formData} set={set} disabled={disabled} type="date" />
                    <Field label="Data de Nascimento" field="dataNascimento" form={formData} set={set} disabled={disabled} type="date" />
                    <SelectField label="Sexo" field="sexo" form={formData} set={set} disabled={disabled} options={SEXO_OPTIONS} cls={selectCls} />
                    <SelectField label="Estado Civil" field="estadoCivil" form={formData} set={set} disabled={disabled} options={ESTADO_CIVIL_OPTIONS} cls={selectCls} />
                    <Field label="Nacionalidade" field="nacionalidade" form={formData} set={set} disabled={disabled} placeholder="Brasileira" />
                    <Field label="Pais da Nacionalidade" field="paisNacionalidade" form={formData} set={set} disabled={disabled} placeholder="BRA" />
                    <Field label="Cidade de Nascimento" field="naturalCidade" form={formData} set={set} disabled={disabled} />
                    <Field label="UF de Nascimento" field="naturalUf" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Pais de Nascimento" field="paisNascimento" form={formData} set={set} disabled={disabled} placeholder="BRA" />
                    <Field label="Nome da Mae" field="nomeMae" form={formData} set={set} disabled={disabled} />
                    <Field label="Nome do Pai" field="nomePai" form={formData} set={set} disabled={disabled} />
                    <SelectField label="Escolaridade" field="grauInstrucao" form={formData} set={set} disabled={disabled} options={GRAU_INSTRUCAO_OPTIONS} cls={selectCls} />
                    <StringSelectField label="Doador de Orgaos" field="funcDoador" form={formData} set={set} disabled={disabled} options={[{value:"S",label:"Sim"},{value:"N",label:"Nao"}]} cls={selectCls} />
                </div>
            </Section>

            {/* Endereco */}
            <Section title="Seu Endereco">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldWrapper label="CEP" field="cep" form={formData}>
                        <Input
                            value={String(formData.cep ?? "")}
                            onChange={e => handleCep(e.target.value.replace(/\D/g, ""))}
                            disabled={disabled}
                            placeholder="00000-000"
                            maxLength={9}
                            className="h-11"
                        />
                    </FieldWrapper>
                    <Field label="Logradouro" field="logradouro" form={formData} set={set} disabled={disabled} />
                    <Field label="Numero" field="numero" form={formData} set={set} disabled={disabled} />
                    <Field label="Complemento" field="complemento" form={formData} set={set} disabled={disabled} />
                    <Field label="Bairro" field="bairro" form={formData} set={set} disabled={disabled} />
                    <Field label="Cidade" field="cidade" form={formData} set={set} disabled={disabled} />
                    <Field label="UF" field="uf" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Ponto de Referencia" field="pontoReferencia" form={formData} set={set} disabled={disabled} />
                    <StringSelectField label="Reside no Exterior" field="resideExterior" form={formData} set={set} disabled={disabled} options={[{value:"N",label:"Nao"},{value:"S",label:"Sim"}]} cls={selectCls} />
                </div>
            </Section>

            {/* Contato */}
            <Section title="Seus Contatos">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="E-mail" field="email" form={formData} set={set} disabled={disabled} type="email" />
                    <Field label="E-mail Alternativo" field="emailAlternativo" form={formData} set={set} disabled={disabled} type="email" />
                    <Field label="DDD Telefone" field="dddTelefone" form={formData} set={set} disabled={disabled} type="number" placeholder="11" />
                    <Field label="Telefone" field="telefone" form={formData} set={set} disabled={disabled} />
                    <Field label="Celular" field="celular" form={formData} set={set} disabled={disabled} />
                    <Field label="DDD Contato" field="dddTelContato" form={formData} set={set} disabled={disabled} type="number" placeholder="11" />
                    <Field label="Contato de Emergencia" field="contatoEmergenciaNome" form={formData} set={set} disabled={disabled} placeholder="Nome" />
                    <Field label="Fone Emergencia" field="contatoEmergenciaFone" form={formData} set={set} disabled={disabled} />
                </div>
            </Section>

            {/* Banco */}
            <Section title="Dados Bancarios">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Banco (codigo)" field="bancoCodigo" form={formData} set={set} disabled={disabled} placeholder="001" />
                    <Field label="Banco (nome)" field="bancoNome" form={formData} set={set} disabled={disabled} />
                    <Field label="Agencia" field="agencia" form={formData} set={set} disabled={disabled} />
                    <Field label="Digito Ag." field="agenciaDigito" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Conta" field="conta" form={formData} set={set} disabled={disabled} />
                    <Field label="Digito Conta" field="contaDigito" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <SelectField label="Tipo Conta" field="tipoConta" form={formData} set={set} disabled={disabled} options={TIPO_CONTA_OPTIONS} cls={selectCls} />
                </div>
            </Section>

            {/* Trabalhista */}
            <Section title="Dados Trabalhistas">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="PIS/PASEP" field="pisPasep" form={formData} set={set} disabled={disabled} />
                    <Field label="CTPS" field="ctps" form={formData} set={set} disabled={disabled} />
                    <Field label="Serie CTPS" field="ctpsSerie" form={formData} set={set} disabled={disabled} />
                    <Field label="UF CTPS" field="ctpsUf" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <SelectField label="Modelo CTPS" field="ctpsModelo" form={formData} set={set} disabled={disabled} options={[{value:1,label:"Papel"},{value:3,label:"Digital"}]} cls={selectCls} />
                </div>
            </Section>

            {/* Titulo Eleitor */}
            <Section title="Titulo de Eleitor">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Numero" field="tituloEleitorNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Zona" field="tituloEleitorZona" form={formData} set={set} disabled={disabled} />
                    <Field label="Secao" field="tituloEleitorSecao" form={formData} set={set} disabled={disabled} />
                    <Field label="Cidade" field="tituloEleitorCidade" form={formData} set={set} disabled={disabled} />
                    <Field label="UF" field="tituloEleitorUf" form={formData} set={set} disabled={disabled} maxLength={2} />
                </div>
            </Section>

            {/* CNH */}
            <Section title="Carteira de Habilitacao (CNH)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Numero CNH" field="cnhNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Categoria" field="categoriaCnh" form={formData} set={set} disabled={disabled} placeholder="A, B, AB, etc" />
                    <Field label="UF" field="cnhUf" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Orgao Emissor" field="cnhOrgaoEmissor" form={formData} set={set} disabled={disabled} />
                    <Field label="Data Expedicao" field="cnhDataExpedicao" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Primeira Habilitacao" field="cnhPrimeiraHabilitacao" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Validade" field="validadeCnh" form={formData} set={set} disabled={disabled} type="date" />
                </div>
            </Section>

            {/* Doc Militar */}
            <Section title="Documento Militar / Reservista">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Numero Reservista" field="reservistaNumero" form={formData} set={set} disabled={disabled} />
                    <SelectField label="Tipo Doc Militar" field="docMilitarTipo" form={formData} set={set} disabled={disabled} options={[{value:1,label:"Cert. Reservista"},{value:2,label:"Cert. Dispensa"},{value:3,label:"Cert. Alistamento"}]} cls={selectCls} />
                    <Field label="Numero" field="docMilitarNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Serie" field="docMilitarSerie" form={formData} set={set} disabled={disabled} />
                    <Field label="Regiao" field="docMilitarRegiao" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Circunscricao" field="docMilitarCircunscricao" form={formData} set={set} disabled={disabled} type="number" />
                </div>
            </Section>

            {/* Estrangeiro */}
            <Section title="Dados de Estrangeiro">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Passaporte" field="passaporte" form={formData} set={set} disabled={disabled} />
                    <Field label="RNM/RNE" field="rnmRne" form={formData} set={set} disabled={disabled} />
                    <Field label="Validade do Visto" field="validadeVisto" form={formData} set={set} disabled={disabled} type="date" />
                    <Field label="Tipo de Visto" field="tipoVisto" form={formData} set={set} disabled={disabled} />
                </div>
            </Section>

            {/* Saude e Caracteristicas */}
            <Section title="Saude e Caracteristicas Fisicas">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SelectField label="Grupo Sanguineo" field="grupoSanguineo" form={formData} set={set} disabled={disabled} options={[{value:1,label:"A"},{value:2,label:"B"},{value:3,label:"AB"},{value:4,label:"O"}]} cls={selectCls} />
                    <SelectField label="Fator Rh" field="fatorRh" form={formData} set={set} disabled={disabled} options={[{value:1,label:"Positivo (+)"},{value:2,label:"Negativo (-)"}]} cls={selectCls} />
                    <StringSelectField label="Possui Deficiencia" field="possuiDeficiencia" form={formData} set={set} disabled={disabled} options={[{value:"N",label:"Nao"},{value:"S",label:"Sim"}]} cls={selectCls} />
                    <Field label="Cartao SUS" field="cartaoSus" form={formData} set={set} disabled={disabled} />
                    <Field label="Altura (cm)" field="altura" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Peso (kg)" field="peso" form={formData} set={set} disabled={disabled} type="number" />
                    <SelectField label="Cutis" field="cutis" form={formData} set={set} disabled={disabled} options={CUTIS_OPTIONS} cls={selectCls} />
                    <SelectField label="Cabelo" field="cabelo" form={formData} set={set} disabled={disabled} options={CABELO_OPTIONS} cls={selectCls} />
                    <SelectField label="Olhos" field="olhos" form={formData} set={set} disabled={disabled} options={OLHOS_OPTIONS} cls={selectCls} />
                    <Field label="Manequim" field="manequim" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Sapato" field="sapato" form={formData} set={set} disabled={disabled} type="number" />
                </div>
            </Section>
        </div>
    );
}

// ── Sub-components ──

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen ?? false);
    return (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-5 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
                {title}
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {open && <div className="px-5 pb-5 pt-1">{children}</div>}
        </div>
    );
}

function FieldWrapper({ label, field, form, children }: { label: string; field: string; form: DadosPessoais; children: React.ReactNode }) {
    const hasValue = form[field] != null && String(form[field]).trim() !== "";
    const isEmpty = !hasValue;
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                {label}
                {hasValue && <Sparkles className="size-3 text-emerald-500" />}
                {isEmpty && <AlertCircle className="size-3 text-amber-500" />}
            </label>
            {children}
        </div>
    );
}

function Field({ label, field, form, set, disabled, type, placeholder, maxLength, className }: {
    label: string; field: string; form: DadosPessoais;
    set: (f: string, v: string | number | null) => void;
    disabled?: boolean; type?: string; placeholder?: string; maxLength?: number; className?: string;
}) {
    return (
        <FieldWrapper label={label} field={field} form={form}>
            <Input
                type={type}
                value={String(form[field] ?? "")}
                onChange={e => {
                    if (type === "number") set(field, e.target.value ? Number(e.target.value) : null);
                    else set(field, e.target.value);
                }}
                disabled={disabled}
                placeholder={placeholder}
                maxLength={maxLength}
                className={`h-11 ${className || ""}`}
            />
        </FieldWrapper>
    );
}

function SelectField({ label, field, form, set, disabled, options, cls }: {
    label: string; field: string; form: DadosPessoais;
    set: (f: string, v: string | number | null) => void;
    disabled?: boolean; options: { value: number; label: string }[]; cls: string;
}) {
    return (
        <FieldWrapper label={label} field={field} form={form}>
            <select
                className={`${cls} h-11`}
                value={form[field] as number ?? ""}
                onChange={e => set(field, e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
            >
                <option value="">Selecione</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </FieldWrapper>
    );
}

function StringSelectField({ label, field, form, set, disabled, options, cls }: {
    label: string; field: string; form: DadosPessoais;
    set: (f: string, v: string | number | null) => void;
    disabled?: boolean; options: { value: string; label: string }[]; cls: string;
}) {
    return (
        <FieldWrapper label={label} field={field} form={form}>
            <select
                className={`${cls} h-11`}
                value={String(form[field] ?? "")}
                onChange={e => set(field, e.target.value || null)}
                disabled={disabled}
            >
                <option value="">Selecione</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </FieldWrapper>
    );
}
