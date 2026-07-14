"use client";

import { apiJson } from "@/lib/api";
import type { EtapaMacroCandidatura } from "./candidaturaApi";

export type EmailTemplateListItem = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  subjectTemplate: string | null;
  version?: number;
  isActive: boolean;
  isCustomized: boolean;
  tags: string[];
};

export type EmailTemplateDetail = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  subjectTemplate: string;
  bodyHtml: string;
  tags: string[];
  version: number;
  isActive: boolean;
  isCustomized: boolean;
};

const DEFAULT_TEMPLATE_BY_ETAPA: Partial<Record<EtapaMacroCandidatura, string>> = {
  EmTriagem: "EtapaEmTriagem",
  Entrevista: "EtapaEntrevista",
  EntrevistaTecnica: "EtapaEntrevistaTecnica",
  Teste: "EtapaTeste",
  Contratado: "EtapaContratado",
  ReprovadoRh: "EtapaReprovadoRh",
  ReprovadoGestor: "EtapaReprovadoGestor",
  Recusado: "EtapaRecusado",
  Desistiu: "EtapaDesistiu",
  Proposta: "PropostaVaga",
};

export function defaultEmailTemplateForEtapa(etapa: EtapaMacroCandidatura | "" | null | undefined): string {
  if (!etapa) return "EtapaRecusado";
  return DEFAULT_TEMPLATE_BY_ETAPA[etapa] ?? "EtapaRecusado";
}

export function listEmailTemplates() {
  return apiJson<EmailTemplateListItem[]>("/api/email-templates");
}

export function getEmailTemplateByCode(code: string) {
  return apiJson<EmailTemplateDetail>(`/api/email-templates/by-code/${encodeURIComponent(code)}`);
}

/** Substitui {{Tag}} no texto; tags desconhecidas ficam vazias. */
export function applyEmailTokens(template: string, tokens: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_m, key: string) => {
    const value = tokens[key] ?? tokens[key.charAt(0).toUpperCase() + key.slice(1)];
    return value ?? "";
  });
}

export function htmlToPlainish(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
