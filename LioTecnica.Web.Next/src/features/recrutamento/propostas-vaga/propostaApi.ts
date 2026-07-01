"use client";

import { apiFetch, apiJson } from "@/lib/api";

export type PropostaVagaStatus =
  | "Rascunho"
  | "Enviada"
  | "Visualizada"
  | "Aceita"
  | "Recusada"
  | "Expirada"
  | "Cancelada";

const STATUS_BY_INDEX: PropostaVagaStatus[] = [
  "Rascunho",
  "Enviada",
  "Visualizada",
  "Aceita",
  "Recusada",
  "Expirada",
  "Cancelada",
];

export function resolveStatus(v: number | string): PropostaVagaStatus {
  if (typeof v === "number") return STATUS_BY_INDEX[v] ?? "Rascunho";
  return (v as PropostaVagaStatus) ?? "Rascunho";
}

export type PropostaBeneficioItem = {
  id?: string | null;
  tipo: string | number;
  valor?: number | null;
  recorrencia?: string | number;
  observacoes?: string | null;
};

export type PropostaVagaResponse = {
  id: string;
  vagaId: string;
  vagaTitulo: string | null;
  candidatoId: string;
  candidatoNome: string | null;
  candidatoEmail: string | null;
  candidaturaId: string | null;
  status: number | PropostaVagaStatus;
  moeda: string | null;
  salarioOferecido: number | null;
  descricaoBeneficios: string | null;
  incluirBeneficiosNaProposta: boolean;
  beneficiosSelecionados: PropostaBeneficioItem[];
  dataPrevistaInicio: string | null;
  mensagemPersonalizada: string | null;
  accessToken: string | null;
  enviadaEmUtc: string | null;
  expiraEmUtc: string | null;
  visualizadaEmUtc: string | null;
  respondidaEmUtc: string | null;
  nomeConfirmadoCandidato: string | null;
  motivoRecusa: string | null;
  observacaoInternaRh: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type PropostaVagaPublicaResponse = {
  id: string;
  vagaTitulo: string | null;
  candidatoNome: string | null;
  status: number | PropostaVagaStatus;
  moeda: string | null;
  salarioOferecido: number | null;
  descricaoBeneficios: string | null;
  incluirBeneficiosNaProposta: boolean;
  beneficiosSelecionados: PropostaBeneficioItem[];
  dataPrevistaInicio: string | null;
  mensagemPersonalizada: string | null;
  enviadaEmUtc: string | null;
  expiraEmUtc: string | null;
  respondidaEmUtc: string | null;
};

export type PropostaVagaCreateRequest = {
  vagaId: string;
  candidatoId: string;
  moeda?: string | null;
  salarioOferecido?: number | null;
  descricaoBeneficios?: string | null;
  incluirBeneficiosNaProposta?: boolean | null;
  beneficiosSelecionados?: PropostaBeneficioItem[] | null;
  dataPrevistaInicio?: string | null;
  mensagemPersonalizada?: string | null;
  observacaoInternaRh?: string | null;
};

export type PropostaVagaUpdateRequest = Omit<PropostaVagaCreateRequest, "vagaId" | "candidatoId">;

export async function listPropostas(filters: {
  vagaId?: string;
  candidatoId?: string;
} = {}): Promise<PropostaVagaResponse[]> {
  const params = new URLSearchParams();
  if (filters.vagaId) params.set("vagaId", filters.vagaId);
  if (filters.candidatoId) params.set("candidatoId", filters.candidatoId);
  const qs = params.toString();
  return apiJson<PropostaVagaResponse[]>(`/api/propostas-vaga${qs ? `?${qs}` : ""}`);
}

export async function getProposta(id: string): Promise<PropostaVagaResponse> {
  return apiJson<PropostaVagaResponse>(`/api/propostas-vaga/${id}`);
}

export async function createProposta(req: PropostaVagaCreateRequest): Promise<PropostaVagaResponse> {
  const res = await apiFetch("/api/propostas-vaga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaResponse;
}

export async function updateProposta(id: string, req: PropostaVagaUpdateRequest): Promise<PropostaVagaResponse> {
  const res = await apiFetch(`/api/propostas-vaga/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaResponse;
}

export async function enviarProposta(id: string, prazoDiasResposta?: number): Promise<PropostaVagaResponse> {
  const res = await apiFetch(`/api/propostas-vaga/${id}/enviar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prazoDiasResposta: prazoDiasResposta ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaResponse;
}

export async function reenviarEmailProposta(id: string): Promise<PropostaVagaResponse> {
  const res = await apiFetch(`/api/propostas-vaga/${id}/reenviar-email`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaResponse;
}

export async function cancelarProposta(id: string): Promise<PropostaVagaResponse> {
  const res = await apiFetch(`/api/propostas-vaga/${id}/cancelar`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaResponse;
}

/* ── Fluxo público (sem login) ── */

export async function getPropostaPublica(
  tenantId: string,
  token: string,
): Promise<PropostaVagaPublicaResponse | null> {
  const res = await apiFetch(`/api/public/propostas/${encodeURIComponent(token)}`, {
    headers: { "X-Tenant-Id": tenantId },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as PropostaVagaPublicaResponse;
}

export async function aceitarPropostaPublica(
  tenantId: string,
  token: string,
  nomeConfirmado: string,
): Promise<PropostaVagaPublicaResponse> {
  const res = await apiFetch(`/api/public/propostas/${encodeURIComponent(token)}/aceitar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
    body: JSON.stringify({ nomeConfirmado }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaPublicaResponse;
}

export async function recusarPropostaPublica(
  tenantId: string,
  token: string,
  nomeConfirmado: string,
  motivoRecusa: string | null,
): Promise<PropostaVagaPublicaResponse> {
  const res = await apiFetch(`/api/public/propostas/${encodeURIComponent(token)}/recusar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
    body: JSON.stringify({ nomeConfirmado, motivoRecusa }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP_${res.status}`);
  }
  return (await res.json()) as PropostaVagaPublicaResponse;
}
