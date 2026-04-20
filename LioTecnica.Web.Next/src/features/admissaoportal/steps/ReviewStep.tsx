"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Send, Loader2, CheckCircle2, User, MapPin, Phone, CreditCard, Briefcase, Users } from "lucide-react";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { validatePreAdmissao } from "@/features/admissao/validation";

const PARENTESCO_LABEL: Record<number, string> = { 0: "Conjuge", 1: "Filho(a)", 2: "Pai", 3: "Mae", 4: "Outro" };

interface Props {
    onSubmit: () => Promise<void>;
    disabled?: boolean;
}

export default function ReviewStep({ onSubmit, disabled }: Props) {
    const { formData, dependentes } = useAdmissaoWizardStore();
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        // Valida antes de enviar — evita erro 422 tardio do backend/Datasul.
        // Usa a mesma função do wizard RH (validatePreAdmissao) para manter uma única fonte de verdade.
        const errors = validatePreAdmissao(formData);
        if (errors.length > 0) {
            const first = errors[0];
            const extra = errors.length > 1 ? ` (+${errors.length - 1} campo${errors.length > 2 ? "s" : ""} pendente${errors.length > 2 ? "s" : ""})` : "";
            toast.error(`${first.label}: ${first.message}${extra}`);
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 dark:bg-blue-900/20 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    Confira se seus dados estao corretos antes de enviar. Apos enviar, o RH vai revisar tudo.
                </p>
            </div>

            {/* Dados Pessoais */}
            <ReviewSection icon={User} title="Dados Pessoais">
                <ReviewRow label="Nome" value={formData.nome} />
                <ReviewRow label="CPF" value={formData.cpf} />
                <ReviewRow label="RG" value={[formData.rg, formData.rgOrgaoExpedidor, formData.rgUfExpedidor].filter(Boolean).join(" - ")} />
                <ReviewRow label="Nascimento" value={formData.dataNascimento} />
                <ReviewRow label="Natural de" value={[formData.naturalCidade, formData.naturalUf].filter(Boolean).join(" - ")} />
                <ReviewRow label="Mae" value={formData.nomeMae} />
                <ReviewRow label="Pai" value={formData.nomePai} />
                <ReviewRow label="Escolaridade" value={formData.grauInstrucao} />
            </ReviewSection>

            {/* Endereco */}
            <ReviewSection icon={MapPin} title="Endereco">
                <ReviewRow label="CEP" value={formData.cep} />
                <ReviewRow label="Endereco" value={[formData.logradouro, formData.numero].filter(Boolean).join(", ")} />
                <ReviewRow label="Bairro" value={formData.bairro} />
                <ReviewRow label="Cidade/UF" value={[formData.cidade, formData.uf].filter(Boolean).join(" - ")} />
            </ReviewSection>

            {/* Contato */}
            <ReviewSection icon={Phone} title="Contato">
                <ReviewRow label="E-mail" value={formData.email} />
                <ReviewRow label="E-mail Alt." value={formData.emailAlternativo} />
                <ReviewRow label="Celular" value={formData.celular} />
                <ReviewRow label="Telefone" value={formData.telefone} />
                <ReviewRow label="Emergencia" value={[formData.contatoEmergenciaNome, formData.contatoEmergenciaFone].filter(Boolean).join(" - ")} />
            </ReviewSection>

            {/* Banco */}
            <ReviewSection icon={CreditCard} title="Dados Bancarios">
                <ReviewRow label="Banco" value={[formData.bancoCodigo, formData.bancoNome].filter(Boolean).join(" - ")} />
                <ReviewRow label="Agencia" value={[formData.agencia, formData.agenciaDigito].filter(Boolean).join("-")} />
                <ReviewRow label="Conta" value={[formData.conta, formData.contaDigito].filter(Boolean).join("-")} />
            </ReviewSection>

            {/* Trabalhista */}
            <ReviewSection icon={Briefcase} title="Dados Trabalhistas">
                <ReviewRow label="PIS/PASEP" value={formData.pisPasep} />
                <ReviewRow label="CTPS" value={[formData.ctps, formData.ctpsSerie, formData.ctpsUf].filter(Boolean).join(" / ")} />
                <ReviewRow label="Titulo Eleitor" value={formData.tituloEleitorNumero} />
                <ReviewRow label="CNH" value={[formData.cnhNumero, formData.categoriaCnh].filter(Boolean).join(" - Cat. ")} />
                <ReviewRow label="Reservista" value={formData.reservistaNumero} />
            </ReviewSection>

            {/* Dependentes */}
            {dependentes.length > 0 && (
                <ReviewSection icon={Users} title={`Dependentes (${dependentes.length})`}>
                    {dependentes.map((d) => (
                        <div key={d.id} className="text-sm py-1 border-b border-border/20 last:border-b-0">
                            <span className="font-medium">{d.nomeCompleto}</span>
                            <span className="text-muted-foreground ml-2">
                                ({PARENTESCO_LABEL[d.parentesco] || "Outro"})
                                {d.isPcd && " - PCD"}
                            </span>
                        </div>
                    ))}
                </ReviewSection>
            )}

            {/* Submit */}
            {!disabled && (
                <div className="pt-4">
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full min-h-[56px] text-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                        {submitting ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : (
                            <Send className="size-5" />
                        )}
                        Enviar para o RH
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        Apos enviar, o RH vai revisar seus dados e documentos.
                    </p>
                </div>
            )}
        </div>
    );
}

function ReviewSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                <Icon className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: unknown }) {
    const v = value != null ? String(value).trim() : "";
    if (!v) return null;
    return (
        <div className="flex justify-between text-sm py-0.5">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{v}</span>
        </div>
    );
}
