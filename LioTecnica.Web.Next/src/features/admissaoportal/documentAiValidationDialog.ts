"use client";

import Swal from "sweetalert2";
import type { DocumentValidationResponse } from "./publicApi";

function swalZIndexFix() {
    document.body.style.pointerEvents = "auto";
    const container = Swal.getContainer();
    if (container) container.style.zIndex = "10000";
}

export interface AiValidationDialogContext {
    documentLabel: string;
    sideLabel?: string;
    fileName: string;
}

/** Retorna true se o candidato quer manter o documento enviado. */
export async function confirmDocumentAiValidation(
    aiResult: Pick<DocumentValidationResponse, "isValid" | "confidence" | "validationMessage" | "documentType">,
    ctx: AiValidationDialogContext,
): Promise<boolean> {
    const confidencePct = Math.round((aiResult.confidence ?? 0) * 100);
    const side = ctx.sideLabel ? ` (${ctx.sideLabel})` : "";
    const title = aiResult.isValid ? "Documento reconhecido" : "Validação automática";

    const mainMessage = aiResult.validationMessage?.trim()
        || (aiResult.isValid
            ? "A análise automática identificou este documento corretamente."
            : "A análise automática não conseguiu confirmar se este arquivo corresponde ao documento solicitado.");

    const details: string[] = [
        `<p style="text-align:left;font-size:14px;line-height:1.5;margin:0 0 8px"><strong>${ctx.documentLabel}${side}</strong><br/><span style="color:#64748b;font-size:13px">${ctx.fileName}</span></p>`,
        `<p style="text-align:left;font-size:14px;line-height:1.5;margin:0">${mainMessage}</p>`,
    ];

    if (confidencePct > 0) {
        details.push(`<p style="text-align:left;font-size:12px;color:#64748b;margin:8px 0 0">Confiança da análise: ${confidencePct}%</p>`);
    }

    if (aiResult.documentType) {
        details.push(`<p style="text-align:left;font-size:12px;color:#64748b;margin:4px 0 0">Tipo detectado: ${aiResult.documentType}</p>`);
    }

    details.push(
        `<p style="text-align:left;font-size:14px;line-height:1.5;margin:16px 0 0;padding-top:12px;border-top:1px solid #e2e8f0">` +
        `A validação por IA pode errar (falso positivo ou falso negativo). ` +
        `<strong>Deseja manter este documento enviado?</strong></p>`,
    );

    const result = await Swal.fire({
        icon: aiResult.isValid ? "success" : "warning",
        title,
        html: details.join(""),
        showCancelButton: true,
        confirmButtonText: "Sim, manter documento",
        cancelButtonText: "Não, remover",
        reverseButtons: true,
        focusCancel: !aiResult.isValid,
        didOpen: swalZIndexFix,
    });

    return result.isConfirmed;
}
