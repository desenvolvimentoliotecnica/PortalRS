"use client";

import { apiFetch } from "@/lib/api";

export type VagaRetornoNegativoPreviewItem = {
  candidaturaId: string;
  candidatoId: string;
  candidatoNome: string;
  candidatoEmail: string | null;
  candidatoFone: string | null;
  candidatoCelular: string | null;
  etapaAtual: string | number;
};

export type VagaRetornoNegativoPreviewResponse = {
  vagaId: string;
  vagaTitulo: string;
  destinatarios: VagaRetornoNegativoPreviewItem[];
  templateAssunto: string;
  templateCorpo: string;
};

export type VagaRetornoNegativoEnviarItemResult = {
  candidaturaId: string;
  sucesso: boolean;
  mensagemErro: string | null;
};

export type VagaRetornoNegativoEnviarResponse = {
  enviados: number;
  falhas: number;
  resultados: VagaRetornoNegativoEnviarItemResult[];
};

export async function previewRetornoNegativo(
  vagaId: string,
  emailTemplateCode?: string | null,
): Promise<VagaRetornoNegativoPreviewResponse | null> {
  const qs = emailTemplateCode
    ? `?emailTemplateCode=${encodeURIComponent(emailTemplateCode)}`
    : "";
  const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/retorno-negativo/preview${qs}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as VagaRetornoNegativoPreviewResponse;
}

export async function enviarRetornoNegativo(
  vagaId: string,
  candidaturaIds: string[],
  emailTemplateCode?: string | null,
  emailSubjectOverride?: string | null,
  emailBodyHtmlOverride?: string | null,
): Promise<VagaRetornoNegativoEnviarResponse> {
  const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/retorno-negativo/enviar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidaturaIds,
      emailTemplateCode: emailTemplateCode ?? null,
      emailSubjectOverride: emailSubjectOverride ?? null,
      emailBodyHtmlOverride: emailBodyHtmlOverride ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as VagaRetornoNegativoEnviarResponse;
}
