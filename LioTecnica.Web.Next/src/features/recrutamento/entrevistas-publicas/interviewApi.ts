"use client";

import { apiFetch } from "@/lib/api";

export type PublicInterviewResponse = {
  id: string;
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  status: string;
  location: string | null;
  owner: string | null;
  candidate: string | null;
  vagaTitle: string | null;
  vagaCode: string | null;
  candidateResponseStatus: string | null;
  candidateRespondedAtUtc: string | null;
  candidateSuggestedStartAtUtc: string | null;
  candidateSuggestedEndAtUtc: string | null;
  candidateResponseMessage: string | null;
};

export async function getPublicInterview(
  tenantId: string,
  token: string,
): Promise<PublicInterviewResponse | null> {
  const res = await apiFetch(`/api/public/interviews/${encodeURIComponent(token)}`, {
    headers: { "X-Tenant-Id": tenantId },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as PublicInterviewResponse;
}

export async function confirmPublicInterview(
  tenantId: string,
  token: string,
): Promise<PublicInterviewResponse> {
  const res = await apiFetch(`/api/public/interviews/${encodeURIComponent(token)}/confirm`, {
    method: "POST",
    headers: { "X-Tenant-Id": tenantId },
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as PublicInterviewResponse;
}

export async function suggestPublicInterviewTime(
  tenantId: string,
  token: string,
  suggestedStartAtUtc: string,
  suggestedEndAtUtc: string,
  message: string | null,
): Promise<PublicInterviewResponse> {
  const res = await apiFetch(`/api/public/interviews/${encodeURIComponent(token)}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
    body: JSON.stringify({ suggestedStartAtUtc, suggestedEndAtUtc, message }),
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as PublicInterviewResponse;
}
