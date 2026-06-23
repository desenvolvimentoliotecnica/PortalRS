"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { confirmDialog } from "@/lib/confirm-dialog";
import DocumentCard from "../components/DocumentCard";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { TIPOS_COM_VERSO } from "../constants";
import {
    ADMISSAO_INSTRUCOES_INTRO,
    ADMISSAO_SITES_EXTERNOS,
    groupDocumentosBySection,
    type DocSolicitadoItem,
} from "../admissaoDocumentoCatalog";
import {
    admissaoPortalFetch,
    validateDocument,
    type AdmissaoPortalSession,
} from "../publicApi";

interface Props {
    session: AdmissaoPortalSession;
    documentosSolicitados: DocSolicitadoItem[];
    onDataRefresh: () => void;
    disabled?: boolean;
}

export default function DocumentUploadStep({ session, documentosSolicitados, onDataRefresh, disabled }: Props) {
    const {
        uploadedDocs, uploadedDocsVerso,
        aiExtractions, aiExtractionsVerso,
        formData,
        setUploadedDoc, setUploadedDocVerso,
        setAiExtraction, setAiExtractionVerso,
        mergeAiFields, overwriteAiFields,
    } = useAdmissaoWizardStore();

    const sections = groupDocumentosBySection(documentosSolicitados);

    const handleFileSelected = useCallback(async (tipo: number, file: File, side: "frente" | "verso") => {
        const isVerso = side === "verso";
        const setDoc = isVerso ? setUploadedDocVerso : setUploadedDoc;
        const setAi  = isVerso ? setAiExtractionVerso : setAiExtraction;

        const localPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

        setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: true });

        try {
            await uploadFile(session, tipo, file, side);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro ao enviar documento.";
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: msg, processing: false });
            if (localPreview) URL.revokeObjectURL(localPreview);
            toast.error(msg);
            return;
        }

        setDoc(tipo, {
            tipo,
            nomeArquivo: file.name,
            tamanhoBytes: file.size,
            status: 0,
            thumbnail: localPreview,
        });
        onDataRefresh();

        try {
            const { base64, mediaType } = await prepareImageForAi(file);
            const aiResult = await validateDocument(session, tipo, base64, mediaType);

            setAi(tipo, {
                tipo,
                isValid: aiResult.isValid,
                confidence: aiResult.confidence,
                documentType: aiResult.documentType ?? null,
                extractedFields: aiResult.extractedFields,
                validationMessage: aiResult.validationMessage,
                processing: false,
            });

            if (aiResult.isValid && Object.keys(aiResult.extractedFields).length > 0) {
                const conflitos = Object.entries(aiResult.extractedFields).filter(
                    ([key, value]) => value != null && value !== "" && formData[key] != null && formData[key] !== ""
                );

                if (conflitos.length > 0) {
                    const sobrescrever = await confirmDialog({
                        title: "Sobrescrever informações?",
                        description: "A IA identificou dados que já foram preenchidos no formulário. Deseja substituir as informações existentes pelos dados reconhecidos?",
                        confirmText: "Sim, substituir",
                        cancelText: "Não, manter",
                    });
                    if (sobrescrever) {
                        overwriteAiFields(aiResult.extractedFields);
                    } else {
                        mergeAiFields(aiResult.extractedFields);
                    }
                } else {
                    mergeAiFields(aiResult.extractedFields);
                }
                toast.success(`${side === "verso" ? "Verso" : "Documento"} reconhecido! Dados preenchidos.`);
            } else if (!aiResult.isValid && mediaType !== "application/pdf") {
                toast.warning(aiResult.validationMessage || "Não foi possível reconhecer o documento automaticamente.");
            }
        } catch {
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: false });
        }
    }, [session, formData, setUploadedDoc, setUploadedDocVerso, setAiExtraction, setAiExtractionVerso, mergeAiFields, overwriteAiFields, onDataRefresh]);

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
                    Relação de documentos para admissão
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{ADMISSAO_INSTRUCOES_INTRO}</p>
            </div>

            {sections.map(({ section, items }) => (
                <div key={section.id} className="space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold">{section.title}</h3>
                        {section.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                        )}
                    </div>

                    {section.id === "sites" && (
                        <ul className="space-y-1.5 mb-2">
                            {ADMISSAO_SITES_EXTERNOS.map((site) => (
                                <li key={site.url}>
                                    <a
                                        href={site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                    >
                                        <ExternalLink className="size-3.5 shrink-0" />
                                        {site.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((ds) => (
                            <DocumentCard
                                key={ds.tipo}
                                tipo={ds.tipo}
                                labelOverride={ds.label}
                                obrigatorio={ds.obrigatorio}
                                uploadedDoc={uploadedDocs.get(ds.tipo)}
                                uploadedDocVerso={uploadedDocsVerso.get(ds.tipo)}
                                aiResult={aiExtractions.get(ds.tipo)}
                                aiResultVerso={aiExtractionsVerso.get(ds.tipo)}
                                onFileSelected={handleFileSelected}
                                disabled={disabled}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

async function prepareImageForAi(file: File): Promise<{ base64: string; mediaType: string }> {
    const MAX_DIMENSION = 2048;
    const QUALITY = 0.88;

    if (file.type === "application/pdf") {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = () => {
                const base64 = (reader.result as string).split(",")[1];
                resolve({ base64, mediaType: "application/pdf" });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { naturalWidth: w, naturalHeight: h } = img;
            if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
                if (w > h) { h = Math.round(h * MAX_DIMENSION / w); w = MAX_DIMENSION; }
                else { w = Math.round(w * MAX_DIMENSION / h); h = MAX_DIMENSION; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
            resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(",")[1];
                const SUPPORTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
                const mediaType = SUPPORTED.includes(file.type) ? file.type : "image/jpeg";
                resolve({ base64, mediaType });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        };

        img.src = objectUrl;
    });
}

async function uploadFile(session: AdmissaoPortalSession, tipo: number, file: File, side: "frente" | "verso") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tipo", String(tipo));
    const lado = side === "verso" ? 2 : TIPOS_COM_VERSO.has(tipo) ? 1 : 0;
    fd.append("lado", String(lado));
    const res = await admissaoPortalFetch(
        session.tenantId,
        `/api/public/admissao-portal/${session.preAdmissaoId}/documentos`,
        session.cpf,
        { method: "POST", body: fd },
    );
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || `Erro ao enviar documento (${res.status}).`);
    }
    return res.json();
}
