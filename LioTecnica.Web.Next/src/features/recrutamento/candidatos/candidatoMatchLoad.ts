import { apiFetch } from "@/lib/api";
import {
  calcMatch,
  mapVagaDetail,
  MATCHING_FETCH_TIMEOUT_MS,
  type MatchResult,
} from "@/features/recrutamento/matching/matchingHelpers";

export type MatchingBreakdownCriterio = {
  nome: string;
  peso: number;
  score: number;
  contribuicao: number;
  itensCobertos: string[];
  itensFaltando: string[];
};

export type MatchingBreakdownData = {
  candidatoId: string;
  vagaId: string;
  scoreFinal: number;
  passouMatchMinimo: boolean;
  distanciaKm: number | null;
  criterios: MatchingBreakdownCriterio[];
  temRequisitoObrigatorioFaltando: boolean;
  requisitosObrigatoriosFaltando: string[];
  modo?: string;
  scoreSemantico?: number | null;
  scoreLexico?: number | null;
  evidenciasSemanticas?: Array<{
    categoria: string;
    subcategoria: string | null;
    texto: string;
    similaridade: number;
  }> | null;
  explicacaoIa?: string | null;
};

export type CandidatoMatchTabData =
  | { kind: "breakdown"; data: MatchingBreakdownData }
  | { kind: "lexical"; data: MatchResult; hint: string };

async function parseApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) return `HTTP ${res.status}`;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const m = j.message ?? j.title ?? j.detail;
    if (typeof m === "string" && m.trim()) return m.trim();
  } catch {
    /* ignore */
  }
  return raw.trim();
}

function mapBreakdown(json: Record<string, unknown>): MatchingBreakdownData {
  const critRaw = json.criterios ?? json.Criterios;
  const criterios = Array.isArray(critRaw)
    ? critRaw.map((c) => {
        const row = c as Record<string, unknown>;
        const cob = row.itensCobertos ?? row.ItensCobertos;
        const fal = row.itensFaltando ?? row.ItensFaltando;
        return {
          nome: String(row.nome ?? row.Nome ?? ""),
          peso: Number(row.peso ?? row.Peso ?? 0),
          score: Number(row.score ?? row.Score ?? 0),
          contribuicao: Number(row.contribuicao ?? row.Contribuicao ?? 0),
          itensCobertos: Array.isArray(cob) ? cob.map(String) : [],
          itensFaltando: Array.isArray(fal) ? fal.map(String) : [],
        };
      })
    : [];

  const evRaw = json.evidenciasSemanticas ?? json.EvidenciasSemanticas;
  const evidenciasSemanticas = Array.isArray(evRaw)
    ? evRaw.map((e) => {
        const row = e as Record<string, unknown>;
        return {
          categoria: String(row.categoria ?? row.Categoria ?? ""),
          subcategoria: (row.subcategoria ?? row.Subcategoria) != null ? String(row.subcategoria ?? row.Subcategoria) : null,
          texto: String(row.texto ?? row.Texto ?? ""),
          similaridade: Number(row.similaridade ?? row.Similaridade ?? 0),
        };
      })
    : null;

  const reqFalt = json.requisitosObrigatoriosFaltando ?? json.RequisitosObrigatoriosFaltando;

  return {
    candidatoId: String(json.candidatoId ?? json.CandidatoId ?? ""),
    vagaId: String(json.vagaId ?? json.VagaId ?? ""),
    scoreFinal: Number(json.scoreFinal ?? json.ScoreFinal ?? 0),
    passouMatchMinimo: !!(json.passouMatchMinimo ?? json.PassouMatchMinimo),
    distanciaKm:
      json.distanciaKm != null || json.DistanciaKm != null
        ? Number(json.distanciaKm ?? json.DistanciaKm)
        : null,
    criterios,
    temRequisitoObrigatorioFaltando: !!(json.temRequisitoObrigatorioFaltando ?? json.TemRequisitoObrigatorioFaltando),
    requisitosObrigatoriosFaltando: Array.isArray(reqFalt) ? reqFalt.map(String) : [],
    modo: json.modo != null ? String(json.modo) : json.Modo != null ? String(json.Modo) : undefined,
    scoreSemantico:
      json.scoreSemantico != null || json.ScoreSemantico != null
        ? Number(json.scoreSemantico ?? json.ScoreSemantico)
        : null,
    scoreLexico:
      json.scoreLexico != null || json.ScoreLexico != null
        ? Number(json.scoreLexico ?? json.ScoreLexico)
        : null,
    evidenciasSemanticas,
    explicacaoIa:
      typeof json.explicacaoIa === "string"
        ? json.explicacaoIa
        : typeof json.ExplicacaoIa === "string"
          ? json.ExplicacaoIa
          : null,
  };
}

/** Carrega match explicável (DNALIO/IA) ou fallback léxico por palavras-chave. */
export async function loadCandidatoMatchTab(
  vagaId: string,
  candidatoId: string,
  cvText: string,
): Promise<CandidatoMatchTabData> {
  const endpoints = [
    `/api/vagas/${encodeURIComponent(vagaId)}/matching-breakdown-hybrid/${encodeURIComponent(candidatoId)}`,
    `/api/vagas/${encodeURIComponent(vagaId)}/matching-breakdown/${encodeURIComponent(candidatoId)}`,
  ];

  let last404Message: string | null = null;

  for (const url of endpoints) {
    const res = await apiFetch(
      url,
      { headers: { Accept: "application/json" }, cache: "no-store" },
      MATCHING_FETCH_TIMEOUT_MS,
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      return { kind: "breakdown", data: mapBreakdown(json) };
    }
    if (res.status === 404) {
      last404Message = await parseApiError(res);
      continue;
    }
    throw new Error(await parseApiError(res));
  }

  const vagaRes = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!vagaRes.ok) {
    throw new Error(
      last404Message ??
        (await parseApiError(vagaRes)) ??
        "Não foi possível carregar os dados da vaga para calcular o match.",
    );
  }

  const vagaJson = (await vagaRes.json()) as Record<string, unknown>;
  const vagaDetail = mapVagaDetail(vagaJson);
  const lexical = calcMatch(cvText, vagaDetail.requisitos, vagaDetail.threshold);

  const hint =
    last404Message ??
    "Esta vaga não possui Descrição de Cargo (template DNALIO) vinculada. O score abaixo usa os requisitos cadastrados na vaga comparados ao texto do CV (palavras-chave).";

  return { kind: "lexical", data: lexical, hint };
}

export async function recalculateCandidatoMatch(vagaId: string, candidatoId: string): Promise<void> {
  const res = await apiFetch(
    `/api/matching/recalculate?candidatoId=${encodeURIComponent(candidatoId)}&vagaId=${encodeURIComponent(vagaId)}`,
    { method: "POST", headers: { Accept: "application/json" } },
    MATCHING_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(await parseApiError(res));
}
