"use client";

import React from "react";
import { Briefcase, User } from "lucide-react";
import { CargoAutocomplete } from "@/components/autocomplete/CargoAutocomplete";
import { CentroCustoAutocomplete } from "@/components/autocomplete/CentroCustoAutocomplete";
import { UnidadeLotacaoAutocomplete } from "@/components/autocomplete/UnidadeLotacaoAutocomplete";

const TIPO_CONTRATACAO = [
    { value: 0, label: "CLT" },
    { value: 1, label: "PJ" },
    { value: 2, label: "Estágio" },
    { value: 3, label: "Temporário" },
    { value: 4, label: "Aprendiz" },
    { value: 5, label: "Terceirizado" },
];

export interface ContratualFormLike {
    nome?: string | null;
    cpf?: string | null;
    email?: string | null;
    celular?: string | null;
    telefone?: string | null;
    jobPositionNome?: string | null;
    centroCustoNome?: string | null;
    unitNome?: string | null;
    dataAdmissao?: string | null;
    salario?: number | null;
    tipoContratacao?: number | null;
    centroCusto?: string | null;
    unidadeLotacao?: string | null;
    codCargoTotvs?: number | null;
    jobPositionId?: string | null;
    observacaoRh?: string | null;
}

type Props = {
    form: Partial<ContratualFormLike>;
    set: (field: string, value: unknown) => void;
    fieldErrors: Set<string>;
};

function Field({
    field,
    label,
    value,
    onChange,
    type = "text",
    readOnly = false,
    error = false,
}: {
    field: string;
    label: string;
    value?: string | null;
    onChange?: (v: string) => void;
    type?: string;
    readOnly?: boolean;
    error?: boolean;
}) {
    return (
        <div data-field={field}>
            <label className={`text-[11px] font-medium block mb-0.5 ${error ? "text-red-600" : "text-muted-foreground"}`}>
                {label}
            </label>
            <input
                type={type}
                value={value ?? ""}
                readOnly={readOnly}
                onChange={(e) => onChange?.(e.target.value)}
                className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${readOnly ? "bg-muted/50 text-muted-foreground" : ""} ${error ? "border-red-500" : "border-input"}`}
            />
        </div>
    );
}

export default function AdmissaoContratualStep({ form, set, fieldErrors }: Props) {
    return (
        <div className="space-y-6">
            <div>
                <h5 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <User className="size-4" /> Candidato
                </h5>
                <p className="text-xs text-muted-foreground mb-3">
                    Dados pessoais completos serão coletados pelo candidato no portal. Aqui você confere o básico e define os termos contratuais.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field field="nome" label="Nome" value={form.nome} readOnly />
                    <Field field="cpf" label="CPF" value={form.cpf} readOnly />
                    <Field field="email" label="E-mail" value={form.email} onChange={(v) => set("email", v)} error={fieldErrors.has("email")} />
                    <Field field="celular" label="Celular" value={form.celular ?? form.telefone} onChange={(v) => set("celular", v)} error={fieldErrors.has("celular")} />
                </div>
            </div>

            <div className="border-t border-border/30 pt-4">
                <h5 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Briefcase className="size-4" /> Dados contratuais
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field
                        field="dataAdmissao"
                        label="Data de admissão *"
                        value={form.dataAdmissao}
                        onChange={(v) => set("dataAdmissao", v)}
                        type="date"
                        error={fieldErrors.has("dataAdmissao")}
                    />
                    <Field
                        field="salario"
                        label="Salário (R$) *"
                        value={form.salario != null ? String(form.salario) : ""}
                        onChange={(v) => {
                            if (!v) { set("salario", null); return; }
                            const n = parseFloat(v);
                            set("salario", Number.isFinite(n) ? n : null);
                        }}
                        type="number"
                        error={fieldErrors.has("salario")}
                    />
                    <div data-field="tipoContratacao">
                        <label className={`text-[11px] font-medium block mb-0.5 ${fieldErrors.has("tipoContratacao") ? "text-red-600" : "text-muted-foreground"}`}>
                            Tipo de contratação *
                        </label>
                        <select
                            className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${fieldErrors.has("tipoContratacao") ? "border-red-500" : "border-input"}`}
                            value={form.tipoContratacao ?? 0}
                            onChange={(e) => set("tipoContratacao", Number(e.target.value))}
                        >
                            {TIPO_CONTRATACAO.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div data-field="codCargoTotvs" className="col-span-1 md:col-span-2">
                        <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Cargo</label>
                        <CargoAutocomplete
                            value={form.codCargoTotvs != null ? String(form.codCargoTotvs) : ""}
                            onChange={() => {}}
                            onSelect={(cargo) => {
                                set("codCargoTotvs", cargo.totvsCargoBasicId ?? null);
                                set("jobPositionId", cargo.id || null);
                                set("jobPositionNome", cargo.name ?? null);
                            }}
                        />
                    </div>
                    <div data-field="centroCusto">
                        <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Centro de custo</label>
                        <CentroCustoAutocomplete
                            value={form.centroCusto ?? null}
                            onChange={(code) => set("centroCusto", code || null)}
                        />
                    </div>
                    <div data-field="unidadeLotacao">
                        <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Unidade de lotação</label>
                        <UnidadeLotacaoAutocomplete
                            value={form.unidadeLotacao ?? null}
                            onChange={(code) => set("unidadeLotacao", code || null)}
                        />
                    </div>
                    <div className="col-span-full">
                        <label className="text-[11px] font-medium block mb-0.5 text-muted-foreground">Observação interna (RH)</label>
                        <textarea
                            className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={form.observacaoRh ?? ""}
                            onChange={(e) => set("observacaoRh", e.target.value)}
                            maxLength={500}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
