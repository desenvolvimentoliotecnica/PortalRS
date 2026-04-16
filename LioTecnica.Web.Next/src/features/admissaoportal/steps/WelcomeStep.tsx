"use client";

import { FileText, Camera, Clock, CheckCircle2 } from "lucide-react";
import { TIPO_DOC_LABELS } from "../constants";

interface DocSolicitado {
    tipo: number;
    label: string;
    obrigatorio: boolean;
    jaEnviado: boolean;
}

interface Props {
    nome: string;
    documentosSolicitados: DocSolicitado[];
}

export default function WelcomeStep({ nome, documentosSolicitados }: Props) {
    const firstName = nome.split(" ")[0];

    return (
        <div className="space-y-6">
            {/* Greeting */}
            <div className="text-center space-y-2">
                <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="size-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Ola, {firstName}!</h1>
                <p className="text-muted-foreground">
                    Vamos preparar sua admissao. E rapido e simples.
                </p>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Como funciona
                </h3>
                <div className="space-y-3">
                    <Step icon={Camera} text="Voce tira fotos dos seus documentos" />
                    <Step icon={CheckCircle2} text="Nos preenchemos tudo automaticamente" />
                    <Step icon={FileText} text="Voce revisa e envia para o RH" />
                </div>
            </div>

            {/* Documents needed */}
            {documentosSolicitados.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Documentos que voce vai precisar
                    </h3>
                    <ul className="space-y-2">
                        {documentosSolicitados.map((ds) => (
                            <li key={ds.tipo} className="flex items-center gap-2 text-sm">
                                <span className={`size-2 rounded-full ${ds.jaEnviado ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                                <span>{ds.label}</span>
                                {ds.obrigatorio && (
                                    <span className="text-red-500 font-bold text-base leading-none" title="Obrigatório">*</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Estimated time */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <span>Tempo estimado: ~10 minutos</span>
            </div>
        </div>
    );
}

function Step({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="size-4 text-primary" />
            </div>
            <span className="text-sm">{text}</span>
        </div>
    );
}
