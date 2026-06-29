"use client";

import { apiFetch } from "@/lib/api";

const STORAGE_PREFIX = "renderrh.admissaoPortal.";

export type AdmissaoPortalSession = {
    tenantId: string;
    preAdmissaoId: string;
    cpf: string;
    nome?: string;
};

function key(tenantId: string) {
    return `${STORAGE_PREFIX}${tenantId.toLowerCase()}`;
}

export function saveAdmissaoPortalSession(session: AdmissaoPortalSession) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key(session.tenantId), JSON.stringify(session)); } catch {}
}

export function getAdmissaoPortalSession(tenantId: string): AdmissaoPortalSession | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(key(tenantId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AdmissaoPortalSession> | null;
        if (!parsed?.preAdmissaoId || !parsed?.cpf) return null;
        return {
            tenantId,
            preAdmissaoId: String(parsed.preAdmissaoId),
            cpf: String(parsed.cpf),
            nome: parsed.nome ? String(parsed.nome) : undefined,
        };
    } catch { return null; }
}

export function clearAdmissaoPortalSession(tenantId: string) {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(key(tenantId)); } catch {}
}

export async function admissaoPortalFetch(
    tenantId: string,
    path: string,
    cpf: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("X-Tenant-Id")) headers.set("X-Tenant-Id", tenantId);
    headers.set("X-Cpf", cpf);
    return apiFetch(path, { ...init, headers });
}

// ── Typed API helpers ──

function basePath(session: AdmissaoPortalSession) {
    return `/api/public/admissao-portal/${session.preAdmissaoId}`;
}

export async function validateDocument(
    session: AdmissaoPortalSession,
    tipoDocumento: number,
    imageBase64: string,
    mediaType: string,
) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/validate-document`, session.cpf, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoDocumento, imageBase64, mediaType }),
    });
    if (!res.ok) throw new Error("Falha na validação");
    return res.json() as Promise<DocumentValidationResponse>;
}

export async function listDependentes(session: AdmissaoPortalSession) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/dependentes`, session.cpf);
    if (!res.ok) throw new Error("Falha ao listar dependentes");
    return res.json() as Promise<DependenteResponse[]>;
}

export async function addDependente(session: AdmissaoPortalSession, data: DependentePayload) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/dependentes`, session.cpf, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Falha ao adicionar dependente");
    return res.json() as Promise<DependenteResponse>;
}

export async function updateDependente(session: AdmissaoPortalSession, id: string, data: DependentePayload) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/dependentes/${id}`, session.cpf, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Falha ao atualizar dependente");
    return res.json() as Promise<DependenteResponse>;
}

export async function removeDependente(session: AdmissaoPortalSession, id: string) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/dependentes/${id}`, session.cpf, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Falha ao remover dependente");
}

export async function saveWizardProgress(session: AdmissaoPortalSession, currentStep: number, completionPercent: number) {
    await admissaoPortalFetch(session.tenantId, `${basePath(session)}/wizard-progress`, session.cpf, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep, completionPercent }),
    });
}

export async function removeDocument(session: AdmissaoPortalSession, docId: string) {
    const res = await admissaoPortalFetch(
        session.tenantId,
        `${basePath(session)}/documentos/${docId}`,
        session.cpf,
        { method: "DELETE" },
    );
    if (!res.ok) throw new Error("Falha ao remover documento.");
}

export async function sendAtendimento(session: AdmissaoPortalSession, assunto: string, mensagem: string) {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/atendimento`, session.cpf, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto, mensagem }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao enviar mensagem.");
    }
    return res.json() as Promise<{ ok: boolean; message?: string }>;
}

export async function downloadComprovanteEnvio(session: AdmissaoPortalSession): Promise<void> {
    const res = await admissaoPortalFetch(session.tenantId, `${basePath(session)}/comprovante`, session.cpf);
    if (!res.ok) throw new Error("Comprovante não disponível.");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `comprovante-admissao-${session.preAdmissaoId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

// ── Types ──

export interface DocumentValidationResponse {
    isValid: boolean;
    confidence: number;
    documentType: string | null;
    extractedFields: Record<string, string | null>;
    validationMessage: string | null;
}

export interface DependenteResponse {
    id: string;
    nomeCompleto: string;
    parentesco: number;
    cpf: string | null;
    dataNascimento: string;
    isPcd: boolean;
}

export interface DependentePayload {
    nomeCompleto: string;
    parentesco: number;
    cpf: string | null;
    dataNascimento: string;
    isPcd: boolean;
}
