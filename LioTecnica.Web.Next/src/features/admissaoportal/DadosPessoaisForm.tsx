"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

interface DadosPessoais {
    nome?: string | null; cpf?: string | null; rg?: string | null; rgOrgaoExpedidor?: string | null;
    dataNascimento?: string | null; sexo?: number | null; estadoCivil?: number | null;
    nacionalidade?: string | null; nomeMae?: string | null; nomePai?: string | null;
    cep?: string | null; logradouro?: string | null; numero?: string | null;
    complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
    email?: string | null; telefone?: string | null; celular?: string | null;
    contatoEmergenciaNome?: string | null; contatoEmergenciaFone?: string | null;
    bancoCodigo?: string | null; bancoNome?: string | null; agencia?: string | null;
    agenciaDigito?: string | null; conta?: string | null; contaDigito?: string | null; tipoConta?: number | null;
    pisPasep?: string | null; ctps?: string | null; ctpsSerie?: string | null; ctpsUf?: string | null;
}

interface Props {
    dados: DadosPessoais;
    onSave: (data: DadosPessoais) => Promise<void>;
    disabled?: boolean;
}

const SEXO_OPTIONS = [
    { value: 0, label: "Não Informado" },
    { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" },
    { value: 3, label: "Outro" },
];

const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Não Informado" },
    { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" },
    { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viúvo(a)" },
    { value: 5, label: "União Estável" },
    { value: 6, label: "Separado(a)" },
];

const TIPO_CONTA_OPTIONS = [
    { value: 0, label: "Conta Corrente" },
    { value: 1, label: "Conta Poupança" },
    { value: 2, label: "Conta Salário" },
];

export default function DadosPessoaisForm({ dados, onSave, disabled }: Props) {
    const [form, setForm] = useState<DadosPessoais>({ ...dados });
    const [saving, setSaving] = useState(false);

    function set(field: keyof DadosPessoais, value: string | number | null) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try { await onSave(form); } finally { setSaving(false); }
    }

    return (
        <div className="space-y-6">
            {/* Dados Pessoais */}
            <Section title="Dados Pessoais">
                <Field label="Nome Completo">
                    <Input value={form.nome ?? ""} onChange={e => set("nome", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="CPF">
                    <Input value={form.cpf ?? ""} disabled className="bg-muted" />
                </Field>
                <Field label="RG">
                    <Input value={form.rg ?? ""} onChange={e => set("rg", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Órgão Expedidor">
                    <Input value={form.rgOrgaoExpedidor ?? ""} onChange={e => set("rgOrgaoExpedidor", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Data de Nascimento">
                    <Input type="date" value={form.dataNascimento ?? ""} onChange={e => set("dataNascimento", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Sexo">
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.sexo ?? 0} onChange={e => set("sexo", Number(e.target.value))} disabled={disabled}>
                        {SEXO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label="Estado Civil">
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.estadoCivil ?? 0} onChange={e => set("estadoCivil", Number(e.target.value))} disabled={disabled}>
                        {ESTADO_CIVIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label="Nacionalidade">
                    <Input value={form.nacionalidade ?? ""} onChange={e => set("nacionalidade", e.target.value)} disabled={disabled} placeholder="Brasileira" />
                </Field>
                <Field label="Nome da Mãe">
                    <Input value={form.nomeMae ?? ""} onChange={e => set("nomeMae", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Nome do Pai">
                    <Input value={form.nomePai ?? ""} onChange={e => set("nomePai", e.target.value)} disabled={disabled} />
                </Field>
            </Section>

            {/* Endereço */}
            <Section title="Endereço">
                <Field label="CEP">
                    <Input value={form.cep ?? ""} onChange={e => set("cep", e.target.value)} disabled={disabled} placeholder="00000-000" />
                </Field>
                <Field label="Logradouro">
                    <Input value={form.logradouro ?? ""} onChange={e => set("logradouro", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Número">
                    <Input value={form.numero ?? ""} onChange={e => set("numero", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Complemento">
                    <Input value={form.complemento ?? ""} onChange={e => set("complemento", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Bairro">
                    <Input value={form.bairro ?? ""} onChange={e => set("bairro", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Cidade">
                    <Input value={form.cidade ?? ""} onChange={e => set("cidade", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="UF">
                    <Input value={form.uf ?? ""} onChange={e => set("uf", e.target.value)} disabled={disabled} maxLength={2} className="w-20" />
                </Field>
            </Section>

            {/* Contato */}
            <Section title="Contato">
                <Field label="E-mail">
                    <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Telefone">
                    <Input value={form.telefone ?? ""} onChange={e => set("telefone", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Celular">
                    <Input value={form.celular ?? ""} onChange={e => set("celular", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Contato de Emergência">
                    <Input value={form.contatoEmergenciaNome ?? ""} onChange={e => set("contatoEmergenciaNome", e.target.value)} disabled={disabled} placeholder="Nome" />
                </Field>
                <Field label="Fone Emergência">
                    <Input value={form.contatoEmergenciaFone ?? ""} onChange={e => set("contatoEmergenciaFone", e.target.value)} disabled={disabled} />
                </Field>
            </Section>

            {/* Bancário */}
            <Section title="Dados Bancários">
                <Field label="Banco (código)">
                    <Input value={form.bancoCodigo ?? ""} onChange={e => set("bancoCodigo", e.target.value)} disabled={disabled} placeholder="001" className="w-24" />
                </Field>
                <Field label="Banco (nome)">
                    <Input value={form.bancoNome ?? ""} onChange={e => set("bancoNome", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Agência">
                    <Input value={form.agencia ?? ""} onChange={e => set("agencia", e.target.value)} disabled={disabled} className="w-32" />
                </Field>
                <Field label="Dígito Ag.">
                    <Input value={form.agenciaDigito ?? ""} onChange={e => set("agenciaDigito", e.target.value)} disabled={disabled} className="w-16" maxLength={2} />
                </Field>
                <Field label="Conta">
                    <Input value={form.conta ?? ""} onChange={e => set("conta", e.target.value)} disabled={disabled} className="w-40" />
                </Field>
                <Field label="Dígito Conta">
                    <Input value={form.contaDigito ?? ""} onChange={e => set("contaDigito", e.target.value)} disabled={disabled} className="w-16" maxLength={2} />
                </Field>
                <Field label="Tipo Conta">
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.tipoConta ?? ""} onChange={e => set("tipoConta", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                        <option value="">Selecione</option>
                        {TIPO_CONTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
            </Section>

            {/* Trabalhista */}
            <Section title="Dados Trabalhistas">
                <Field label="PIS/PASEP">
                    <Input value={form.pisPasep ?? ""} onChange={e => set("pisPasep", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="CTPS">
                    <Input value={form.ctps ?? ""} onChange={e => set("ctps", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Série CTPS">
                    <Input value={form.ctpsSerie ?? ""} onChange={e => set("ctpsSerie", e.target.value)} disabled={disabled} className="w-24" />
                </Field>
                <Field label="UF CTPS">
                    <Input value={form.ctpsUf ?? ""} onChange={e => set("ctpsUf", e.target.value)} disabled={disabled} maxLength={2} className="w-20" />
                </Field>
            </Section>

            {!disabled && (
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                        Salvar Dados
                    </Button>
                </div>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
            {children}
        </div>
    );
}
