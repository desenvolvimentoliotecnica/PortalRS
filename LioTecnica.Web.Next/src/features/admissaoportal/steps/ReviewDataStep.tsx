"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useAdmissaoWizardStore, type DadosPessoais } from "../useAdmissaoWizardStore";
import WizardStepPanel from "../components/WizardStepPanel";
import { getDadosSectionLabel, type DadosSectionId } from "../dadosFormSections";
import {
    admissaoPortalFetch,
    type AdmissaoPortalSession,
} from "../publicApi";

// ── Dados para autocomplete ──

const UF_OPTIONS = [
    { value: "AC", label: "AC — Acre" }, { value: "AL", label: "AL — Alagoas" },
    { value: "AP", label: "AP — Amapá" }, { value: "AM", label: "AM — Amazonas" },
    { value: "BA", label: "BA — Bahia" }, { value: "CE", label: "CE — Ceará" },
    { value: "DF", label: "DF — Distrito Federal" }, { value: "ES", label: "ES — Espírito Santo" },
    { value: "GO", label: "GO — Goiás" }, { value: "MA", label: "MA — Maranhão" },
    { value: "MT", label: "MT — Mato Grosso" }, { value: "MS", label: "MS — Mato Grosso do Sul" },
    { value: "MG", label: "MG — Minas Gerais" }, { value: "PA", label: "PA — Pará" },
    { value: "PB", label: "PB — Paraíba" }, { value: "PR", label: "PR — Paraná" },
    { value: "PE", label: "PE — Pernambuco" }, { value: "PI", label: "PI — Piauí" },
    { value: "RJ", label: "RJ — Rio de Janeiro" }, { value: "RN", label: "RN — Rio Grande do Norte" },
    { value: "RS", label: "RS — Rio Grande do Sul" }, { value: "RO", label: "RO — Rondônia" },
    { value: "RR", label: "RR — Roraima" }, { value: "SC", label: "SC — Santa Catarina" },
    { value: "SP", label: "SP — São Paulo" }, { value: "SE", label: "SE — Sergipe" },
    { value: "TO", label: "TO — Tocantins" },
];

const BANKS = [
    { code: "001", name: "Banco do Brasil" }, { code: "033", name: "Santander" },
    { code: "041", name: "Banrisul" }, { code: "070", name: "BRB — Banco de Brasília" },
    { code: "077", name: "Banco Inter" }, { code: "104", name: "Caixa Econômica Federal" },
    { code: "208", name: "BTG Pactual" }, { code: "212", name: "Banco Original" },
    { code: "237", name: "Bradesco" }, { code: "260", name: "Nubank" },
    { code: "290", name: "PagBank" }, { code: "318", name: "Banco BMG" },
    { code: "336", name: "C6 Bank" }, { code: "341", name: "Itaú Unibanco" },
    { code: "389", name: "Banco Mercantil do Brasil" }, { code: "422", name: "Banco Safra" },
    { code: "623", name: "Banco Pan" }, { code: "633", name: "Banco Rendimento" },
    { code: "655", name: "Votorantim" }, { code: "707", name: "Banco Daycoval" },
    { code: "748", name: "Sicredi" }, { code: "756", name: "Sicoob" },
    { code: "084", name: "Uniprime" }, { code: "136", name: "Unicred" },
    { code: "197", name: "Stone" }, { code: "380", name: "PicPay" },
    { code: "403", name: "Cora" }, { code: "637", name: "Banco Sofisa" },
];

// Cache por UF: { "SP": ["São Paulo", "Campinas", ...], ... }
/**
 * TOTVS Datasul aceita país só em ISO 3166-1 alpha-3 (3 letras).
 * Nomes por extenso ("Brasil") causam "Pais inexistente" no Datasul.
 * Converte nomes comuns em PT/EN para o código ISO.
 */
function normalizePaisIso3Portal(v: string): string {
    const t = v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const mapa: Record<string, string> = {
        BRASIL: "BRA", BRAZIL: "BRA", BR: "BRA",
        ARGENTINA: "ARG", URUGUAI: "URY", PARAGUAI: "PRY", CHILE: "CHL",
        "ESTADOS UNIDOS": "USA", "UNITED STATES": "USA", PORTUGAL: "PRT",
    };
    if (mapa[t]) return mapa[t];
    return t.slice(0, 3);
}

