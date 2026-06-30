"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function preAdmissaoDocumentDownloadPath(preAdmissaoId: string, docId: string) {
    return `/api/pre-admissao/${preAdmissaoId}/documentos/${docId}/download`;
}

function isDirectUrl(url: string) {
    return /^https?:\/\//i.test(url);
}

function isApiDownloadUrl(url: string) {
    return url.startsWith("/api/");
}

function resolveDownloadPath(preAdmissaoId: string, docId: string, presignedUrl?: string | null) {
    const trimmed = presignedUrl?.trim() ?? "";
    if (trimmed && isApiDownloadUrl(trimmed)) return trimmed;
    return preAdmissaoDocumentDownloadPath(preAdmissaoId, docId);
}

/** Resolve URL de preview — presigned S3 direto ou blob via API autenticada. */
export function usePreAdmissaoDocumentPreview(
    preAdmissaoId: string,
    doc: { id: string; presignedUrl?: string | null } | undefined,
): string | undefined {
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(() => {
        const trimmed = doc?.presignedUrl?.trim() ?? "";
        return trimmed && isDirectUrl(trimmed) ? trimmed : undefined;
    });

    useEffect(() => {
        if (!doc?.id) {
            setPreviewUrl(undefined);
            return;
        }

        const trimmed = doc.presignedUrl?.trim() ?? "";
        if (trimmed && isDirectUrl(trimmed)) {
            setPreviewUrl(trimmed);
            return;
        }

        let cancelled = false;
        let objectUrl: string | undefined;

        void (async () => {
            try {
                const res = await apiFetch(resolveDownloadPath(preAdmissaoId, doc.id, doc.presignedUrl));
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
    }, [preAdmissaoId, doc?.id, doc?.presignedUrl]);

    return previewUrl;
}

export async function downloadPreAdmissaoDocument(
    preAdmissaoId: string,
    doc: { id: string; nomeArquivo: string; presignedUrl?: string | null },
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

    const res = await apiFetch(resolveDownloadPath(preAdmissaoId, doc.id, doc.presignedUrl));
    if (!res.ok) throw new Error("Falha ao baixar documento.");
    const blob = await res.blob();
    triggerDownload(URL.createObjectURL(blob), true);
}

export function usePreAdmissaoDocumentDownload(
    preAdmissaoId: string,
    doc: { id: string; nomeArquivo: string; presignedUrl?: string | null } | undefined,
    previewUrl?: string,
) {
    const [downloading, setDownloading] = useState(false);

    const download = useCallback(async () => {
        if (!doc?.id) return;
        setDownloading(true);
        try {
            await downloadPreAdmissaoDocument(preAdmissaoId, doc, previewUrl);
        } finally {
            setDownloading(false);
        }
    }, [preAdmissaoId, doc, previewUrl]);

    return { downloading, download };
}
