"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ExternalLink, Info, Lock } from "lucide-react";
import { confirmDialog } from "@/lib/confirm-dialog";
import DocumentCard from "../components/DocumentCard";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { TIPOS_COM_VERSO } from "../constants";
import {
    ADMISSAO_SITES_EXTERNOS,
    groupDocumentosBySection,
    sortDocumentosSolicitados,
    type DocSolicitadoItem,
} from "../admissaoDocumentoCatalog";
import {
    admissaoPortalFetch,
    removeDocument,
    validateDocument,
    type AdmissaoPortalSession,
} from "../publicApi";

interface Props {
    session: AdmissaoPortalSession;
    documentosSolicitados: DocSolicitadoItem[];
    onDataRefresh: () => void;
    disabled?: boolean;
}

function countDocProgress(
    docs: DocSolicitadoItem[],
    uploadedDocs: Map<number, { tipo: number }>,
    uploadedDocsVerso: Map<number, { tipo: number }>,
): { done: number; total: number } {
    const obrigatorios = docs.filter((d) => d.obrigatorio);
    let done = 0;
    for (const ds of obrigatorios) {
        if (!uploadedDocs.has(ds.tipo)) continue;
        if (TIPOS_COM_VERSO.has(ds.tipo) && !uploadedDocsVerso.has(ds.tipo)) continue;
        done++;
    }
    return { done, total: obrigatorios.length };
}

export default function DocumentUploadStep({ session, documentosSolicitados, onDataRefresh, disabled }: Props) {
    const {
        uploadedDocs, uploadedDocsVerso,
        aiExtractions, aiExtractionsVerso,
        formData,
        setUploadedDoc, setUploadedDocVerso,
        removeUploadedDoc, removeUploadedDocVerso,
        setAiExtraction, setAiExtractionVerso,
        mergeAiFields, overwriteAiFields,
    } = useAdmissaoWizardStore();

    const sorted = useMemo(() => sortDocumentosSolicitados(documentosSolicitados), [documentosSolicitados]);
    const sections = useMemo(() => groupDocumentosBySection(sorted), [sorted]);
    const obrigatorios = useMemo(() => sorted.filter((d) => d.obrigatorio), [sorted]);
    const progress = countDocProgress(sorted, uploadedDocs, uploadedDocsVerso);
    const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    const handleFileSelected = useCallback(async (tipo: number, file: File, side: "frente" | "verso") => {
        const isVerso = side === "verso";
        const setDoc = isVerso ? setUploadedDocVerso : setUploadedDoc;
        const setAi  = isVerso ? setAiExtractionVerso : setAiExtraction;
        const removeDoc = isVerso ? removeUploadedDocVerso : removeUploadedDoc;

        const existing = isVerso ? uploadedDocsVerso.get(tipo) : uploadedDocs.get(tipo);
        if (existing?.id) {
            try {
                await removeDocument(session, existing.id);
                removeDoc(tipo);
            } catch {
                toast.error("Erro ao substituir documento. Tente novamente.");
                return;
            }
        }

        const localPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

        setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: null, processing: true });

        let uploaded: { id?: string; presignedUrl?: string; createdAtUtc?: string } | undefined;
        try {
            uploaded = await uploadFile(session, tipo, file, side);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro ao enviar documento.";
            setAi(tipo, { tipo, isValid: false, confidence: 0, extractedFields: {}, validationMessage: msg, processing: false });
            if (localPreview) URL.revokeObjectURL(localPreview);
            toast.error(msg);
            return;
        }

        setDoc(tipo, {
            id: uploaded?.id,
            tipo,
            nomeArquivo: file.name,
            tamanhoBytes: file.size,
            status: 0,
            thumbnail: localPreview,
            presignedUrl: uploaded?.presignedUrl ?? localPreview,
            createdAtUtc: uploaded?.createdAtUtc,
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
    }, [session, formData, uploadedDocs, uploadedDocsVerso, setUploadedDoc, setUploadedDocVerso, removeUploadedDoc, removeUploadedDocVerso, setAiExtraction, setAiExtractionVerso, mergeAiFields, overwriteAiFields, onDataRefresh]);

    const handleRemove = useCallback(async (tipo: number, side: "frente" | "verso", docId: string) => {
        const ok = await confirmDialog({
            title: "Remover documento?",
            description: "O arquivo será excluído. Você poderá enviar outro documento depois.",
            confirmText: "Remover",
            cancelText: "Cancelar",
        });
        if (!ok) return;

        try {
            await removeDocument(session, docId);
            if (side === "verso") removeUploadedDocVerso(tipo);
            else removeUploadedDoc(tipo);
            toast.success("Documento removido.");
            onDataRefresh();
        } catch {
            toast.error("Erro ao remover documento.");
        }
    }, [session, removeUploadedDoc, removeUploadedDocVerso, onDataRefresh]);

    return (
        <div className="space-y-6 -mt-1">
            {/* Page header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Envio de Documentos</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Envie os documentos solicitados para continuidade do seu processo de admissão.
                </p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 dark:border-blue-800/60 dark:bg-blue-950/20">
                <Info className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">Formatos aceitos:</span> PDF, JPG e PNG.
                    {" "}Tamanho máximo por arquivo: 10MB.
                </p>
            </div>

            {/* Progress */}
            {obrigatorios.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Documentos obrigatórios</span>
                        <span className="text-muted-foreground tabular-nums">
                            {progress.done} de {progress.total} documentos enviados
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}

            {sections.map(({ section, items }) => (
                <div key={section.id} className="space-y-4">
                    {section.id !== "principal" && (
                        <div>
                            <h2 className="text-base font-semibold">{section.title}</h2>
                            {section.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                            )}
                        </div>
                    )}

                    {section.id === "sites" && (
                        <ul className="space-y-1.5">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {items.map((ds) => {
                            const obrigatorioIndex = obrigatorios.findIndex((o) => o.tipo === ds.tipo);
                            const index = obrigatorioIndex >= 0 ? obrigatorioIndex + 1 : 0;
                            return (
                                <DocumentCard
                                    key={ds.tipo}
                                    index={index}
                                    tipo={ds.tipo}
                                    labelOverride={ds.label}
                                    obrigatorio={ds.obrigatorio}
                                    uploadedDoc={uploadedDocs.get(ds.tipo)}
                                    uploadedDocVerso={uploadedDocsVerso.get(ds.tipo)}
                                    aiResult={aiExtractions.get(ds.tipo)}
                                    aiResultVerso={aiExtractionsVerso.get(ds.tipo)}
                                    onFileSelected={handleFileSelected}
                                    onRemove={handleRemove}
                                    disabled={disabled}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Security notice */}
            <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                <Lock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Seus documentos estão seguros. Todas as informações são protegidas e utilizadas
                    apenas para o processo de admissão.
                </p>
            </div>
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
    const body = await res.json() as { id?: string; presignedUrl?: string; createdAtUtc?: string };
    return body;
}
