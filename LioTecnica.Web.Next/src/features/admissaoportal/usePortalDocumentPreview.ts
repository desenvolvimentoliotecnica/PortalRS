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