const ibgeCacheByUf: Record<string, string[]> = {};
const ibgeFetchingUf: Record<string, Promise<void>> = {};

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
// Códigos alinhados com eSocial / AdmissaoWizardScreen (não trocar 2 e 3 sob pena
// de candidato selecionar "Preta" e chegar "Parda" ao Datasul — bug histórico corrigido).
const CUTIS_OPTIONS = [
    { value: 1, label: "Branca" }, { value: 2, label: "Preta" },
    { value: 3, label: "Parda" }, { value: 4, label: "Amarela" }, { value: 5, label: "Indigena" },
];
const ORIGEM_FUNCIONARIO_OPTIONS = [
    { value: 1, label: "Brasileiro" }, { value: 2, label: "Naturalizado" }, { value: 3, label: "Estrangeiro" },
];
const CABELO_OPTIONS = [
    { value: 1, label: "Castanho" }, { value: 2, label: "Preto" },
    { value: 3, label: "Loiro" }, { value: 4, label: "Ruivo" }, { value: 5, label: "Grisalho" },
];
const OLHOS_OPTIONS = [
    { value: 1, label: "Castanho" }, { value: 2, label: "Preto" },
    { value: 3, label: "Azul" }, { value: 4, label: "Verde" },
];

interface Props {
    session: AdmissaoPortalSession;
    disabled?: boolean;
    sectionId: DadosSectionId;
    sectionIndex: number;
    totalSections: number;
}

