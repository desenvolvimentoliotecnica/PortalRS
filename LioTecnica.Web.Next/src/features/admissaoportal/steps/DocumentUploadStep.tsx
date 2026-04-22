"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm-dialog";
import DocumentCard from "../components/DocumentCard";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { TIPOS_COM_VERSO } from "../constants";
import {
    admissaoPortalFetch,
    validateDocument,
    type AdmissaoPortalSession,
} from "../publicApi";

interface DocSolicitado {
    tipo: number;
    label: string;
    obrigatorio: boolean;
    jaEnviado: boolean;
}

interface Props {
    session: AdmissaoPortalSession;
    documentosSolicitados: DocSolicitado[];
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

    const handleFileSelected = useCallback(async (tipo: number, file: File, side: "frente" | "verso") => {
        const isVerso = side === "verso";
        const setDoc = isVerso ? setUploadedDocVerso : setUploadedDoc;
        const setAi  = isVerso ? setAiExtractionVerso : setAiExtraction;

        // Marcar como processando
        setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: true });

        // ── 1. Upload (caminho crítico) ──
        try {
            await uploadFile(session, tipo, file, side);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro ao enviar documento.";
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: msg, processing: false });
            toast.error(msg);
            return;
        }

        // Upload OK
        setDoc(tipo, { tipo, nomeArquivo: file.name, tamanhoBytes: file.size, status: 0 });
        onDataRefresh();

        // ── 2. Validação via IA (melhor esforço) ──
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
            } else if (!aiResult.isValid) {
                toast.warning(aiResult.validationMessage || "Nao foi possivel reconhecer o documento automaticamente.");
            }
        } catch {
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: false });
        }
    }, [session, formData, setUploadedDoc, setUploadedDocVerso, setAiExtraction, setAiExtractionVerso, mergeAiFields, overwriteAiFields, onDataRefresh]);

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Tire uma foto de cada documento. Para RG e CNH, envie frente e verso separadamente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documentosSolicitados.map((ds) => (
                    <DocumentCard
                        key={ds.tipo}
                        tipo={ds.tipo}
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
    );
}

/** Converte qualquer imagem para JPEG via canvas (aceito pelo OpenAI), redimensionando se necessário. */
async function prepareImageForAi(file: File): Promise<{ base64: string; mediaType: string }> {
    const MAX_DIMENSION = 2048;
    const QUALITY = 0.88;

    // PDFs não passam pelo canvas — envia como está
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
            // Fallback: envia o arquivo original
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
    // lado: 0=Unico, 1=Frente, 2=Verso
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
