"use client";

import { useEffect, useState } from "react";
import type { UploadedDoc } from "./useAdmissaoWizardStore";
import { admissaoPortalFetch, type AdmissaoPortalSession } from "./publicApi";

function resolveImmediatePreview(doc: UploadedDoc): string | undefined {
    if (doc.thumbnail) return doc.thumbnail;
    if (doc.presignedUrl && doc.presignedUrl.trim().length > 0) return doc.presignedUrl;
    return undefined;
}

/** Resolve URL de preview — blob local, presigned S3 ou download autenticado por API. */
export function usePortalDocumentPreview(
    session: AdmissaoPortalSession | undefined,
    doc: UploadedDoc | undefined,
): string | undefined {
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(() =>
        doc ? resolveImmediatePreview(doc) : undefined,
    );

    useEffect(() => {
        if (!doc) {
            setPreviewUrl(undefined);
            return;
        }

        const immediate = resolveImmediatePreview(doc);
        if (immediate) {
            setPreviewUrl(immediate);
            return;
        }

        if (!session || !doc.id) {
            setPreviewUrl(undefined);
            return;
        }

        let cancelled = false;
        let objectUrl: string | undefined;

        void (async () => {
            try {
                const res = await admissaoPortalFetch(
                    session.tenantId,
                    `/api/public/admissao-portal/${session.preAdmissaoId}/documentos/${doc.id}/download`,
                    session.cpf,
                );
                if (!res.ok || cancelled) return;
                const blob = await res.blob();
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setPreviewUrl(objectUrl);
            } catch {
                if (!cancelled) setPreviewUrl(undefined);
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [doc, session, doc?.id, doc?.thumbnail, doc?.presignedUrl]);

    return previewUrl;
}

export function portalDocumentDownloadPath(session: AdmissaoPortalSession, docId: string) {
    return `/api/public/admissao-portal/${session.preAdmissaoId}/documentos/${docId}/download`;
}

/** Baixa documento do portal — usa URL já resolvida ou busca via API autenticada. */
export async function downloadPortalDocument(
    session: AdmissaoPortalSession | undefined,
    doc: UploadedDoc,
    previewUrl?: string,
): Promise<void> {
    const fileName = doc.nomeArquivo || "documento";

    const triggerDownload = (url: string, revoke?: boolean) => {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        if (revoke) URL.revokeObjectURL(url);
    };

    if (previewUrl) {
        triggerDownload(previewUrl);
        return;
    }

    if (!session || !doc.id) {
        throw new Error("Arquivo indisponível para download.");
    }

    const res = await admissaoPortalFetch(
        session.tenantId,
        portalDocumentDownloadPath(session, doc.id),
        session.cpf,
    );
    if (!res.ok) throw new Error("Falha ao baixar documento.");
    const blob = await res.blob();
    triggerDownload(URL.createObjectURL(blob), true);
}