export default function ReviewDataStep({ session, disabled, sectionId, sectionIndex, totalSections }: Props) {
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
                        // Código IBGE do município (obrigatório TOTVS/eSocial).
                        // ViaCEP retorna como string; TOTVS armazena como int.
                        if (d.ibge) {
                            const ibgeNum = Number(d.ibge);
                            if (Number.isFinite(ibgeNum)) set("municipioEnderecoIbge", ibgeNum);
                        }
                    }
                }).catch(() => {});
        }
    }, [set]);

    const selectCls = "flex h-14 w-full rounded-md border border-input bg-transparent px-4 py-2 text-base";

    const gridCls = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4";

    return (
        <WizardStepPanel wide>
            <div className="flex flex-col gap-7">
                <div className="text-center space-y-3 shrink-0">
                    <p className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
                        Etapa {sectionIndex + 1} de {totalSections}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {getDadosSectionLabel(sectionId)}
                    </h2>
                    <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                        Preencha o que souber. A analista de RH revisará e solicitará ajustes, se necessário.
                    </p>
                </div>

            {sectionId === "pessoal" && (
                <div className={gridCls}>
                    <Field label="Nome Completo" field="nome" form={formData} set={set} disabled={disabled} />
                    <Field label="Nome Social" field="nomeSocial" form={formData} set={set} disabled={disabled} placeholder="Opcional" />
                    <Field label="CPF" field="cpf" form={formData} set={set} disabled className="bg-muted" />
                    <Field label="RG" field="rg" form={formData} set={set} disabled={disabled} />
                    <Field label="Orgao Expedidor" field="rgOrgaoExpedidor" form={formData} set={set} disabled={disabled} />
                    <AutocompleteField label="UF Expedidor RG" field="rgUfExpedidor" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <Field label="Data Emissao RG" field="rgDataExpedicao" form={formData} set={set} disabled={disabled} type="date" />
                    <Field label="Data de Nascimento" field="dataNascimento" form={formData} set={set} disabled={disabled} type="date" />
                    <SelectField label="Sexo" field="sexo" form={formData} set={set} disabled={disabled} options={SEXO_OPTIONS} cls={selectCls} />
                    <SelectField label="Estado Civil" field="estadoCivil" form={formData} set={set} disabled={disabled} options={ESTADO_CIVIL_OPTIONS} cls={selectCls} />
                    <Field label="Nacionalidade" field="nacionalidade" form={formData} set={set} disabled={disabled} placeholder="Brasileira" />
                    <FieldWrapper label="Pais Nacionalidade (ISO 3 letras)" field="paisNacionalidade" form={formData}>
                        <Input
                            value={String(formData.paisNacionalidade ?? "")}
                            onChange={e => set("paisNacionalidade", normalizePaisIso3Portal(e.target.value))}
                            placeholder="BRA"
                            maxLength={3}
                            disabled={disabled}
                            className="h-14"
                        />
                    </FieldWrapper>
                    <CityField label="Cidade de Nascimento" field="naturalCidade" ufField="naturalUf" form={formData} set={set} disabled={disabled} />
                    <AutocompleteField label="UF de Nascimento" field="naturalUf" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <FieldWrapper label="Pais de Nascimento (ISO 3 letras)" field="paisNascimento" form={formData}>
                        <Input
                            value={String(formData.paisNascimento ?? "")}
                            onChange={e => set("paisNascimento", normalizePaisIso3Portal(e.target.value))}
                            placeholder="BRA"
                            maxLength={3}
                            disabled={disabled}
                            className="h-14"
                        />
                    </FieldWrapper>
                    <Field label="Nome da Mae" field="nomeMae" form={formData} set={set} disabled={disabled} />
                    <Field label="Nome do Pai" field="nomePai" form={formData} set={set} disabled={disabled} />
                    <SelectField label="Escolaridade" field="grauInstrucao" form={formData} set={set} disabled={disabled} options={GRAU_INSTRUCAO_OPTIONS} cls={selectCls} />
                    <SelectField label="Origem" field="origemFuncionario" form={formData} set={set} disabled={disabled} options={ORIGEM_FUNCIONARIO_OPTIONS} cls={selectCls} />
                </div>
            )}

            {sectionId === "endereco" && (
                <div className={gridCls}>
                    <FieldWrapper label="CEP" field="cep" form={formData}>
                        <Input
                            value={String(formData.cep ?? "")}
                            onChange={e => handleCep(e.target.value.replace(/\D/g, ""))}
                            disabled={disabled}
                            placeholder="00000-000"
                            maxLength={9}
                            className="h-14"
                        />
                    </FieldWrapper>
                    <Field label="Logradouro" field="logradouro" form={formData} set={set} disabled={disabled} />
                    <Field label="Numero" field="numero" form={formData} set={set} disabled={disabled} />
                    <Field label="Complemento" field="complemento" form={formData} set={set} disabled={disabled} />
                    <Field label="Bairro" field="bairro" form={formData} set={set} disabled={disabled} />
                    <AutocompleteField label="UF" field="uf" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <CityField label="Cidade" field="cidade" ufField="uf" form={formData} set={set} disabled={disabled} />
                    <Field label="Ponto de Referencia" field="pontoReferencia" form={formData} set={set} disabled={disabled} />
                </div>
            )}

            {sectionId === "contatos" && (
                <div className={gridCls}>
                    <Field label="E-mail" field="email" form={formData} set={set} disabled={disabled} type="email" />
                    <Field label="DDD Telefone" field="dddTelefone" form={formData} set={set} disabled={disabled} type="number" placeholder="11" />
                    <Field label="Telefone" field="telefone" form={formData} set={set} disabled={disabled} />
                    <Field label="Celular" field="celular" form={formData} set={set} disabled={disabled} />
                    <Field label="DDD Contato" field="dddTelContato" form={formData} set={set} disabled={disabled} type="number" placeholder="11" />
                    <Field label="Contato de Emergencia" field="contatoEmergenciaNome" form={formData} set={set} disabled={disabled} placeholder="Nome" />
                    <Field label="Fone Emergencia" field="contatoEmergenciaFone" form={formData} set={set} disabled={disabled} />
                </div>
            )}

            {sectionId === "bancario" && (
                <div className={gridCls}>
                    <BankField form={formData} set={set} disabled={disabled} />
                    <Field label="Agencia" field="agencia" form={formData} set={set} disabled={disabled} />
                    <Field label="Digito Ag." field="agenciaDigito" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <Field label="Conta" field="conta" form={formData} set={set} disabled={disabled} />
                    <Field label="Digito Conta" field="contaDigito" form={formData} set={set} disabled={disabled} maxLength={2} />
                    <SelectField label="Tipo Conta" field="tipoConta" form={formData} set={set} disabled={disabled} options={TIPO_CONTA_OPTIONS} cls={selectCls} />
                </div>
            )}

            {sectionId === "trabalhista" && (
                <div className={gridCls}>
                    <Field label="PIS/PASEP" field="pisPasep" form={formData} set={set} disabled={disabled} />
                    <Field label="CTPS" field="ctps" form={formData} set={set} disabled={disabled} />
                    <Field label="Serie CTPS" field="ctpsSerie" form={formData} set={set} disabled={disabled} />
                    <AutocompleteField label="UF CTPS" field="ctpsUf" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <SelectField label="Modelo CTPS" field="ctpsModelo" form={formData} set={set} disabled={disabled} options={[{value:1,label:"Papel"},{value:3,label:"Digital"}]} cls={selectCls} />
                </div>
            )}

            {sectionId === "titulo-eleitor" && (
                <div className={gridCls}>
                    <Field label="Numero" field="tituloEleitorNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Zona" field="tituloEleitorZona" form={formData} set={set} disabled={disabled} />
                    <Field label="Secao" field="tituloEleitorSecao" form={formData} set={set} disabled={disabled} />
                    <AutocompleteField label="UF" field="tituloEleitorUf" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <CityField label="Cidade" field="tituloEleitorCidade" ufField="tituloEleitorUf" form={formData} set={set} disabled={disabled} />
                </div>
            )}

            {sectionId === "cnh" && (
                <div className={gridCls}>
                    <Field label="Numero CNH" field="cnhNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Categoria" field="categoriaCnh" form={formData} set={set} disabled={disabled} placeholder="A, B, AB, etc" />
                    <AutocompleteField label="UF" field="cnhUf" form={formData} set={set} disabled={disabled} options={UF_OPTIONS} placeholder="Ex: SP" />
                    <Field label="Orgao Emissor" field="cnhOrgaoEmissor" form={formData} set={set} disabled={disabled} />
                    <Field label="Data Expedicao" field="cnhDataExpedicao" form={formData} set={set} disabled={disabled} type="date" />
                    <Field label="Primeira Habilitacao" field="cnhPrimeiraHabilitacao" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Validade" field="validadeCnh" form={formData} set={set} disabled={disabled} type="date" />
                </div>
            )}

            {sectionId === "militar" && (
                <div className={gridCls}>
                    <Field label="Numero Reservista" field="reservistaNumero" form={formData} set={set} disabled={disabled} />
                    <SelectField label="Tipo Doc Militar" field="docMilitarTipo" form={formData} set={set} disabled={disabled} options={[{value:1,label:"Cert. Reservista"},{value:2,label:"Cert. Dispensa"},{value:3,label:"Cert. Alistamento"}]} cls={selectCls} />
                    <Field label="Numero" field="docMilitarNumero" form={formData} set={set} disabled={disabled} />
                    <Field label="Serie" field="docMilitarSerie" form={formData} set={set} disabled={disabled} />
                    <Field label="Regiao" field="docMilitarRegiao" form={formData} set={set} disabled={disabled} type="number" />
                    <Field label="Circunscricao" field="docMilitarCircunscricao" form={formData} set={set} disabled={disabled} type="number" />
                </div>
            )}

            {sectionId === "estrangeiro" && (
                <div className={gridCls}>
                    <Field label="Passaporte" field="passaporte" form={formData} set={set} disabled={disabled} />
                    <Field label="RNM/RNE" field="rnmRne" form={formData} set={set} disabled={disabled} />
                    <Field label="Validade do Visto" field="validadeVisto" form={formData} set={set} disabled={disabled} type="date" />
                    <Field label="Tipo de Visto (texto)" field="tipoVisto" form={formData} set={set} disabled={disabled} />
                    <SelectField label="Tipo Visto Estrangeiro (TOTVS)" field="tipoVistoEstrangeiro" form={formData} set={set} disabled={disabled} options={[{value:1,label:"1 - Passaporte Comum"},{value:2,label:"2 - Temporário"},{value:3,label:"3 - Permanente"},{value:4,label:"4 - Oficial/Diplomático"},{value:5,label:"5 - Outros"}]} cls={selectCls} />
                    <SelectField label="Ocorrência CAGED" field="ocorrenciaCAGED" form={formData} set={set} disabled={disabled} options={[{value:1,label:"1 - Admissão Normal"},{value:2,label:"2 - Reintegração"},{value:3,label:"3 - Reemprego"},{value:4,label:"4 - Transferência Entrada"},{value:5,label:"5 - Trabalho Temporário"}]} cls={selectCls} />
                </div>
            )}

            {sectionId === "saude" && (
                <div className={gridCls}>
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
            )}
            </div>
        </WizardStepPanel>
    );
}

