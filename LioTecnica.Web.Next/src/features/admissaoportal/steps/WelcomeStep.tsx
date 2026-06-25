"use client";

import { FileText, Upload, ClipboardList, Users, Send, Clock, Shield } from "lucide-react";
import WizardStepPanel from "../components/WizardStepPanel";

interface Props {
    nome: string;
    documentCount: number;
}

const PROCESS_STEPS = [
    { icon: Upload, title: "Envio de documentos", desc: "Um documento por vez, em PDF ou foto." },
    { icon: ClipboardList, title: "Seus dados", desc: "Revise e complete suas informações pessoais." },
    { icon: Users, title: "Dependentes", desc: "Informe se possui dependentes, se aplicável." },
    { icon: Send, title: "Revisão e envio", desc: "Confira tudo e envie para o RH." },
] as const;

export default function WelcomeStep({ nome, documentCount }: Props) {
    const firstName = nome.split(" ")[0];

    return (
        <WizardStepPanel wide>
            <div className="flex flex-col items-center text-center gap-8">
                <div className="size-28 sm:size-32 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="size-14 sm:size-16 text-primary" />
                </div>

                <div className="space-y-3 max-w-xl">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Olá, {firstName}!
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                        Bem-vindo(a) ao portal de admissão. Você enviará{" "}
                        <strong className="text-foreground">{documentCount} documentos</strong>,{" "}
                        preencherá seus dados e revisará tudo antes de enviar ao RH.
                    </p>
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    {PROCESS_STEPS.map(({ icon: Icon, title, desc }) => (
                        <div
                            key={title}
                            className="rounded-xl border border-border/50 bg-muted/20 p-5 space-y-2"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <Icon className="size-5 text-primary" />
                                </span>
                                <span className="text-sm sm:text-base font-semibold leading-tight">{title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-snug pl-14">{desc}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                        <Clock className="size-4" /> ~15 min
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <Shield className="size-4" /> Dados protegidos
                    </span>
                    <span>PDF, JPG ou PNG · máx. 10MB</span>
                </div>
            </div>
        </WizardStepPanel>
    );
}
