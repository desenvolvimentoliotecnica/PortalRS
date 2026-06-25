"use client";

import React from "react";
import { User, MapPin, Phone, CreditCard, Briefcase, Users } from "lucide-react";
import WizardStepPanel from "../components/WizardStepPanel";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";

const PARENTESCO_LABEL: Record<number, string> = { 0: "Conjuge", 1: "Filho(a)", 2: "Pai", 3: "Mae", 4: "Outro" };

interface Props {
    disabled?: boolean;
}

export default function ReviewStep({ disabled }: Props) {
    const { formData, dependentes } = useAdmissaoWizardStore();

    return (
        <WizardStepPanel wide>
        <div className="space-y-6">
            <div className="text-center space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Revisão e Envio</h2>
                <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                    Confira o que você preencheu antes de enviar. A analista de RH revisará seus dados e documentos
                    e entrará em contato caso precise de ajustes ou informações adicionais.
                </p>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 dark:bg-blue-900/20 dark:border-blue-800">
                <p className="text-base text-blue-700 dark:text-blue-300">
                    Você pode enviar mesmo com campos em branco. O RH analisará e solicitará complementos, se necessário.
                </p>
            </div>

            {disabled && (
                <div className="rounded-lg bg-muted/50 border border-border/40 px-5 py-4 text-base text-muted-foreground text-center">
                    Seus dados já foram enviados e estão em revisão pelo RH.
                </div>
            )}

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
                        <div key={d.id} className="text-base py-1.5 border-b border-border/20 last:border-b-0">
                            <span className="font-medium">{d.nomeCompleto}</span>
                            <span className="text-muted-foreground ml-2">
                                ({PARENTESCO_LABEL[d.parentesco] || "Outro"})
                                {d.isPcd && " - PCD"}
                            </span>
                        </div>
                    ))}
                </ReviewSection>
            )}
        </div>
        </WizardStepPanel>
    );
}

function ReviewSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/40 bg-muted/10 p-5">
            <div className="flex items-center gap-3 mb-4">
                <Icon className="size-6 text-primary" />
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: unknown }) {
    const v = value != null ? String(value).trim() : "";
    if (!v) return null;
    return (
        <div className="flex justify-between text-base py-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{v}</span>
        </div>
    );
}