function FieldWrapper({ label, field, form, children }: { label: string; field: string; form: DadosPessoais; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                {label}
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
                className={`h-14 ${className || ""}`}
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
                className={`${cls} h-14`}
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
                className={`${cls} h-14`}
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

function DropdownList({ items, onSelect }: {
    items: { value: string; label: string }[];
    onSelect: (value: string) => void;
}) {
    if (items.length === 0) return null;
    return (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
            {items.map(o => (
                <button
                    key={o.value}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onMouseDown={e => { e.preventDefault(); onSelect(o.value); }}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function AutocompleteField({ label, field, form, set, disabled, placeholder, options }: {
    label: string; field: string; form: DadosPessoais;
    set: (f: string, v: string | null) => void;
    disabled?: boolean; placeholder?: string;
    options: { value: string; label: string }[];
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const value = String(form[field] ?? "");

    const filtered = value.length === 0
        ? options.slice(0, 20)
        : options.filter(o =>
            o.value.toLowerCase().startsWith(value.toLowerCase()) ||
            o.label.toLowerCase().startsWith(value.toLowerCase())
        ).slice(0, 12);

    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    return (
        <FieldWrapper label={label} field={field} form={form}>
            <div ref={containerRef} className="relative">
                <Input
                    value={value}
                    onChange={e => { set(field, e.target.value || null); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="h-14"
                    autoComplete="off"
                />
                {open && <DropdownList items={filtered} onSelect={v => { set(field, v); setOpen(false); }} />}
            </div>
        </FieldWrapper>
    );
}

function CityField({ label, field, ufField, form, set, disabled }: {
    label: string; field: string; ufField: string; form: DadosPessoais;
    set: (f: string, v: string | null) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [, forceUpdate] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const value = String(form[field] ?? "");
    const uf = String(form[ufField] ?? "").toUpperCase();
    const ufValid = UF_OPTIONS.some(o => o.value === uf);
    const cities = ufValid ? (ibgeCacheByUf[uf] ?? null) : null;

    // Busca cidades da UF quando ela muda
    useEffect(() => {
        if (!ufValid) return;
        if (ibgeCacheByUf[uf]) { forceUpdate(n => n + 1); return; }
        if (uf in ibgeFetchingUf) return;

        setLoading(true);
        ibgeFetchingUf[uf] = fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
        )
            .then(r => r.json())
            .then((data: { nome: string }[]) => {
                ibgeCacheByUf[uf] = data.map(m => m.nome);
            })
            .catch(() => {
                ibgeCacheByUf[uf] = [];
            })
            .finally(() => {
                setLoading(false);
                forceUpdate(n => n + 1);
            });
    }, [uf, ufValid]);

    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    const filtered = cities
        ? cities
            .filter(nome => value.length === 0 || nome.toLowerCase().startsWith(value.toLowerCase()))
            .slice(0, 12)
            .map(nome => ({ value: nome, label: nome }))
        : [];

    return (
        <FieldWrapper label={label} field={field} form={form}>
            <div ref={containerRef} className="relative">
                <Input
                    value={value}
                    onChange={e => { set(field, e.target.value || null); setOpen(true); }}
                    onFocus={() => { if (ufValid) setOpen(true); }}
                    disabled={disabled || !ufValid}
                    placeholder={!ufValid ? "Preencha a UF primeiro" : loading ? "Carregando cidades..." : "Digite para buscar..."}
                    className="h-14"
                    autoComplete="off"
                />
                {open && filtered.length > 0 && (
                    <DropdownList items={filtered} onSelect={v => { set(field, v); setOpen(false); }} />
                )}
            </div>
        </FieldWrapper>
    );
}

function BankField({ form, set, disabled }: {
    form: DadosPessoais;
    set: (f: string, v: string | null) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const query = String(form.bancoCodigo ?? "");
    const nameVal = String(form.bancoNome ?? "");

    const filtered = BANKS.filter(b =>
        b.code.includes(query) ||
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        (nameVal && b.name.toLowerCase().includes(nameVal.toLowerCase()))
    ).slice(0, 12).map(b => ({ value: b.code, label: `${b.code} — ${b.name}` }));

    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node))
                setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    function selectBank(code: string) {
        const bank = BANKS.find(b => b.code === code);
        if (bank) { set("bancoCodigo", bank.code); set("bancoNome", bank.name); }
        setOpen(false);
    }

    return (
        <>
            <FieldWrapper label="Banco" field="bancoCodigo" form={form}>
                <div ref={containerRef} className="relative">
                    <Input
                        value={query}
                        onChange={e => { set("bancoCodigo", e.target.value || null); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        disabled={disabled}
                        placeholder="Código ou nome..."
                        className="h-14"
                        autoComplete="off"
                    />
                    {open && filtered.length > 0 && (
                        <DropdownList items={filtered} onSelect={selectBank} />
                    )}
                </div>
            </FieldWrapper>
            <FieldWrapper label="Nome do Banco" field="bancoNome" form={form}>
                <Input
                    value={nameVal}
                    onChange={e => set("bancoNome", e.target.value || null)}
                    disabled={disabled}
                    className="h-14"
                    autoComplete="off"
                />
            </FieldWrapper>
        </>
    );
}
