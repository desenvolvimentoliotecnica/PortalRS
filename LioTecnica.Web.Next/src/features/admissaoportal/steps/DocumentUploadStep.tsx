"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import DocumentCard from "../components/DocumentCard";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
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
        setUploadedDoc, setUploadedDocVerso,
        setAiExtraction, setAiExtractionVerso,
        mergeAiFields,
    } = useAdmissaoWizardStore();

    const handleFileSelected = useCallback(async (tipo: number, file: File, side: "frente" | "verso") => {
        const isVerso = side === "verso";
        const setDoc = isVerso ? setUploadedDocVerso : setUploadedDoc;
        const setAi  = isVerso ? setAiExtractionVerso : setAiExtraction;

        // Marcar como processando
        setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: true });

        // ── 1. Upload (caminho crítico) ──
        try {
            await uploadFile(session, tipo, file);
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
                mergeAiFields(aiResult.extractedFields);
                toast.success(`${side === "verso" ? "Verso" : "Documento"} reconhecido! Dados preenchidos.`);
            } else if (!aiResult.isValid) {
                toast.warning(aiResult.validationMessage || "Nao foi possivel reconhecer o documento automaticamente.");
            }
        } catch {
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: false });
        }
    }, [session, setUploadedDoc, setUploadedDocVerso, setAiExtraction, setAiExtractionVerso, mergeAiFields, onDataRefresh]);

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
                resolve({ base64, mediaType: file.type || "image/jpeg" });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        };

        img.src = objectUrl;
    });
}

async function uploadFile(session: AdmissaoPortalSession, tipo: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tipo", String(tipo));
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
