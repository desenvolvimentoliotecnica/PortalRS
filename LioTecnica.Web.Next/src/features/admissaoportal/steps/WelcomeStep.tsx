"use client";

import { FileText, Upload, ClipboardList, Users, Send, Clock, Shield } from "lucide-react";
import type { DocSolicitadoItem } from "../admissaoDocumentoCatalog";

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
        <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto text-center gap-5 py-2">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="size-10 text-primary" />
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Olá, {firstName}!
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Bem-vindo(a) ao portal de admissão. Você enviará{" "}
                    <strong className="text-foreground">{documentCount} documentos</strong>,{" "}
                    preencherá seus dados e revisará tudo antes de enviar ao RH.
                </p>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 text-left">
                {PROCESS_STEPS.map(({ icon: Icon, title, desc }) => (
                    <div
                        key={title}
                        className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5"
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Icon className="size-3.5 text-primary" />
                            </span>
                            <span className="text-xs font-semibold leading-tight">{title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug pl-9">{desc}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> ~15 min
                </span>
                <span className="inline-flex items-center gap-1">
                    <Shield className="size-3.5" /> Dados protegidos
                </span>
                <span>PDF, JPG ou PNG · máx. 10MB</span>
            </div>
        </div>
    );
}
