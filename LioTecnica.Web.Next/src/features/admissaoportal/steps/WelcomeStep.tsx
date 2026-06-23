"use client";

import { FileText, Upload, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import {
    ADMISSAO_DOC_SECTIONS,
    ADMISSAO_INSTRUCOES_INTRO,
    ADMISSAO_SITES_EXTERNOS,
    sortDocumentosSolicitados,
    type DocSolicitadoItem,
} from "../admissaoDocumentoCatalog";

interface Props {
    nome: string;
    documentosSolicitados: DocSolicitadoItem[];
}

export default function WelcomeStep({ nome, documentosSolicitados }: Props) {
    const firstName = nome.split(" ")[0];
    const sorted = sortDocumentosSolicitados(documentosSolicitados);

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="size-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Olá, {firstName}!</h1>
                <p className="text-muted-foreground">
                    Bem-vindo(a) ao portal de admissão. Aqui você envia todos os documentos solicitados pelo RH.
                </p>
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Relação de documentos para admissão
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{ADMISSAO_INSTRUCOES_INTRO}</p>

                {ADMISSAO_DOC_SECTIONS.map((section) => {
                    const items = section.tipos
                        .map((t) => sorted.find((d) => d.tipo === t))
                        .filter((d): d is DocSolicitadoItem => !!d);
                    if (items.length === 0) return null;

                    return (
                        <div key={section.id} className="space-y-2 pt-2 border-t border-border/30 first:border-0 first:pt-0">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                                {section.title}
                            </h4>
                            {section.description && (
                                <p className="text-xs text-muted-foreground">{section.description}</p>
                            )}
                            {section.id === "sites" && (
                                <ul className="space-y-1 mb-2">
                                    {ADMISSAO_SITES_EXTERNOS.map((site) => (
                                        <li key={site.url}>
                                            <a
                                                href={site.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                                <ExternalLink className="size-3 shrink-0" />
                                                {site.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <ul className="space-y-1.5">
                                {items.map((ds) => (
                                    <li key={ds.tipo} className="flex items-start gap-2 text-sm">
                                        <span className={`mt-1.5 size-2 rounded-full shrink-0 ${ds.jaEnviado ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                                        <span className="flex-1">{ds.label}</span>
                                        {ds.obrigatorio && (
                                            <span className="text-red-500 font-bold leading-none shrink-0" title="Obrigatório">*</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Como funciona
                </h3>
                <div className="space-y-3">
                    <Step icon={Upload} text="Envie cada documento em PDF ou foto (JPG/PNG)" />
                    <Step icon={CheckCircle2} text="Visualize a prévia antes de concluir" />
                    <Step icon={FileText} text="Revise seus dados e envie tudo para o RH" />
                </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <span>Tempo estimado: ~15 minutos</span>
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
