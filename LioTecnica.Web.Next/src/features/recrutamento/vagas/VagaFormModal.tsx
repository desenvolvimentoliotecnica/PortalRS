"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";
import { getTenantId } from "@/lib/session";
import { confirmDialog } from "@/lib/confirm-dialog";
import { TurnoAutocomplete } from "@/components/autocomplete/TurnoAutocomplete";
import { SugerirSalarioButton } from "@/features/assistente-ia/SugerirSalarioButton";
import { HorarioEditor } from "@/components/gestao/HorarioEditor";

const BASE = "/app";

function buildPortalVagasUrl(vagaId: string, tenantId: string): string {
  const configured = env.PORTAL_VAGAS_URL.trim().replace(/\/$/, "");
  const base = configured || (() => {
    if (typeof window === "undefined") return "http://localhost:3050";
    const current = new URL(window.location.origin);
    if ((current.hostname === "localhost" || current.hostname === "127.0.0.1") && current.port === "3000") {
      current.port = "3050";
    }
    return current.origin;
  })();
  const url = new URL(base);
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("vagaId", vagaId);
  return url.toString();
}

/** Alinhado a TurnoEscalaTrabalhoRawMapper.HasPopulatedGrid (API): JSON com grid e ao menos uma célula não vazia. */
function horarioRawHasPopulatedGrid(raw: string | undefined | null): boolean {
  if (!raw?.trim()) return false;
  try {
    const p = JSON.parse(raw) as { grid?: Record<string, Record<string, unknown>> };
    if (!p?.grid || typeof p.grid !== "object") return false;
    for (const row of Object.values(p.grid)) {
      if (!row || typeof row !== "object") continue;
      for (const cell of Object.values(row)) {
        if (typeof cell === "string" && cell.trim() !== "") return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const EXP_OPTIONS = [
  { code: "", text: "Qualquer" },
  { code: "0", text: "Sem experiência" },
  { code: "0-1", text: "0 a 1 ano" },
  { code: "1-3", text: "1 a 3 anos" },
  { code: "3-5", text: "3 a 5 anos" },
  { code: "5+", text: "5 ou mais anos" },
];
const SEXO_OPTIONS = [
  { code: "", text: "Qualquer" },
  { code: "M", text: "Masculino" },
  { code: "F", text: "Feminino" },
  { code: "O", text: "Outro / Não informar" },
];
const PCD_MATCH_OPTIONS = [
  { code: "", text: "Qualquer" },
  { code: "S", text: "Sim (preferência PCD)" },
  { code: "N", text: "Não" },
];

type EnumOption = { code: string; text: string };
type EnumData = Record<string, EnumOption[]>;
type DescricaoCargoLookupItem = {
  id: string;
  code: string;
  title: string;
  displayLabel: string;
  isTemplate: boolean;
};

type TipoVagaLookupItem = {
  id: string;
  code: string;
  name: string;
  displayLabel: string;
  slaDiasMetaFechamento?: number | null;
  permanenciaDisplay: string;
};

type BeneficioItem = {
  tipo: string; valor: string; recorrencia: string; obrigatorio: boolean; obs: string;
};
type RequisitoItem = {
  nome: string; categoria: string; peso: string; obrigatorio: boolean;
  anosMinimos: string; nivel: string; avaliacao: string; sinonimos: string; obs: string;
};
type EtapaItem = {
  nome: string; responsavel: string; modo: string; slaDias: string; descricao: string;
};
type PerguntaItem = {
  texto: string; tipo: string; peso: string; obrigatoria: boolean;
  knockout: boolean; opcoes: string;
};

type VagaDraft = {
  id?: string;
  titulo: string; codigo: string;
  areaTime: string; modalidade: string; status: string; senioridade: string;
  quantidadeVagas: number; tipoContratacao: string; matchMinimoPercentual: number;
  descricaoInterna: string; codigoInterno: string; codigoCbo: string;
  cargoId: string; cargoCode: string; cargoName: string;
  funcaoNomeRm: string; codFuncaoRm: string; // TOTVS RM - read-only
  categoriaSalarialId: string; categoriaSalarialCode: string; categoriaSalarialDescription: string;
  centroCustoId: string; centroCustoCode: string; centroCustoDescription: string;
  turnoId: string; turnoCode: string; turnoDescription: string;
  unidadeLotacaoId: string; unidadeLotacaoCode: string; unidadeLotacaoDescription: string;
  empresaId: string; empresaCode: string; empresaDescription: string;
  unitId: string; unitCode: string; unitName: string;
  motivoAbertura: string; orcamentoAprovado: string; gestorRequisitante: string;
  recrutadorResponsavel: string;
  /** UserId (Guid) do recrutador atribuído. Atribuição manual feature 2026-04-26. */
  recrutadorResponsavelUserId: string | null;
  prioridade: string; resumoPitch: string;
  tagsResponsabilidades: string; tagsKeywords: string;
  confidencial: boolean; urgente: boolean;
  projetoNome: string; projetoCliente: string; projetoPrazo: string; projetoDescricao: string;
  regime: string; cargaSemanalHoras: string; escala: string; escalaTrabalhoRaw: string;
  horaEntrada: string; horaSaida: string; intervalo: string;
  cep: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; politicaTrabalho: string; observacoesDeslocamento: string;
  moeda: string; salarioMinimo: string; salarioMaximo: string; periodicidade: string;
  bonusTipo: string; bonusPercentual: string; observacoesRemuneracao: string;
  travarFaixaSalarial: boolean;
  beneficios: BeneficioItem[];
  escolaridade: string; formacaoArea: string; experienciaMinimaAnos: string;
  tagsStack: string; tagsIdiomas: string; diferenciais: string;
  requisitos: RequisitoItem[];
  matchingModalidade: string; matchingSenioridade: string; matchingEscolaridade: string;
  matchingFormacaoArea: string; matchingCidade: string; matchingUF: string;
  matchingExp: string; matchingSexo: string; matchingPcd: string;
  matchingIdadeMin: string; matchingIdadeMax: string; matchingRequerCnh: boolean;
  matchingCnhCategoria: string; matchingHabilidades: string; matchingObs: string;
  weightsCompetencia: number; weightsExperiencia: number; weightsFormacao: number; weightsLocalidade: number;
  // Sessão 31.8 — DescricaoCargo + pesos extras + max distância
  descricaoCargoId: string; descricaoCargoCode: string; descricaoCargoTitle: string;
  eixoVagaId: string; eixoVagaCode: string; eixoVagaName: string;
  eixoVagaSlaDias: string; eixoVagaPermanenciaDisplay: string;
  weightsIdioma: number; weightsConhecimentoTecnico: number; weightsVivenciaEspecifica: number;
  localidadeMaxDistanciaKm: string;
  etapas: EtapaItem[];
  perguntasTriagem: PerguntaItem[];
  observacoesProcesso: string;
  visibilidade: string; dataInicio: string; dataEncerramento: string;
  slaDiasMetaFechamento: string;
  canalLinkedIn: boolean; canalSiteCarreiras: boolean; canalIndicacao: boolean; canalPortaisEmprego: boolean;
  descricaoPublica: string;
  lgpdConsentimento: boolean; lgpdCompartilhamento: boolean; lgpdRetencao: boolean; lgpdRetencaoMeses: string;
  exigeCnh: boolean; disponibilidadeViagens: boolean; checagemAntecedentes: boolean;
  nomeEngessado: string;
};

function emptyDraft(): VagaDraft {
  return {
    titulo: "", codigo: "",
    areaTime: "", modalidade: "presencial", status: "aberta", senioridade: "",
    quantidadeVagas: 1, tipoContratacao: "", matchMinimoPercentual: 70,
    descricaoInterna: "", codigoInterno: "", codigoCbo: "",
    cargoId: "", cargoCode: "", cargoName: "",
    funcaoNomeRm: "", codFuncaoRm: "",
    categoriaSalarialId: "", categoriaSalarialCode: "", categoriaSalarialDescription: "",
    centroCustoId: "", centroCustoCode: "", centroCustoDescription: "",
    turnoId: "", turnoCode: "", turnoDescription: "",
    unidadeLotacaoId: "", unidadeLotacaoCode: "", unidadeLotacaoDescription: "",
    empresaId: "", empresaCode: "", empresaDescription: "",
    unitId: "", unitCode: "", unitName: "",
    motivoAbertura: "", orcamentoAprovado: "", gestorRequisitante: "",
    recrutadorResponsavel: "", recrutadorResponsavelUserId: null, prioridade: "", resumoPitch: "",
    tagsResponsabilidades: "", tagsKeywords: "",
    confidencial: false, urgente: false,
    projetoNome: "", projetoCliente: "", projetoPrazo: "", projetoDescricao: "",
    regime: "", cargaSemanalHoras: "", escala: "", escalaTrabalhoRaw: "",
    horaEntrada: "", horaSaida: "", intervalo: "",
    cep: "", logradouro: "", numero: "", bairro: "",
    cidade: "", uf: "", politicaTrabalho: "", observacoesDeslocamento: "",
    moeda: "brl", salarioMinimo: "", salarioMaximo: "", periodicidade: "mensal",
    bonusTipo: "", bonusPercentual: "", observacoesRemuneracao: "",
    travarFaixaSalarial: false,
    beneficios: [],
    escolaridade: "", formacaoArea: "", experienciaMinimaAnos: "",
    tagsStack: "", tagsIdiomas: "", diferenciais: "",
    requisitos: [],
    matchingModalidade: "", matchingSenioridade: "", matchingEscolaridade: "",
    matchingFormacaoArea: "", matchingCidade: "", matchingUF: "",
    matchingExp: "", matchingSexo: "", matchingPcd: "",
    matchingIdadeMin: "", matchingIdadeMax: "", matchingRequerCnh: false,
    matchingCnhCategoria: "", matchingHabilidades: "", matchingObs: "",
    weightsCompetencia: 40, weightsExperiencia: 30, weightsFormacao: 15, weightsLocalidade: 15,
    descricaoCargoId: "", descricaoCargoCode: "", descricaoCargoTitle: "",
    eixoVagaId: "", eixoVagaCode: "", eixoVagaName: "",
    eixoVagaSlaDias: "", eixoVagaPermanenciaDisplay: "",
    weightsIdioma: 0, weightsConhecimentoTecnico: 0, weightsVivenciaEspecifica: 0,
    localidadeMaxDistanciaKm: "",
    etapas: [],
    perguntasTriagem: [],
    observacoesProcesso: "",
    visibilidade: "", dataInicio: "", dataEncerramento: "",
    slaDiasMetaFechamento: "",
    canalLinkedIn: false, canalSiteCarreiras: false, canalIndicacao: false, canalPortaisEmprego: false,
    descricaoPublica: "",
    lgpdConsentimento: false, lgpdCompartilhamento: false, lgpdRetencao: false, lgpdRetencaoMeses: "",
    exigeCnh: false, disponibilidadeViagens: false, checagemAntecedentes: false,
    nomeEngessado: "",
  };
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function pick(v: unknown, fb = "") { return typeof v === "string" ? v : v == null ? fb : String(v); }
function pickEnum(v: unknown, fb = "") { const s = pick(v); return s ? s.toLowerCase() : fb; }
function pickBool(v: unknown) { return v === true || v === "true" || v === 1; }
function pickNum(v: unknown, fb: number) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function emptyToNull(s: string) { return s.trim() || null; }

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number.parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyValue(value: unknown) {
  if (value == null || value === "") return "";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `HTTP_${res.status}`); }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/* ── CandidatosTab ────────────────────────────────────────────────────── */

type CandidatoItem = { id: string; nome: string; email?: string; status?: string; score?: number };

function CandidatosTab({ vagaId }: { vagaId: string }) {
  const [loading, setLoading] = useState(true);
  const [candidatos, setCandidatos] = useState<CandidatoItem[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchJson<unknown>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(vagaId)}&pageSize=200`)
      .then((data) => {
        const arr = Array.isArray(data) ? data
          : Array.isArray(asRec(data)?.items) ? (asRec(data)?.items as unknown[]) : [];
        setCandidatos(arr.map((x) => {
          const r = asRec(x) ?? {};
          return {
            id: String(r.id ?? ""),
            nome: String(r.nome ?? "Candidato"),
            email: r.email ? String(r.email) : undefined,
            status: r.status ? String(r.status) : undefined,
            score: typeof r.score === "number" ? r.score : undefined,
          };
        }).filter((c) => c.id));
      })
      .catch(() => setCandidatos([]))
      .finally(() => setLoading(false));
  }, [vagaId]);

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
    </div>
  );

  if (candidatos.length === 0) return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      Nenhum candidato cadastrado para esta vaga.
    </div>
  );

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      {candidatos.map((c) => (
        <div key={c.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/40 text-sm">
          <div>
            <div className="font-medium">{c.nome}</div>
            {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
          </div>
          <div className="flex items-center gap-2">
            {c.score != null && <span className="text-xs font-mono text-muted-foreground">{c.score}%</span>}
            {c.status && <span className="rounded-full px-2 py-0.5 text-xs bg-muted border border-border text-muted-foreground">{c.status}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── PosicaoTab ──────────────────────────────────────────────────────── */

type OcupacaoItem = {
  id: string;
  funcionarioNome: string;
  dataEntrada: string;
  dataSaida?: string | null;
  motivoSaida?: string | null;
};

const MOTIVO_LABEL: Record<string, string> = {
  desligamento: "Desligamento",
  promocao: "Promoção",
  transferencia: "Transferência",
  manual: "Manual",
};

function PosicaoTab({ vagaId }: { vagaId: string }) {
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [editHeadcount, setEditHeadcount] = useState<number>(1);
  const [savingHc, setSavingHc] = useState(false);
  const [ocupacoes, setOcupacoes] = useState<OcupacaoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/ocupacoes`)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setOcupacoes(arr.map((x) => {
          const r = asRec(x) ?? {};
          return {
            id: String(r.id ?? ""),
            funcionarioNome: String(r.funcionarioNome ?? r.nome ?? "—"),
            dataEntrada: String(r.dataEntrada ?? ""),
            dataSaida: r.dataSaida ? String(r.dataSaida) : null,
            motivoSaida: r.motivoSaida ? String(r.motivoSaida) : null,
          };
        }));
      })
      .catch(() => setOcupacoes([]))
      .finally(() => setLoading(false));
  }, [vagaId]);

  useEffect(() => {
    fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}`)
      .then((data) => {
        const r = asRec(data) ?? {};
        const hc = typeof r.headcountAutorizado === "number" ? r.headcountAutorizado : 1;
        setHeadcount(hc);
        setEditHeadcount(hc);
      })
      .catch(() => { setHeadcount(1); setEditHeadcount(1); });
  }, [vagaId]);

  const ocupado = ocupacoes.filter((o) => !o.dataSaida).length;
  const abertos = (headcount ?? 1) - ocupado;

  async function saveHeadcount() {
    setSavingHc(true);
    try {
      await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(vagaId)}/headcount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headcountAutorizado: Math.max(1, editHeadcount) }),
      });
      setHeadcount(editHeadcount);
      toast.success("Headcount atualizado.");
    } catch {
      toast.error("Erro ao salvar headcount.");
    } finally {
      setSavingHc(false);
    }
  }

  const fmtDate = (s: string) => {
    try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
  };

  return (
    <div className="space-y-5 mt-2">
      {/* Headcount editor */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
        <p className="text-xs font-semibold text-foreground mb-3">Headcount Autorizado</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={editHeadcount}
            onChange={(e) => setEditHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" variant="outline" disabled={savingHc || editHeadcount === headcount} onClick={() => void saveHeadcount()}>
            {savingHc ? "Salvando…" : "Salvar"}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Ocupado: <strong className="text-foreground">{ocupado}</strong></span>
          <span>Slots abertos: <strong className={abertos > 0 ? "text-amber-600" : "text-foreground"}>{abertos}</strong></span>
        </div>
      </div>

      {/* Histórico de ocupação */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Histórico de Ocupação</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : ocupacoes.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nenhuma ocupação registrada para esta vaga.
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Funcionário</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Entrada</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Saída</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {ocupacoes.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{o.funcionarioNome}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataEntrada ? fmtDate(o.dataEntrada) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.dataSaida ? fmtDate(o.dataSaida) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {!o.dataSaida ? (
                        <span className="rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Ativo</span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                          {MOTIVO_LABEL[(o.motivoSaida ?? "").toLowerCase()] ?? o.motivoSaida ?? "Histórico"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function enumOpts(data: EnumData, key: string, placeholder?: string): EnumOption[] {
  const list = data[key] ?? [];
  return placeholder ? [{ code: "", text: placeholder }, ...list] : list;
}

function buildMatchingFiltrosRaw(d: VagaDraft, enums: EnumData): string | null {
  const parts: string[] = [];
  const enumText = (key: string, code: string) => {
    const opt = (enums[key] ?? []).find((o) => o.code === code);
    return opt?.text ?? code;
  };
  if (d.matchingModalidade) parts.push("Modalidade: " + enumText("vagaModalidade", d.matchingModalidade));
  if (d.matchingSenioridade) parts.push("Senioridade: " + enumText("vagaSenioridade", d.matchingSenioridade));
  if (d.matchingEscolaridade) parts.push("Escolaridade: " + enumText("vagaEscolaridade", d.matchingEscolaridade));
  if (d.matchingFormacaoArea) parts.push("Formacao: " + enumText("vagaFormacaoArea", d.matchingFormacaoArea));
  if (d.matchingCidade.trim()) parts.push("Cidade: " + d.matchingCidade.trim());
  if (d.matchingUF) parts.push("UF: " + d.matchingUF);
  if (d.matchingExp) {
    const label = EXP_OPTIONS.find((o) => o.code === d.matchingExp)?.text ?? d.matchingExp;
    parts.push("TempoExperiencia: " + label);
  }
  if (d.matchingSexo) {
    const label = SEXO_OPTIONS.find((o) => o.code === d.matchingSexo)?.text ?? d.matchingSexo;
    parts.push("Sexo: " + label);
  }
  if (d.matchingPcd) parts.push("PCD: " + (d.matchingPcd === "S" ? "Sim" : "Nao"));
  if (d.matchingIdadeMin) parts.push("IdadeMin: " + d.matchingIdadeMin);
  if (d.matchingIdadeMax) parts.push("IdadeMax: " + d.matchingIdadeMax);
  if (d.matchingRequerCnh) parts.push("RequerCNH: Sim");
  if (d.matchingRequerCnh && d.matchingCnhCategoria) parts.push("CategoriaCNH: " + d.matchingCnhCategoria);
  if (d.matchingHabilidades.trim()) parts.push("Habilidades: " + d.matchingHabilidades.trim());
  if (d.matchingObs.trim()) parts.push("Observacoes: " + d.matchingObs.trim());
  return parts.length ? parts.join(". ") : null;
}

function parseMatchingFiltrosRaw(raw: string, enums: EnumData) {
  const out = { modalidade: "", senioridade: "", escolaridade: "", formacaoArea: "",
    cidade: "", uf: "", tempoExp: "", sexo: "", pcd: "", idadeMin: "", idadeMax: "",
    requerCnh: false, cnhCategoria: "", habilidades: "", observacoes: "" };
  if (!raw) return out;
  const findCode = (key: string, text: string) => {
    const list = enums[key] ?? [];
    const t = text.trim();
    return list.find((o) => o.text === t || o.code === t)?.code ?? "";
  };
  const parts = raw.split(/\s*\.\s*/).filter(Boolean);
  const labelRe = /^(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observacoes|Observações)\s*:\s*(.+)$/i;
  const obsParts: string[] = [];
  for (const p of parts) {
    const m = p.match(labelRe);
    if (!m) { obsParts.push(p); continue; }
    const lbl = m[1].toLowerCase().replace(/[ç]/g, "c");
    const val = m[2].trim();
    if (lbl === "modalidade") out.modalidade = findCode("vagaModalidade", val);
    else if (lbl === "senioridade") out.senioridade = findCode("vagaSenioridade", val);
    else if (lbl === "escolaridade") out.escolaridade = findCode("vagaEscolaridade", val);
    else if (lbl === "formacao") out.formacaoArea = findCode("vagaFormacaoArea", val);
    else if (lbl === "cidade") out.cidade = val;
    else if (lbl === "uf") out.uf = val;
    else if (lbl === "tempoexperiencia") out.tempoExp = val === "Sem experiência" || val === "Sem experiencia" ? "0" : val === "0 a 1 ano" ? "0-1" : val === "1 a 3 anos" ? "1-3" : val === "3 a 5 anos" ? "3-5" : val === "5 ou mais anos" ? "5+" : ["0","0-1","1-3","3-5","5+"].includes(val) ? val : "";
    else if (lbl === "sexo") out.sexo = val === "Masculino" ? "M" : val === "Feminino" ? "F" : val === "Outro / Não informar" || val === "Outro" ? "O" : "";
    else if (lbl === "pcd") out.pcd = val === "Sim" || val.startsWith("Sim") ? "S" : "N";
    else if (lbl === "idademin") out.idadeMin = val;
    else if (lbl === "idademax") out.idadeMax = val;
    else if (lbl === "requercnh") out.requerCnh = val === "Sim";
    else if (lbl === "categoriacnh") out.cnhCategoria = val;
    else if (lbl === "habilidades") out.habilidades = val;
    else if (lbl === "observacoes") out.observacoes = val;
  }
  if (obsParts.length) out.observacoes = (out.observacoes ? out.observacoes + " " : "") + obsParts.join(". ");
  return out;
}

const VAGA_DIVERSIDADE_PAYLOAD = {
  aceitaPcd: false,
  generoPreferencia: null,
  vagaAfirmativa: false,
  linguagemInclusiva: false,
  publicoAfirmativo: null,
  observacoesPcd: null,
} as const;

function buildPayload(d: VagaDraft, enums: EnumData) {
  const tagsRaw = (s: string) => s.split(";").map((x) => x.trim()).filter(Boolean).join(";") || null;
  const matchingFiltrosRaw = buildMatchingFiltrosRaw(d, enums);
  return {
    titulo: d.titulo.trim(),
    status: d.status || "aberta",
    codigo: emptyToNull(d.codigo),
    areaTime: emptyToNull(d.areaTime),
    modalidade: emptyToNull(d.modalidade),
    senioridade: emptyToNull(d.senioridade),
    quantidadeVagas: Math.max(1, d.quantidadeVagas),
    tipoContratacao: emptyToNull(d.tipoContratacao),
    matchMinimoPercentual: clamp(d.matchMinimoPercentual, 0, 100),
    weights: { competencia: d.weightsCompetencia, experiencia: d.weightsExperiencia, formacao: d.weightsFormacao, localidade: d.weightsLocalidade },
    // Sessão 31.8 — DescricaoCargo + pesos extras + max distância (calibragem por vaga)
    descricaoCargoId: emptyToNull(d.descricaoCargoId) || null,
    eixoVagaId: emptyToNull(d.eixoVagaId) || null,
    pesoCompetencia: d.weightsCompetencia,
    pesoExperiencia: d.weightsExperiencia,
    pesoFormacao: d.weightsFormacao,
    pesoLocalidade: d.weightsLocalidade,
    pesoIdioma: d.weightsIdioma,
    pesoConhecimentoTecnico: d.weightsConhecimentoTecnico,
    pesoVivenciaEspecifica: d.weightsVivenciaEspecifica,
    localidadeMaxDistanciaKm: d.localidadeMaxDistanciaKm.trim() ? Number(d.localidadeMaxDistanciaKm) : null,
    matchingFiltrosRaw,
    descricaoInterna: emptyToNull(d.descricaoInterna),
    codigoInterno: emptyToNull(d.codigoInterno),
    codigoCbo: emptyToNull(d.codigoCbo),
    jobPositionId: emptyToNull(d.cargoId) || null,
    categoriaSalarialId: emptyToNull(d.categoriaSalarialId) || null,
    centroCustoId: emptyToNull(d.centroCustoId) || null,
    turnoId: emptyToNull(d.turnoId) || null,
    unidadeLotacaoId: emptyToNull(d.unidadeLotacaoId) || null,
    empresaId: emptyToNull(d.empresaId) || null,
    unitId: emptyToNull(d.unitId) || null,
    motivoAbertura: emptyToNull(d.motivoAbertura),
    orcamentoAprovado: emptyToNull(d.orcamentoAprovado),
    gestorRequisitante: emptyToNull(d.gestorRequisitante),
    recrutadorResponsavel: emptyToNull(d.recrutadorResponsavel),
    recrutadorResponsavelUserId: d.recrutadorResponsavelUserId ?? null,
    prioridade: emptyToNull(d.prioridade),
    resumoPitch: emptyToNull(d.resumoPitch),
    tagsResponsabilidadesRaw: tagsRaw(d.tagsResponsabilidades),
    tagsKeywordsRaw: tagsRaw(d.tagsKeywords),
    confidencial: d.confidencial,
    urgente: d.urgente,
    ...VAGA_DIVERSIDADE_PAYLOAD,
    projetoNome: emptyToNull(d.projetoNome),
    projetoClienteAreaImpactada: emptyToNull(d.projetoCliente),
    projetoPrazoPrevisto: emptyToNull(d.projetoPrazo),
    projetoDescricao: emptyToNull(d.projetoDescricao),
    regime: emptyToNull(d.regime),
    cargaSemanalHoras: d.cargaSemanalHoras ? Number(d.cargaSemanalHoras) || null : null,
    escala: emptyToNull(d.escala),
    escalaTrabalhoRaw: emptyToNull(d.escalaTrabalhoRaw),
    horaEntrada: emptyToNull(d.horaEntrada) || null,
    horaSaida: emptyToNull(d.horaSaida) || null,
    intervalo: emptyToNull(d.intervalo) || null,
    cep: emptyToNull(d.cep),
    logradouro: emptyToNull(d.logradouro),
    numero: emptyToNull(d.numero),
    bairro: emptyToNull(d.bairro),
    cidade: emptyToNull(d.cidade),
    uf: d.uf.trim().toUpperCase().slice(0, 2) || null,
    politicaTrabalho: emptyToNull(d.politicaTrabalho),
    observacoesDeslocamento: emptyToNull(d.observacoesDeslocamento),
    moeda: emptyToNull(d.moeda) ?? "brl",
    salarioMinimo: d.salarioMinimo ? parseMoneyInput(d.salarioMinimo) : null,
    salarioMaximo: d.salarioMinimo ? parseMoneyInput(d.salarioMinimo) : null,
    periodicidade: emptyToNull(d.periodicidade) ?? "mensal",
    bonusTipo: emptyToNull(d.bonusTipo),
    bonusPercentual: d.bonusPercentual ? Number(d.bonusPercentual.replace(",", ".")) || null : null,
    observacoesRemuneracao: emptyToNull(d.observacoesRemuneracao),
    travarFaixaSalarial: d.travarFaixaSalarial,
    escolaridade: emptyToNull(d.escolaridade),
    formacaoArea: emptyToNull(d.formacaoArea),
    experienciaMinimaAnos: d.experienciaMinimaAnos ? Number(d.experienciaMinimaAnos) || null : null,
    tagsStackRaw: tagsRaw(d.tagsStack),
    tagsIdiomasRaw: tagsRaw(d.tagsIdiomas),
    diferenciais: emptyToNull(d.diferenciais),
    observacoesProcesso: emptyToNull(d.observacoesProcesso),
    visibilidade: emptyToNull(d.visibilidade),
    dataInicio: emptyToNull(d.dataInicio) || null,
    dataEncerramento: emptyToNull(d.dataEncerramento) || null,
    slaDiasMetaFechamento: null,
    canalLinkedIn: d.canalLinkedIn,
    canalSiteCarreiras: d.canalSiteCarreiras,
    canalIndicacao: d.canalIndicacao,
    canalPortaisEmprego: d.canalPortaisEmprego,
    descricaoPublica: emptyToNull(d.descricaoPublica),
    lgpdSolicitarConsentimentoExplicito: d.lgpdConsentimento,
    lgpdCompartilharCurriculoInternamente: d.lgpdCompartilhamento,
    lgpdRetencaoAtiva: d.lgpdRetencao,
    lgpdRetencaoMeses: d.lgpdRetencaoMeses ? Number(d.lgpdRetencaoMeses) || null : null,
    exigeCnh: d.exigeCnh,
    disponibilidadeParaViagens: d.disponibilidadeViagens,
    checagemAntecedentes: d.checagemAntecedentes,
    nomeEngessado: emptyToNull(d.nomeEngessado),
    beneficios: d.beneficios.filter((b) => b.tipo).map((b, i) => ({
      ordem: i + 1, tipo: b.tipo, valor: b.valor ? Number(b.valor.replace(",", ".")) || null : null,
      recorrencia: b.recorrencia || "mensal", obrigatorio: b.obrigatorio, observacoes: emptyToNull(b.obs),
    })),
    requisitos: d.requisitos.filter((r) => r.nome.trim()).map((r, i) => ({
      ordem: i + 1, categoria: r.categoria || "competencia", nome: r.nome.trim(),
      peso: r.peso || "1", obrigatorio: r.obrigatorio, anosMinimos: r.anosMinimos ? Number(r.anosMinimos) || null : null,
      nivel: emptyToNull(r.nivel), avaliacao: emptyToNull(r.avaliacao),
      sinonimos: r.sinonimos.split(",").map((x) => x.trim()).filter(Boolean),
      observacoes: emptyToNull(r.obs),
    })),
    etapas: d.etapas.filter((e) => e.nome.trim()).map((e, i) => ({
      ordem: i + 1, nome: e.nome.trim(), responsavel: e.responsavel, modo: e.modo,
      slaDias: e.slaDias ? Number(e.slaDias) || null : null, descricaoInstrucoes: emptyToNull(e.descricao),
    })),
    perguntasTriagem: d.perguntasTriagem.filter((p) => p.texto.trim()).map((p, i) => ({
      ordem: i + 1, texto: p.texto.trim(), tipo: p.tipo, peso: p.peso || "1",
      obrigatoria: p.obrigatoria, knockout: p.knockout,
      opcoesRaw: p.opcoes.trim() || null,
    })),
  };
}

/* ── Reusable form pieces ───────────────────────────────────────────── */

function Field({ label, required, children, span }: { label: string; required?: boolean; children: React.ReactNode; span?: string }) {
  return (
    <div className={`${span ?? "col-span-12 md:col-span-4"} [&_input:not([type=checkbox])]:w-full [&_select]:w-full [&_textarea]:w-full`}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5"> *</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="col-span-12 pt-2 pb-1">
      <div className="flex items-center gap-3 mb-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" className="form-check-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function EnumSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: EnumOption[]; placeholder?: string;
}) {
  const hasPlaceholder = placeholder && !options.some((o) => o.code === "");
  return (
    <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {hasPlaceholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
    </select>
  );
}

type LookupOption = { id: string; code: string; name: string };

function LookupSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: LookupOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder ?? "Selecionar..."}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name && o.code ? `${o.name} (${o.code})` : o.name || o.code}
        </option>
      ))}
    </select>
  );
}

/* ── Tab definitions ─────────────────────────────────────────────────── */

type TabKey = "identificacao" | "horario" | "dados" | "projeto" | "local" | "remuneracao" | "requisitos" | "matching" | "processo" | "publicacao" | "campos" | "candidatos" | "posicao";
const REMOVED_EDIT_TAB_KEYS = new Set<string>(["publicacao", "campos", "posicao", "diversidade", "processo"]);

function normalizeEditTab(tab?: TabKey): TabKey {
  return tab && !REMOVED_EDIT_TAB_KEYS.has(tab) ? tab : "identificacao";
}

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "identificacao", icon: "🪪", label: "Identificação" },
  { key: "horario", icon: "🕐", label: "Horário" },
  { key: "dados", icon: "📋", label: "Dados básicos" },
  { key: "projeto", icon: "📁", label: "Projeto" },
  { key: "local", icon: "📍", label: "Localização" },
  { key: "remuneracao", icon: "💰", label: "Remuneração" },
  { key: "requisitos", icon: "✅", label: "Requisitos" },
  { key: "matching", icon: "✨", label: "Filtros matching (IA)" },
  { key: "candidatos", icon: "👥", label: "Candidatos" },
];

const STEPPER_SEQUENCE: TabKey[] = ["identificacao", "horario", "dados", "requisitos", "matching"];
const STEPPER_LABELS: Record<string, string> = {
  identificacao: "Identificação", horario: "Horário", dados: "Dados básicos",
  requisitos: "Requisitos", matching: "Matching IA",
};

/* ── CamposPersonalizadosTab ─────────────────────────────────────────── */

type CampoItem = {
  id: string; vagaId: string; label: string; tipo: number;
  obrigatorio: boolean; isReadOnly: boolean; valorPadrao: string | null;
  ordem: number; opcoes: string | null;
};

const TIPO_LABELS: Record<number, string> = { 0: "Texto", 1: "Select", 2: "Checkbox", 3: "Numero" };

const DEFAULT_PORTAL_FIELDS = [
  { label: "Nome completo", obrigatorio: true, tipo: "Texto" },
  { label: "Email", obrigatorio: true, tipo: "Texto" },
  { label: "Telefone", obrigatorio: false, tipo: "Texto" },
  { label: "Cidade / UF", obrigatorio: false, tipo: "Texto" },
  { label: "LinkedIn", obrigatorio: false, tipo: "Texto" },
  { label: "Portfolio", obrigatorio: false, tipo: "Texto" },
  { label: "Cargo atual", obrigatorio: false, tipo: "Texto" },
  { label: "Anos de experiência", obrigatorio: false, tipo: "Número" },
  { label: "Upload de currículo", obrigatorio: true, tipo: "Arquivo" },
  { label: "Observações", obrigatorio: false, tipo: "Texto" },
] as const;

function CamposPersonalizadosTab({ vagaId }: { vagaId?: string }) {
  const [campos, setCampos] = useState<CampoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", tipo: 0, obrigatorio: false, isReadOnly: false, valorPadrao: "", opcoes: "" });

  const load = useCallback(async () => {
    if (!vagaId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${BASE}/api/vagas/${vagaId}/campos-personalizados`);
      if (res.ok) setCampos(await res.json());
    } finally { setLoading(false); }
  }, [vagaId]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setForm({ label: "", tipo: 0, obrigatorio: false, isReadOnly: false, valorPadrao: "", opcoes: "" }); setAdding(false); setEditId(null); };

  const save = async () => {
    if (!vagaId || !form.label.trim()) { toast.error("Label é obrigatório."); return; }
    const body = { label: form.label.trim(), tipo: form.tipo, obrigatorio: form.obrigatorio, isReadOnly: form.isReadOnly, valorPadrao: form.valorPadrao || null, opcoes: form.opcoes || null };
    const url = editId ? `${BASE}/api/campos-personalizados/${editId}` : `${BASE}/api/vagas/${vagaId}/campos-personalizados`;
    const method = editId ? "PUT" : "POST";
    const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error("Falha ao salvar campo."); return; }
    toast.success(editId ? "Campo atualizado." : "Campo criado.");
    resetForm();
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este campo?")) return;
    await apiFetch(`${BASE}/api/campos-personalizados/${id}`, { method: "DELETE" });
    toast.success("Campo removido.");
    await load();
  };

  const startEdit = (c: CampoItem) => {
    setEditId(c.id);
    setForm({ label: c.label, tipo: c.tipo, obrigatorio: c.obrigatorio, isReadOnly: c.isReadOnly, valorPadrao: c.valorPadrao || "", opcoes: c.opcoes || "" });
    setAdding(true);
  };

  if (!vagaId) return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      Salve a vaga primeiro para configurar campos personalizados do portal.
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Campos padrão do portal */}
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold">Campos padrão do portal</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium">Automáticos</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Exibidos automaticamente no formulário de candidatura. Não podem ser removidos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEFAULT_PORTAL_FIELDS.map(f => (
            <div key={f.label} className="flex items-center justify-between rounded-md border border-border/30 bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{f.label}</span>
                <span className="text-[10px] text-muted-foreground">{f.tipo}</span>
              </div>
              {f.obrigatorio
                ? <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Obrigatório</span>
                : <span className="text-[10px] text-muted-foreground">Opcional</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          Para coletar CPF ou Pretensão Salarial, adicione como campo personalizado abaixo.
        </p>
      </div>

      {/* Separador */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Campos personalizados</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Campos adicionais exibidos no formulário de candidatura do Portal.</div>
        {!adding && <Button size="sm" onClick={() => { resetForm(); setAdding(true); }}>+ Adicionar campo</Button>}
      </div>

      {adding && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Label (ex: Possui CNH?)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
            <div className="col-span-3">
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: Number(e.target.value) }))}>
                <option value={0}>Texto</option><option value={1}>Select</option><option value={2}>Checkbox</option><option value={3}>Numero</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={form.obrigatorio} onChange={(e) => setForm((f) => ({ ...f, obrigatorio: e.target.checked }))} /> Obrig.</label>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={form.isReadOnly} onChange={(e) => setForm((f) => ({ ...f, isReadOnly: e.target.checked }))} /> Fixo</label>
            </div>
          </div>
          {form.tipo === 1 && (
            <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Opções separadas por ; (ex: Sim;Não;Talvez)" value={form.opcoes} onChange={(e) => setForm((f) => ({ ...f, opcoes: e.target.value }))} />
          )}
          {form.isReadOnly && (
            <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Valor padrão (fixo para o candidato)" value={form.valorPadrao} onChange={(e) => setForm((f) => ({ ...f, valorPadrao: e.target.value }))} />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>{editId ? "Atualizar" : "Salvar"}</Button>
            <Button variant="outline" size="sm" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : campos.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Nenhum campo personalizado configurado.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
            <th className="py-1 px-2">#</th><th className="py-1 px-2">Label</th><th className="py-1 px-2">Tipo</th><th className="py-1 px-2">Obrig.</th><th className="py-1 px-2">Fixo</th><th className="py-1 px-2">Opções</th><th className="py-1 px-2"></th>
          </tr></thead>
          <tbody>
            {campos.map((c, i) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="py-1 px-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1 px-2 font-medium">{c.label}</td>
                <td className="py-1 px-2">{TIPO_LABELS[c.tipo] ?? c.tipo}</td>
                <td className="py-1 px-2">{c.obrigatorio ? "Sim" : "Não"}</td>
                <td className="py-1 px-2">{c.isReadOnly ? "Sim" : "Não"}</td>
                <td className="py-1 px-2 text-xs text-muted-foreground truncate max-w-[150px]">{c.opcoes || "—"}</td>
                <td className="py-1 px-2 flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => startEdit(c)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => void remove(c.id)}>Excluir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export type VagaFormProps = {
  open: boolean;
  editId?: string | null;
  prefill?: Partial<VagaDraft>;
  defaultTab?: TabKey;
  onClose: () => void;
  onSaved: (vagaId?: string) => void;
  /** Quando true, renderiza sem Dialog wrapper (para uso como tela full-page) */
  embedded?: boolean;
};

export default function VagaFormModal({ open, editId: vagaId, prefill, defaultTab, onClose, onSaved, embedded }: VagaFormProps) {
  const [tab, setTab] = useState<TabKey>("identificacao");
  const [draft, setDraft] = useState<VagaDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [enums, setEnums] = useState<EnumData>({});
  const [wizardMode, setWizardMode] = useState(false);
  const [descricaoCargoSearch, setDescricaoCargoSearch] = useState("");
  const [descricaoCargoOptions, setDescricaoCargoOptions] = useState<DescricaoCargoLookupItem[]>([]);
  const [tipoVagaOptions, setTipoVagaOptions] = useState<TipoVagaLookupItem[]>([]);
  const [loadingDescricaoCargo, setLoadingDescricaoCargo] = useState(false);
  const [empresaOptions, setEmpresaOptions] = useState<LookupOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<LookupOption[]>([]);
  const [loadingUnitOptions, setLoadingUnitOptions] = useState(false);
  const loaded = useRef(false);
  const lastBootstrapKeyRef = useRef<string>("");
  const [embeddedBootstrapLoading, setEmbeddedBootstrapLoading] = useState(false);
  /** Grade JSON do cadastro do turno (última carga da API) — usado em "Recarregar do turno". */
  const turnoGradeJsonRef = useRef<string | null>(null);

  const stepCompletion = useMemo(() => {
    const s = new Map<TabKey, boolean>();
    s.set("dados", !!(draft.titulo.trim() && draft.centroCustoId && draft.status));
    s.set("requisitos", draft.requisitos.length > 0);
    s.set("matching", !!(draft.matchingModalidade || draft.matchingSenioridade || draft.matchingEscolaridade || draft.matchingHabilidades || draft.matchingCidade));
    s.set("publicacao", ["Externa", "InternaEExterna"].includes(draft.visibilidade));
    s.set("campos", true);
    return s;
  }, [draft]);

  const descricaoCargoListOptions = useMemo(() => {
    if (!draft.descricaoCargoId || descricaoCargoOptions.some((item) => item.id === draft.descricaoCargoId)) {
      return descricaoCargoOptions;
    }

    return [
      {
        id: draft.descricaoCargoId,
        code: draft.descricaoCargoCode,
        title: draft.descricaoCargoTitle,
        displayLabel: draft.descricaoCargoCode
          ? `${draft.descricaoCargoCode} - ${draft.descricaoCargoTitle}`
          : "Descrição selecionada",
        isTemplate: true,
      },
      ...descricaoCargoOptions,
    ];
  }, [descricaoCargoOptions, draft.descricaoCargoCode, draft.descricaoCargoId, draft.descricaoCargoTitle]);

  const set = useCallback(<K extends keyof VagaDraft>(key: K, val: VagaDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: val }));
  }, []);

  const setList = useCallback(<K extends "beneficios" | "requisitos" | "etapas" | "perguntasTriagem">(
    key: K, fn: (list: VagaDraft[K]) => VagaDraft[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: fn(d[key]) }));
  }, []);

  const clearLocalAddress = useCallback(() => {
    setDraft((d) => ({
      ...d,
      unitId: "",
      unitCode: "",
      unitName: "",
      cep: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
    }));
  }, []);

  const applyUnitToDraft = useCallback(async (unitId: string | null) => {
    if (!unitId) {
      clearLocalAddress();
      return;
    }
    try {
      const u = await fetchJson<Record<string, unknown>>(`${BASE}/api/units/${encodeURIComponent(unitId)}`);
      setDraft((d) => ({
        ...d,
        unitId,
        unitCode: pick(u.code),
        unitName: pick(u.name),
        empresaId: pick(u.empresaId) || d.empresaId,
        empresaCode: pick(u.empresaCode) || d.empresaCode,
        empresaDescription: pick(u.empresaDescription) || d.empresaDescription,
        cep: pick(u.zipCode),
        logradouro: pick(u.addressLine),
        numero: "",
        bairro: pick(u.neighborhood),
        cidade: pick(u.city),
        uf: pick(u.uf),
      }));
    } catch {
      setDraft((d) => ({ ...d, unitId }));
      toast.error("Falha ao carregar endereço do local.");
    }
  }, [clearLocalAddress]);

  const selectDescricaoCargo = useCallback((item: DescricaoCargoLookupItem) => {
    setDraft((d) => ({
      ...d,
      descricaoCargoId: item.id,
      descricaoCargoCode: item.code,
      descricaoCargoTitle: item.title,
    }));
    setDescricaoCargoSearch(item.displayLabel);
  }, []);

  const clearDescricaoCargo = useCallback(() => {
    setDraft((d) => ({
      ...d,
      descricaoCargoId: "",
      descricaoCargoCode: "",
      descricaoCargoTitle: "",
    }));
    setDescricaoCargoSearch("");
  }, []);

  const handleDescricaoCargoSelectValue = useCallback((value: string) => {
    if (!value) return;
    const selected = descricaoCargoListOptions.find((item) => item.id === value);
    if (selected) selectDescricaoCargo(selected);
  }, [descricaoCargoListOptions, selectDescricaoCargo]);

  useEffect(() => {
    if (!open) return;

    const handle = window.setTimeout(() => {
      setLoadingDescricaoCargo(true);
      const params = new URLSearchParams();
      params.set("isTemplate", "true");
      const search = descricaoCargoSearch.trim();
      if (search) params.set("search", search);

      fetchJson<DescricaoCargoLookupItem[]>(`${BASE}/api/descricoes-cargo/lookup?${params.toString()}`)
        .then((items) => setDescricaoCargoOptions(Array.isArray(items) ? items : []))
        .catch(() => {
          setDescricaoCargoOptions([]);
          toast.error("Falha ao buscar descrições de cargo.");
        })
        .finally(() => setLoadingDescricaoCargo(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [open, descricaoCargoSearch]);

  useEffect(() => {
    if (!open) return;
    fetchJson<TipoVagaLookupItem[]>(`${BASE}/api/eixos-vaga/lookup`)
      .then((items) => setTipoVagaOptions(Array.isArray(items) ? items : []))
      .catch(() => {
        setTipoVagaOptions([]);
        toast.error("Falha ao carregar tipos de vaga.");
      });
  }, [open]);

  const selectTipoVaga = useCallback((item: TipoVagaLookupItem | null) => {
    if (!item) {
      setDraft((d) => ({
        ...d,
        eixoVagaId: "",
        eixoVagaCode: "",
        eixoVagaName: "",
        eixoVagaSlaDias: "",
        eixoVagaPermanenciaDisplay: "",
      }));
      return;
    }
    setDraft((d) => ({
      ...d,
      eixoVagaId: item.id,
      eixoVagaCode: item.code,
      eixoVagaName: item.name,
      eixoVagaSlaDias: item.slaDiasMetaFechamento != null ? String(item.slaDiasMetaFechamento) : "",
      eixoVagaPermanenciaDisplay: item.permanenciaDisplay,
    }));
  }, []);

  useEffect(() => {
    if (!open) {
      setEmpresaOptions([]);
      setUnitOptions([]);
      return;
    }
    void fetchJson<LookupOption[]>(`${BASE}/api/lookup/empresas`)
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        if (draft.empresaId && draft.empresaDescription && !list.some((e) => e.id === draft.empresaId)) {
          list.unshift({
            id: draft.empresaId,
            code: draft.empresaCode || draft.empresaId,
            name: draft.empresaDescription,
          });
        }
        setEmpresaOptions(list);
      })
      .catch(() => setEmpresaOptions([]));
  }, [open, draft.empresaId, draft.empresaCode, draft.empresaDescription]);

  useEffect(() => {
    if (!open || !draft.empresaId) {
      setUnitOptions([]);
      return;
    }
    setLoadingUnitOptions(true);
    const params = new URLSearchParams();
    params.set("empresaId", draft.empresaId);
    void fetchJson<LookupOption[]>(`${BASE}/api/units/lookup?${params.toString()}`)
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        if (draft.unitId && draft.unitName && !list.some((u) => u.id === draft.unitId)) {
          list.unshift({
            id: draft.unitId,
            code: draft.unitCode || draft.unitId,
            name: draft.unitName,
          });
        }
        setUnitOptions(list);
      })
      .catch(() => setUnitOptions([]))
      .finally(() => setLoadingUnitOptions(false));
  }, [open, draft.empresaId, draft.unitId, draft.unitCode, draft.unitName]);

  useEffect(() => {
    if (!open) {
      loaded.current = false;
      lastBootstrapKeyRef.current = "";
      turnoGradeJsonRef.current = null;
      setEmbeddedBootstrapLoading(false);
      setDescricaoCargoSearch("");
      setDescricaoCargoOptions([]);
      return;
    }
    const bootstrapKey = vagaId ?? "__new__";
    if (loaded.current && lastBootstrapKeyRef.current === bootstrapKey) return;
    loaded.current = true;
    setTab(normalizeEditTab(defaultTab));

    if (embedded) setEmbeddedBootstrapLoading(true);

    void fetchJson<unknown>(`${BASE}/api/lookup/enums`)
      .catch(() => null)
      .then(async (enumsRaw) => {
        const eData: EnumData = {};
        if (enumsRaw && typeof enumsRaw === "object") {
          Object.entries(enumsRaw as Record<string, unknown>).forEach(([k, v]) => {
            eData[k] = Array.isArray(v) ? (v as { code: string; text: string }[]) : [];
          });
        }
        setEnums(eData);

        if (vagaId) {
          await loadVagaIntoDraft(vagaId, eData);
        } else {
          const d = { ...emptyDraft(), ...prefill };
          setDraft(d);
          setDescricaoCargoSearch(d.descricaoCargoCode ? `${d.descricaoCargoCode} - ${d.descricaoCargoTitle}` : "");
        }
      })
      .catch(() => toast.error("Falha ao carregar dados do formulário."))
      .finally(() => {
        lastBootstrapKeyRef.current = bootstrapKey;
        if (embedded) setEmbeddedBootstrapLoading(false);
      });
  }, [open, vagaId, prefill, defaultTab, embedded]);

  async function loadVagaIntoDraft(id: string, eData: EnumData) {
    try {
      const v = await fetchJson<Record<string, unknown>>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
      if (!v) return;
      const mf = parseMatchingFiltrosRaw(pick(v.matchingFiltrosRaw), eData);
      const w = asRec(v.weights);
      const benefRaw = Array.isArray(v.beneficios) ? v.beneficios : [];
      const reqRaw = Array.isArray(v.requisitos) ? v.requisitos : [];
      const etaRaw = Array.isArray(v.etapas) ? v.etapas : [];
      const pergRaw = Array.isArray(v.perguntasTriagem) ? v.perguntasTriagem : [];

      const turnoGradeApi = v.turnoGradeHorarioJson != null ? String(v.turnoGradeHorarioJson as string).trim() : "";
      turnoGradeJsonRef.current = turnoGradeApi || null;

      let escalaTrabalhoRaw = pick(v.escalaTrabalhoRaw);
      if (!horarioRawHasPopulatedGrid(escalaTrabalhoRaw) && horarioRawHasPopulatedGrid(turnoGradeApi)) {
        escalaTrabalhoRaw = turnoGradeApi;
      }
      const turnoIdResolved = pick(v.turnoId);
      if (!horarioRawHasPopulatedGrid(escalaTrabalhoRaw) && turnoIdResolved) {
        try {
          const t = await fetchJson<Record<string, unknown>>(`${BASE}/api/turnos/${encodeURIComponent(turnoIdResolved)}`);
          const g = t?.gradeHorarioJson != null ? String(t.gradeHorarioJson).trim() : "";
          if (horarioRawHasPopulatedGrid(g)) {
            escalaTrabalhoRaw = g;
            turnoGradeJsonRef.current = g;
          }
        } catch {
          /* turno opcional */
        }
      }

      setDraft({
        id,
        titulo: pick(v.titulo), codigo: pick(v.codigo),
        areaTime: pickEnum(v.areaTime), modalidade: pickEnum(v.modalidade, "presencial"),
        status: pickEnum(v.status, "aberta"), senioridade: pickEnum(v.senioridade),
        quantidadeVagas: pickNum(v.quantidadeVagas, 1), tipoContratacao: pickEnum(v.tipoContratacao),
        matchMinimoPercentual: clamp(pickNum(v.matchMinimoPercentual, 70), 0, 100),
        descricaoInterna: pick(v.descricaoInterna), codigoInterno: pick(v.codigoInterno),
        codigoCbo: pick(v.codigoCbo),
        cargoId: pick(v.jobPositionId), cargoCode: pick(v.jobPositionCode), cargoName: pick(v.jobPositionName),
        funcaoNomeRm: pick(v.funcaoNomeRm), codFuncaoRm: pick(v.codFuncaoRm),
        categoriaSalarialId: pick(v.categoriaSalarialId),
        categoriaSalarialCode: pick(v.categoriaSalarialCode),
        categoriaSalarialDescription: pick(v.categoriaSalarialDescription),
        centroCustoId: pick(v.centroCustoId),
        centroCustoCode: pick(v.centroCustoCode),
        centroCustoDescription: pick(v.centroCustoDescription),
        turnoId: pick(v.turnoId),
        turnoCode: pick(v.turnoCode),
        turnoDescription: pick(v.turnoDescription),
        unidadeLotacaoId: pick(v.unidadeLotacaoId),
        unidadeLotacaoCode: pick(v.unidadeLotacaoCode),
        unidadeLotacaoDescription: pick(v.unidadeLotacaoDescription),
        empresaId: pick(v.empresaId),
        empresaCode: pick(v.empresaCode),
        empresaDescription: pick(v.empresaDescription),
        unitId: pick(v.unitId),
        unitCode: pick(v.unitCode),
        unitName: pick(v.unitName),
        motivoAbertura: pickEnum(v.motivoAbertura),
        orcamentoAprovado: pickEnum(v.orcamentoAprovado), gestorRequisitante: pick(v.gestorRequisitante),
        recrutadorResponsavel: pick(v.recrutadorResponsavel),
        recrutadorResponsavelUserId: (v.recrutadorResponsavelUserId as string | null | undefined) ?? null,
        prioridade: pickEnum(v.prioridade),
        resumoPitch: pick(v.resumoPitch),
        tagsResponsabilidades: pick(v.tagsResponsabilidadesRaw).replace(/;/g, "; "),
        tagsKeywords: pick(v.tagsKeywordsRaw).replace(/;/g, "; "),
        confidencial: pickBool(v.confidencial), urgente: pickBool(v.urgente),
        projetoNome: pick(v.projetoNome), projetoCliente: pick(v.projetoClienteAreaImpactada),
        projetoPrazo: pick(v.projetoPrazoPrevisto), projetoDescricao: pick(v.projetoDescricao),
        regime: pickEnum(v.regime), cargaSemanalHoras: v.cargaSemanalHoras != null ? String(v.cargaSemanalHoras) : "",
        escala: pickEnum(v.escala), escalaTrabalhoRaw,
        horaEntrada: pick(v.horaEntrada), horaSaida: pick(v.horaSaida),
        intervalo: pick(v.intervalo),
        cep: pick(v.cep), logradouro: pick(v.logradouro), numero: pick(v.numero), bairro: pick(v.bairro),
        cidade: pick(v.cidade), uf: pick(v.uf), politicaTrabalho: pick(v.politicaTrabalho),
        observacoesDeslocamento: pick(v.observacoesDeslocamento),
        moeda: pickEnum(v.moeda, "brl"), salarioMinimo: formatMoneyValue(v.salarioMinimo ?? v.salarioMaximo),
        salarioMaximo: formatMoneyValue(v.salarioMinimo ?? v.salarioMaximo),
        periodicidade: pickEnum(v.periodicidade, "mensal"), bonusTipo: pickEnum(v.bonusTipo),
        bonusPercentual: v.bonusPercentual != null ? String(v.bonusPercentual) : "",
        observacoesRemuneracao: pick(v.observacoesRemuneracao),
        travarFaixaSalarial: pickBool(v.travarFaixaSalarial),
        beneficios: benefRaw.map((b: any) => ({ tipo: pickEnum(b.tipo), valor: b.valor != null ? String(b.valor) : "", recorrencia: pickEnum(b.recorrencia, "mensal"), obrigatorio: pickBool(b.obrigatorio), obs: pick(b.observacoes) })),
        escolaridade: pickEnum(v.escolaridade), formacaoArea: pickEnum(v.formacaoArea),
        experienciaMinimaAnos: v.experienciaMinimaAnos != null ? String(v.experienciaMinimaAnos) : "",
        tagsStack: pick(v.tagsStackRaw).replace(/;/g, "; "),
        tagsIdiomas: pick(v.tagsIdiomasRaw).replace(/;/g, "; "),
        diferenciais: pick(v.diferenciais),
        requisitos: reqRaw.map((r: any) => ({ nome: pick(r.nome), categoria: pickEnum(r.categoria, "competencia"), peso: pick(r.peso, "1"), obrigatorio: pickBool(r.obrigatorio), anosMinimos: r.anosMinimos != null ? String(r.anosMinimos) : "", nivel: pickEnum(r.nivel), avaliacao: pickEnum(r.avaliacao), sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos.join(", ") : "", obs: pick(r.observacoes) })),
        matchingModalidade: mf.modalidade, matchingSenioridade: mf.senioridade,
        matchingEscolaridade: mf.escolaridade, matchingFormacaoArea: mf.formacaoArea,
        matchingCidade: mf.cidade, matchingUF: mf.uf, matchingExp: mf.tempoExp,
        matchingSexo: mf.sexo, matchingPcd: mf.pcd, matchingIdadeMin: mf.idadeMin,
        matchingIdadeMax: mf.idadeMax, matchingRequerCnh: mf.requerCnh,
        matchingCnhCategoria: mf.cnhCategoria, matchingHabilidades: mf.habilidades, matchingObs: mf.observacoes,
        weightsCompetencia: pickNum(w?.competencia, 40), weightsExperiencia: pickNum(w?.experiencia, 30),
        weightsFormacao: pickNum(w?.formacao, 15), weightsLocalidade: pickNum(w?.localidade, 15),
        // Sessão 31.8 — DescricaoCargo + pesos extras + max distância
        descricaoCargoId: pick(v.descricaoCargoId), descricaoCargoCode: pick(v.descricaoCargoCode), descricaoCargoTitle: pick(v.descricaoCargoTitle),
        eixoVagaId: pick(v.eixoVagaId), eixoVagaCode: pick(v.eixoVagaCode), eixoVagaName: pick(v.eixoVagaName),
        eixoVagaSlaDias: v.eixoVagaSlaDiasMetaFechamento != null ? String(v.eixoVagaSlaDiasMetaFechamento) : (v.slaEfetivoDias != null ? String(v.slaEfetivoDias) : ""),
        eixoVagaPermanenciaDisplay: pick(v.eixoVagaPermanenciaDisplay),
        weightsIdioma: pickNum(v.pesoIdioma, 0),
        weightsConhecimentoTecnico: pickNum(v.pesoConhecimentoTecnico, 0),
        weightsVivenciaEspecifica: pickNum(v.pesoVivenciaEspecifica, 0),
        localidadeMaxDistanciaKm: v.localidadeMaxDistanciaKm != null ? String(v.localidadeMaxDistanciaKm) : "",
        etapas: etaRaw.map((e: any) => ({ nome: pick(e.nome), responsavel: pickEnum(e.responsavel), modo: pickEnum(e.modo), slaDias: e.slaDias != null ? String(e.slaDias) : "", descricao: pick(e.descricaoInstrucoes) })),
        perguntasTriagem: pergRaw.map((p: any) => ({ texto: pick(p.texto), tipo: pickEnum(p.tipo), peso: pick(p.peso, "1"), obrigatoria: pickBool(p.obrigatoria), knockout: pickBool(p.knockout), opcoes: pick(p.opcoesRaw) })),
        observacoesProcesso: pick(v.observacoesProcesso),
        visibilidade: pickEnum(v.visibilidade), dataInicio: pick(v.dataInicio), dataEncerramento: pick(v.dataEncerramento),
        slaDiasMetaFechamento: v.slaDiasMetaFechamento != null ? String(v.slaDiasMetaFechamento) : "",
        canalLinkedIn: pickBool(v.canalLinkedIn), canalSiteCarreiras: pickBool(v.canalSiteCarreiras),
        canalIndicacao: pickBool(v.canalIndicacao), canalPortaisEmprego: pickBool(v.canalPortaisEmprego),
        descricaoPublica: pick(v.descricaoPublica),
        lgpdConsentimento: pickBool(v.lgpdSolicitarConsentimentoExplicito),
        lgpdCompartilhamento: pickBool(v.lgpdCompartilharCurriculoInternamente),
        lgpdRetencao: pickBool(v.lgpdRetencaoAtiva),
        lgpdRetencaoMeses: v.lgpdRetencaoMeses != null ? String(v.lgpdRetencaoMeses) : "",
        exigeCnh: pickBool(v.exigeCnh), disponibilidadeViagens: pickBool(v.disponibilidadeParaViagens),
        checagemAntecedentes: pickBool(v.checagemAntecedentes),
        nomeEngessado: pick(v.nomeEngessado),
      });
      const descricaoCargoCode = pick(v.descricaoCargoCode);
      const descricaoCargoTitle = pick(v.descricaoCargoTitle);
      setDescricaoCargoSearch(descricaoCargoCode ? `${descricaoCargoCode} - ${descricaoCargoTitle}` : "");
    } catch { toast.error("Falha ao carregar dados da vaga."); }
  }

  async function reloadHorariosDoTurno() {
    if (!draft.turnoId) {
      toast.error("Selecione um turno cadastrado.");
      return;
    }
    if (horarioRawHasPopulatedGrid(draft.escalaTrabalhoRaw)) {
      const ok = await confirmDialog({
        title: "Substituir horários?",
        description: "A grade atual será substituída pelos horários do cadastro do turno (se existirem).",
        confirmText: "Substituir",
        cancelText: "Cancelar",
      });
      if (!ok) return;
    }
    try {
      const t = await fetchJson<Record<string, unknown>>(`${BASE}/api/turnos/${encodeURIComponent(draft.turnoId)}`);
      const g = t?.gradeHorarioJson != null ? String(t.gradeHorarioJson).trim() : "";
      if (horarioRawHasPopulatedGrid(g)) {
        set("escalaTrabalhoRaw", g);
        turnoGradeJsonRef.current = g;
        toast.success("Horários atualizados a partir do turno.");
        return;
      }
      toast.error("Este turno não possui grade de horários no cadastro. Preencha a grade manualmente ou use um preset.");
    } catch {
      toast.error("Falha ao buscar o turno.");
    }
  }

  async function handleSave() {
    if (!draft.titulo.trim()) { toast.error("Informe o título da vaga."); setTab("identificacao"); return; }
    if (!draft.status) { toast.error("Selecione o status."); setTab("dados"); return; }

    // Ao publicar, exige campos essenciais preenchidos
    if (draft.status.toLowerCase() === "aberta") {
      const campos: string[] = [];
      if (!draft.tipoContratacao) campos.push("Tipo de Contratação");
      if (!draft.modalidade) campos.push("Modalidade");
      if (!draft.quantidadeVagas || draft.quantidadeVagas < 1) campos.push("Qtd. de Vagas");
      if (!draft.descricaoCargoId) campos.push("Descrição de Cargo (DNALIO)");
      if (!draft.eixoVagaId) campos.push("Tipo de Vaga");
      const mod = draft.modalidade.toLowerCase();
      if ((mod === "presencial" || mod === "hibrido") && !draft.unitId.trim()) {
        toast.error("Selecione o local da vaga (estabelecimento) para vagas presenciais ou híbridas.");
        setTab("local");
        return;
      }
      if (campos.length > 0) {
        toast.error(`Preencha antes de publicar: ${campos.join(", ")}`);
        setTab(!draft.descricaoCargoId ? "matching" : !draft.eixoVagaId ? "publicacao" : "dados");
        return;
      }
    }

    const mfRaw = buildMatchingFiltrosRaw(draft, enums);
    if (!draft.id && !mfRaw) { toast.error("Preencha os filtros de matching (IA) para criar a vaga."); setTab("matching"); return; }

    setSaving(true);
    const payload = buildPayload(draft, enums);
    try {
      if (draft.id) {
        const updated = await fetchJson<Record<string, unknown>>(`${BASE}/api/vagas/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (draft.descricaoCargoId && String(updated?.descricaoCargoId ?? "") !== draft.descricaoCargoId) {
          throw new Error("A API salvou a vaga, mas não retornou o vínculo DNALIO. Reabra a vaga e tente novamente.");
        }
        if (wizardMode) {
          toast.success("Salvo!");
          const idx = STEPPER_SEQUENCE.indexOf(tab);
          if (idx >= 0 && idx < STEPPER_SEQUENCE.length - 1) {
            setTab(STEPPER_SEQUENCE[idx + 1]);
          }
          setSaving(false);
          return;
        }
        toast.success("Vaga atualizada.");
        onSaved(draft.id);
      } else {
        const created = await fetchJson<Record<string, unknown>>(`${BASE}/api/vagas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const createdId = created && typeof created.id === "string" ? created.id : undefined;
        if (createdId) {
          toast.success("Vaga criada! Continue preenchendo os detalhes.");
          setDraft((d) => ({ ...d, id: createdId }));
          setWizardMode(true);
          setTab("identificacao");
          setSaving(false);
          return;
        }
        toast.success("Vaga criada.");
        onSaved(createdId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar vaga.";
      toast.error(msg);
    }
    finally { setSaving(false); }
  }

  const weightsTotal = draft.weightsCompetencia + draft.weightsExperiencia + draft.weightsFormacao + draft.weightsLocalidade;

  if (!open) return null;

  // Modo embutido (embedded): sem overlay, ocupa espaço na página
  // Modo modal (default): overlay lateral direito
  const outerCls = embedded
    ? "relative rounded-xl border border-border/40 bg-card shadow-sm flex flex-col overflow-hidden min-h-[70vh]"
    : "fixed inset-0 z-50 flex items-stretch justify-end bg-black/40";
  const innerCls = embedded
    ? "flex flex-col flex-1 overflow-hidden"
    : "w-full max-w-5xl bg-white shadow-2xl flex flex-col overflow-hidden";

  return (
    <div
      className={outerCls}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-busy={embedded ? embeddedBootstrapLoading : undefined}
      onClick={embedded ? undefined : onClose}
    >
      <div className={innerCls} onClick={embedded ? undefined : (e) => e.stopPropagation()}>
        {/* Header — oculto no modo embedded (VagaEditScreen já tem header) */}
        {!embedded && (
        <div className="flex items-start justify-between gap-2 p-4 border-b border-black/10 shrink-0">
          <div>
            <h5 className="font-bold text-lg">{draft.id ? "Editar vaga" : "Nova vaga"}</h5>
            <div className="text-muted-foreground text-sm">Dados principais da vaga. Requisitos e pesos ficam nos detalhes.</div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        )}

        {/* Stepper wizard */}
        {wizardMode && (
          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 shrink-0 border-b border-border/30">
            {STEPPER_SEQUENCE.map((stepKey, i) => {
              const done = stepCompletion.get(stepKey) ?? false;
              const current = tab === stepKey;
              return (
                <div key={stepKey} className="contents">
                  {i > 0 && <div className={`flex-1 h-px ${done ? "bg-emerald-400" : "bg-border"}`} />}
                  <button
                    type="button"
                    onClick={() => setTab(stepKey)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                      current ? "bg-primary text-primary-foreground shadow-sm"
                      : done ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done && !current ? <Check className="size-3" /> : <span className="font-bold">{i + 1}</span>}
                    <span className="hidden sm:inline">{STEPPER_LABELS[stepKey]}</span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => { setWizardMode(false); onSaved(draft.id); }}
            >
              Pular
            </button>
          </div>
        )}

        {/* Tab pills */}
        <div className="px-4 pt-3 pb-2 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 min-w-max" style={{ background: "rgba(173,200,220,.16)", padding: ".35rem", borderRadius: "999px", border: "1px solid rgba(16,82,144,.14)" }}>
            {TABS.filter((t) => t.key !== "posicao" || !!draft.id).map((t) => (
              <button
                key={t.key}
                type="button"
                className={`px-3 py-1.5 rounded-full text-[0.82rem] font-medium whitespace-nowrap transition-all ${tab === t.key ? "bg-white shadow-sm text-[rgb(var(--lt-primary))]" : "text-muted-foreground hover:bg-white/60"}`}
                onClick={() => setTab(t.key)}
              >
                <span className="mr-1">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* ── Identificação ───────────────────────────────────── */}
          {tab === "identificacao" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Identificação da vaga" />

              <Field label="Título da vaga" required span="col-span-12">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Analista de Marketing Jr" value={draft.titulo} onChange={(e) => set("titulo", e.target.value)} />
              </Field>

              <Field label="Função" span="col-span-12 md:col-span-6">
                <input
                  readOnly
                  className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  placeholder={draft.codFuncaoRm ? "" : "— sem vínculo RM —"}
                  value={draft.funcaoNomeRm ? `${draft.codFuncaoRm} · ${draft.funcaoNomeRm}` : ""}
                  title="Função TOTVS (PFUNCAO) — vem do RM, não editável"
                />
              </Field>
              <Field label="Tipo de contratação" span="col-span-12 md:col-span-4">
                <EnumSelect value={draft.tipoContratacao} onChange={(v) => set("tipoContratacao", v)} options={enumOpts(enums, "vagaTipoContratacao", "Selecionar")} />
              </Field>

              <Field label="Centro de custo" span="col-span-12 md:col-span-6">
                <input
                  readOnly
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={[draft.centroCustoCode, draft.centroCustoDescription].filter(Boolean).join(" - ")}
                  placeholder="—"
                />
              </Field>

              <Field label="Qtd. vagas" span="col-span-6 md:col-span-3">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={1} value={draft.quantidadeVagas} onChange={(e) => set("quantidadeVagas", Math.max(1, Number(e.target.value) || 1))} />
              </Field>

              <Field label="Justificativa / Desc. interna" span="col-span-12">
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Contexto da contratação, justificativa do requisitante, notas para o recrutador..." value={draft.descricaoInterna} onChange={(e) => set("descricaoInterna", e.target.value)} />
              </Field>
            </div>
          )}

          {/* ── Horário ──────────────────────────────────────────── */}
          {tab === "horario" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <div className="col-span-12 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-xs text-muted-foreground max-w-3xl">
                  O <strong>turno</strong> vem do cadastro da empresa (e da solicitação, quando houver). A <strong>grade abaixo</strong> é o detalhamento salvo na vaga — ao abrir a tela, ela é preenchida pelos horários do turno quando o cadastro os tiver; você pode ajustar manualmente ou usar os presets do editor.
                </p>
                <Button type="button" variant="outline" size="sm" className="shrink-0 self-start" onClick={() => void reloadHorariosDoTurno()}>
                  Recarregar do turno
                </Button>
              </div>
              <Field label="Turno" span="col-span-12 md:col-span-6">
                <TurnoAutocomplete
                  value={draft.turnoCode || draft.turnoId}
                  defaultLabel={draft.turnoCode ? { code: draft.turnoCode, description: draft.turnoDescription } : undefined}
                  onChange={(code) => set("turnoCode", code)}
                  onSelectId={(id) => set("turnoId", id)}
                  onSelectItem={(item) => {
                    setDraft((d) => ({
                      ...d,
                      turnoId: item.id,
                      turnoCode: item.code,
                      turnoDescription: item.description,
                    }));
                  }}
                  placeholder="Buscar turno..."
                />
              </Field>
              <div className="col-span-12 mt-1">
                <HorarioEditor value={draft.escalaTrabalhoRaw} onChange={(v) => set("escalaTrabalhoRaw", v)} />
              </div>
            </div>
          )}

          {/* ── Dados básicos ────────────────────────────────────── */}
          {tab === "dados" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">

              {/* Seção: Identificação */}
              <SectionHeader title="Código e posicionamento" description="Código, status e hierarquia interna da vaga." />
              <Field label="Status" required span="col-span-12 md:col-span-3"><EnumSelect value={draft.status} onChange={(v) => set("status", v)} options={enumOpts(enums, "vagaStatus")} /></Field>
              <Field label="Gestor requisitante" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Nome do gestor" maxLength={120} value={draft.gestorRequisitante} onChange={(e) => set("gestorRequisitante", e.target.value)} /></Field>
              {/* Seção: Configurações */}
              <SectionHeader title="Configurações da vaga" />
              <Field label="Modalidade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.modalidade} onChange={(v) => set("modalidade", v)} options={enumOpts(enums, "vagaModalidade")} /></Field>
              <Field label="Senioridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.senioridade} onChange={(v) => set("senioridade", v)} options={enumOpts(enums, "vagaSenioridade", "Selecionar")} /></Field>
              <Field label="Motivo de abertura" span="col-span-12 md:col-span-3"><EnumSelect value={draft.motivoAbertura} onChange={(v) => set("motivoAbertura", v)} options={enumOpts(enums, "vagaMotivoAbertura", "Selecionar")} /></Field>

              {/* Seção: Descrição e conteúdo */}
              <SectionHeader title="Descrição e conteúdo" />
              <Field label="Resumo / pitch da vaga" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Descreva brevemente o propósito da vaga e o diferencial para atrair candidatos." value={draft.resumoPitch} onChange={(e) => set("resumoPitch", e.target.value)} /></Field>
              <Field label="Responsabilidades (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: triagem de currículos; entrevistas; alinhamento com gestores" value={draft.tagsResponsabilidades} onChange={(e) => set("tagsResponsabilidades", e.target.value)} /></Field>
              <Field label="Palavras-chave (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: recrutamento; ATS; entrevistas por competência" value={draft.tagsKeywords} onChange={(e) => set("tagsKeywords", e.target.value)} /></Field>

            </div>
          )}

          {/* ── Projeto ──────────────────────────────────────────── */}
          {tab === "projeto" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Informações do projeto" description="Preencha quando a vaga estiver vinculada a um projeto específico." />
              <Field label="Nome do projeto" span="col-span-12 md:col-span-5"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Migração RH / Expansão Latam" value={draft.projetoNome} onChange={(e) => set("projetoNome", e.target.value)} /></Field>
              <Field label="Cliente / Área impactada" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Operações, TI, Comercial" value={draft.projetoCliente} onChange={(e) => set("projetoCliente", e.target.value)} /></Field>
              <Field label="Prazo previsto" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Q3/2025 ou 31/12/2025" value={draft.projetoPrazo} onChange={(e) => set("projetoPrazo", e.target.value)} /></Field>
              <Field label="Descrição / escopo do projeto" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={4} placeholder="Descreva o escopo, objetivos e contexto do projeto." value={draft.projetoDescricao} onChange={(e) => set("projetoDescricao", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Local e jornada ──────────────────────────────────── */}
          {tab === "local" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Localização" />

              <div className="col-span-12">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Local da vaga</p>
              </div>

              <Field
                label="Empresa"
                required={draft.modalidade === "presencial" || draft.modalidade === "hibrido"}
                span="col-span-12 md:col-span-6"
              >
                <LookupSelect
                  value={draft.empresaId}
                  placeholder="Selecione a empresa..."
                  options={empresaOptions}
                  onChange={(id) => {
                    const empresa = empresaOptions.find((e) => e.id === id);
                    setDraft((d) => ({
                      ...d,
                      empresaId: id,
                      empresaCode: empresa?.code ?? "",
                      empresaDescription: empresa?.name ?? "",
                      unitId: "",
                      unitCode: "",
                      unitName: "",
                      cep: "",
                      logradouro: "",
                      numero: "",
                      bairro: "",
                      cidade: "",
                      uf: "",
                    }));
                  }}
                />
              </Field>

              <Field
                label="Local da vaga"
                required={draft.modalidade === "presencial" || draft.modalidade === "hibrido"}
                span="col-span-12 md:col-span-6"
              >
                <LookupSelect
                  value={draft.unitId}
                  placeholder={draft.empresaId ? (loadingUnitOptions ? "Carregando locais..." : "Selecione o local da vaga...") : "Selecione a empresa primeiro"}
                  options={unitOptions}
                  disabled={!draft.empresaId || loadingUnitOptions}
                  onChange={(id) => { void applyUnitToDraft(id || null); }}
                />
              </Field>

              <div className="col-span-12">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereço do local (automático)</p>
              </div>

              <div className="col-span-12 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                  <Field label="CEP" span="col-span-6 md:col-span-2">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.cep} placeholder="—" />
                  </Field>
                  <Field label="Logradouro" span="col-span-12 md:col-span-6">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.logradouro} placeholder="—" />
                  </Field>
                  <Field label="Número" span="col-span-6 md:col-span-2">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.numero} placeholder="—" />
                  </Field>
                  <Field label="Bairro" span="col-span-6 md:col-span-2">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.bairro} placeholder="—" />
                  </Field>
                  <Field label="Cidade" span="col-span-12 md:col-span-4">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.cidade} placeholder="—" />
                  </Field>
                  <Field label="UF" span="col-span-6 md:col-span-2">
                    <input className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" readOnly value={draft.uf} placeholder="—" />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Preenchido automaticamente a partir do local selecionado.</p>
              </div>

              <Field label="Política de trabalho" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: 2 dias presencial, 3 remoto" value={draft.politicaTrabalho} onChange={(e) => set("politicaTrabalho", e.target.value)} /></Field>
              <Field label="Obs. deslocamento / viagens" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: viagens 1x/mês, nacional" value={draft.observacoesDeslocamento} onChange={(e) => set("observacoesDeslocamento", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Remuneração ──────────────────────────────────────── */}
          {tab === "remuneracao" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <div className="col-span-12 flex items-center justify-between">
                <SectionHeader title="Salário" />
                <SugerirSalarioButton
                  vagaId={vagaId}
                  onAplicar={(min, max) => {
                    const valor = min > 0 ? min : max;
                    const formatted = valor.toFixed(2).replace(".", ",");
                    set("salarioMinimo", formatted);
                    set("salarioMaximo", formatted);
                  }}
                />
              </div>
              <Field label="Moeda" span="col-span-6 md:col-span-2"><EnumSelect value={draft.moeda || "brl"} onChange={(v) => set("moeda", v || "brl")} options={enumOpts(enums, "vagaMoeda")} /></Field>
              <Field label="Salário" span="col-span-6 md:col-span-4">
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={draft.salarioMinimo}
                  onChange={(e) => {
                    const value = formatMoneyInput(e.target.value);
                    setDraft((d) => ({ ...d, salarioMinimo: value, salarioMaximo: value }));
                  }}
                />
              </Field>
              <Field label="Periodicidade" span="col-span-6 md:col-span-6"><EnumSelect value={draft.periodicidade || "mensal"} onChange={(v) => set("periodicidade", v || "mensal")} options={enumOpts(enums, "vagaRemuneracaoPeriodicidade")} /></Field>
              <Field label="Tipo de bônus / extra" span="col-span-12 md:col-span-4"><EnumSelect value={draft.bonusTipo} onChange={(v) => set("bonusTipo", v)} options={enumOpts(enums, "vagaBonusTipo", "Selecionar")} /></Field>
              <Field label="% bônus" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0%" value={draft.bonusPercentual} onChange={(e) => set("bonusPercentual", e.target.value)} /></Field>
              <Field label="Observações de remuneração" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: faixa depende de senioridade" value={draft.observacoesRemuneracao} onChange={(e) => set("observacoesRemuneracao", e.target.value)} /></Field>
              <Field label="Travar faixa salarial do cargo" span="col-span-12 md:col-span-6"><Toggle label={draft.travarFaixaSalarial ? "Travada — precisa de alçada para sair da faixa" : "Livre"} checked={draft.travarFaixaSalarial} onChange={(v) => set("travarFaixaSalarial", v)} /></Field>
              <div className="col-span-12 flex items-center justify-between gap-2 pt-1">
                <div>
                  <p className="text-sm font-semibold">Benefícios</p>
                  <p className="text-xs text-muted-foreground">Adicione benefícios com tipo, valor e detalhes.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setList("beneficios", (l) => [...l, { tipo: "", valor: "", recorrencia: "mensal", obrigatorio: true, obs: "" }])}>+ Adicionar</Button>
              </div>
              {draft.beneficios.map((b, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Benefício #{i + 1}</span><Button variant="destructive" size="sm" onClick={() => setList("beneficios", (l) => l.filter((_, j) => j !== i))}>Remover</Button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Tipo" span="col-span-12 md:col-span-4"><EnumSelect value={b.tipo} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, tipo: v } : x))} options={enumOpts(enums, "vagaBeneficioTipo", "Selecionar")} /></Field>
                    <Field label="Valor" span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="R$ 0,00" value={b.valor} onChange={(e) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} /></Field>
                    <Field label="Recorrência" span="col-span-6 md:col-span-3"><EnumSelect value={b.recorrencia} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, recorrencia: v } : x))} options={enumOpts(enums, "vagaBeneficioRecorrencia")} /></Field>
                    <Field label="Obrigatório?" span="col-span-6 md:col-span-2"><Toggle label="Sim" checked={b.obrigatorio} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, obrigatorio: v } : x))} /></Field>
                    <Field label="Observações" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: coparticipação, carência, faixa" value={b.obs} onChange={(e) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Requisitos ───────────────────────────────────────── */}
          {tab === "requisitos" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Requisitos básicos" />
              <Field label="Escolaridade mínima" span="col-span-12 md:col-span-4"><EnumSelect value={draft.escolaridade} onChange={(v) => set("escolaridade", v)} options={enumOpts(enums, "vagaEscolaridade", "Selecionar")} /></Field>
              <Field label="Área de formação" span="col-span-12 md:col-span-4"><EnumSelect value={draft.formacaoArea} onChange={(v) => set("formacaoArea", v)} options={enumOpts(enums, "vagaFormacaoArea", "Selecionar")} /></Field>
              <Field label="Experiência mínima (anos)" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0" value={draft.experienciaMinimaAnos} onChange={(e) => set("experienciaMinimaAnos", e.target.value)} /></Field>
              <Field label="Stack / Ferramentas (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: Excel; Power BI; SQL; Salesforce" value={draft.tagsStack} onChange={(e) => set("tagsStack", e.target.value)} /></Field>
              <Field label="Idiomas (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: Inglês (B2); Espanhol (A2)" value={draft.tagsIdiomas} onChange={(e) => set("tagsIdiomas", e.target.value)} /></Field>
              <Field label="Diferenciais" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Ex.: certificações, experiência em alto volume, MBA" value={draft.diferenciais} onChange={(e) => set("diferenciais", e.target.value)} /></Field>
              <div className="col-span-12 flex items-center justify-between gap-2 pt-1">
                <div>
                  <p className="text-sm font-semibold">Requisitos detalhados</p>
                  <p className="text-xs text-muted-foreground">Defina peso, obrigatoriedade, nível e método de avaliação para cada requisito.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setList("requisitos", (l) => [...l, { nome: "", categoria: "competencia", peso: "1", obrigatorio: false, anosMinimos: "", nivel: "", avaliacao: "", sinonimos: "", obs: "" }])}>+ Adicionar requisito</Button>
              </div>
              {draft.requisitos.map((r, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Requisito #{i + 1}</span><Button variant="destructive" size="sm" onClick={() => setList("requisitos", (l) => l.filter((_, j) => j !== i))}>Remover</Button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Requisito" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Excel avançado, SQL, etc." value={r.nome} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></Field>
                    <Field label="Peso (1-10)" span="col-span-6 md:col-span-2"><EnumSelect value={r.peso} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, peso: v } : x))} options={enumOpts(enums, "vagaPeso").length ? enumOpts(enums, "vagaPeso") : Array.from({ length: 10 }, (_, k) => ({ code: String(k + 1), text: String(k + 1) }))} /></Field>
                    <Field label="Obrigatório" span="col-span-6 md:col-span-2"><Toggle label="Sim" checked={r.obrigatorio} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, obrigatorio: v } : x))} /></Field>
                    <Field label="Anos mín." span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0" value={r.anosMinimos} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, anosMinimos: e.target.value } : x))} /></Field>
                    <Field label="Nível" span="col-span-6 md:col-span-4"><EnumSelect value={r.nivel} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, nivel: v } : x))} options={enumOpts(enums, "vagaRequisitoNivel", "Selecionar")} /></Field>
                    <Field label="Avaliação" span="col-span-6 md:col-span-4"><EnumSelect value={r.avaliacao} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, avaliacao: v } : x))} options={enumOpts(enums, "vagaRequisitoAvaliacao", "Selecionar")} /></Field>
                    <Field label="Sinônimos (vírgula)" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: pbi, powerbi, business intelligence" value={r.sinonimos} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, sinonimos: e.target.value } : x))} /></Field>
                    <Field label="Obs." span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: precisa ter aplicado em alto volume" value={r.obs} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filtros matching (IA) ────────────────────────────── */}
          {tab === "matching" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Critérios do candidato ideal" description="Esses dados são usados como contexto para o matching por IA. Preencha apenas o que for relevante." />
              <Field label="Modalidade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingModalidade} onChange={(v) => set("matchingModalidade", v)} options={enumOpts(enums, "vagaModalidade", "Qualquer")} /></Field>
              <Field label="Senioridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingSenioridade} onChange={(v) => set("matchingSenioridade", v)} options={enumOpts(enums, "vagaSenioridade", "Qualquer")} /></Field>
              <Field label="Escolaridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingEscolaridade} onChange={(v) => set("matchingEscolaridade", v)} options={enumOpts(enums, "vagaEscolaridade", "Qualquer")} /></Field>
              <Field label="Formação (área)" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingFormacaoArea} onChange={(v) => set("matchingFormacaoArea", v)} options={enumOpts(enums, "vagaFormacaoArea", "Qualquer")} /></Field>
              <Field label="Cidade" span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: São Paulo" value={draft.matchingCidade} onChange={(e) => set("matchingCidade", e.target.value)} /></Field>
              <Field label="UF" span="col-span-6 md:col-span-3">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={draft.matchingUF} onChange={(e) => set("matchingUF", e.target.value)}>
                  <option value="">Qualquer</option>
                  {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Tempo de experiência" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingExp} onChange={(v) => set("matchingExp", v)} options={EXP_OPTIONS} /></Field>
              <Field label="Sexo" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingSexo} onChange={(v) => set("matchingSexo", v)} options={SEXO_OPTIONS} /></Field>
              <Field label="PCD" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingPcd} onChange={(v) => set("matchingPcd", v)} options={PCD_MATCH_OPTIONS} /></Field>
              <Field label="Idade mín." span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={14} max={100} placeholder="—" value={draft.matchingIdadeMin} onChange={(e) => set("matchingIdadeMin", e.target.value)} /></Field>
              <Field label="Idade máx." span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={14} max={100} placeholder="—" value={draft.matchingIdadeMax} onChange={(e) => set("matchingIdadeMax", e.target.value)} /></Field>
              <Field label="Habilidades desejadas" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: .NET, SQL, APIs REST (separadas por vírgula)" value={draft.matchingHabilidades} onChange={(e) => set("matchingHabilidades", e.target.value)} /></Field>
              <Field label="Observações adicionais (opcional)" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Outros critérios em texto livre" value={draft.matchingObs} onChange={(e) => set("matchingObs", e.target.value)} /></Field>

              <SectionHeader title="Descrição de Cargo (template DNALIO)" description="Vincule uma descrição de cargo — o matching consome as seções estruturadas (Atividades, Competências, Vivências, Requisitos) para calcular score por categoria." />
              <Field label="Descrição de cargo" span="col-span-12">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Busque por código ou título da descrição"
                      value={descricaoCargoSearch}
                      onChange={(e) => setDescricaoCargoSearch(e.target.value)}
                    />
                    {draft.descricaoCargoId && (
                      <Button type="button" variant="outline" size="sm" onClick={clearDescricaoCargo}>
                        Limpar vínculo
                      </Button>
                    )}
                  </div>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    size={Math.min(6, Math.max(3, descricaoCargoListOptions.length || 3))}
                    value={draft.descricaoCargoId}
                    onChange={(e) => handleDescricaoCargoSelectValue(e.target.value)}
                    onClick={(e) => handleDescricaoCargoSelectValue(e.currentTarget.value)}
                  >
                    {loadingDescricaoCargo ? (
                      <option value="" disabled>Buscando descrições...</option>
                    ) : descricaoCargoListOptions.length === 0 ? (
                      <option value="" disabled>Nenhuma descrição encontrada</option>
                    ) : (
                      <>
                        {!draft.descricaoCargoId && (
                          <option value="" disabled>
                            Selecione uma descrição da lista
                          </option>
                        )}
                        {descricaoCargoListOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.displayLabel}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {draft.descricaoCargoId && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Vinculado: {draft.descricaoCargoCode || "Descrição selecionada"}{draft.descricaoCargoTitle ? ` - ${draft.descricaoCargoTitle}` : ""}
                    </p>
                  )}
                </div>
              </Field>

              <SectionHeader title="Pesos do matching (calibragem por vaga)" description="Distribua o peso entre as 7 dimensões — total recomendado: 100." />
              <Field label="Match mínimo (IA)" span="col-span-12 md:col-span-3">
                <div className="flex items-center gap-2">
                  <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.matchMinimoPercentual} onChange={(e) => set("matchMinimoPercentual", clamp(Number(e.target.value) || 0, 0, 100))} />
                  <span className="text-sm text-muted-foreground font-medium shrink-0">%</span>
                </div>
              </Field>
              <Field label={`Competência (${draft.weightsCompetencia})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsCompetencia} onChange={(e) => set("weightsCompetencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Experiência (${draft.weightsExperiencia})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsExperiencia} onChange={(e) => set("weightsExperiencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Formação (${draft.weightsFormacao})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsFormacao} onChange={(e) => set("weightsFormacao", Number(e.target.value) || 0)} /></Field>
              <Field label={`Localidade (${draft.weightsLocalidade})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsLocalidade} onChange={(e) => set("weightsLocalidade", Number(e.target.value) || 0)} /></Field>
              <Field label={`Idioma (${draft.weightsIdioma})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsIdioma} onChange={(e) => set("weightsIdioma", Number(e.target.value) || 0)} /></Field>
              <Field label={`Conhecimento Técnico (${draft.weightsConhecimentoTecnico})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsConhecimentoTecnico} onChange={(e) => set("weightsConhecimentoTecnico", Number(e.target.value) || 0)} /></Field>
              <Field label={`Vivência Específica (${draft.weightsVivenciaEspecifica})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsVivenciaEspecifica} onChange={(e) => set("weightsVivenciaEspecifica", Number(e.target.value) || 0)} /></Field>
              <Field label="Distância máxima (km)" span="col-span-6 md:col-span-3">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={1} placeholder="50 (default)" value={draft.localidadeMaxDistanciaKm} onChange={(e) => set("localidadeMaxDistanciaKm", e.target.value)} />
              </Field>
              <div className="col-span-12">
                {(() => {
                  const total = draft.weightsCompetencia + draft.weightsExperiencia + draft.weightsFormacao + draft.weightsLocalidade + draft.weightsIdioma + draft.weightsConhecimentoTecnico + draft.weightsVivenciaEspecifica;
                  return <span className={`badge-soft ${total === 100 ? "" : "text-red-600"}`}>Total: {total}%{total !== 100 && " (recomendado: 100%)"}</span>;
                })()}
              </div>
            </div>
          )}

          {/* ── Processo seletivo ────────────────────────────────── */}
          {tab === "processo" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <div className="col-span-12 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-semibold">Para que servem as etapas?</p>
                <p className="mt-1">
                  Elas desenham o fluxo de seleção desta vaga: triagem, entrevista RH, entrevista técnica, proposta, exame admissional etc.
                  A ordem cadastrada aqui aparece no hub da vaga e ajuda o RH a acompanhar responsáveis, formato e prazo de cada fase.
                </p>
              </div>
              <div className="col-span-12 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Etapas do processo seletivo</p>
                  <p className="text-xs text-muted-foreground">Clique em adicionar etapa, preencha nome, responsável, modo e SLA, depois salve a vaga.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setList("etapas", (l) => [...l, { nome: "", responsavel: "", modo: "", slaDias: "3", descricao: "" }])}>+ Adicionar etapa</Button>
              </div>
              {draft.etapas.length === 0 && (
                <div className="col-span-12 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Nenhuma etapa cadastrada ainda. Um fluxo comum é: Triagem RH, Entrevista RH, Entrevista Técnica, Proposta e Admissão.
                </div>
              )}
              {draft.etapas.map((e, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Etapa #{i + 1}</span><Button variant="destructive" size="sm" onClick={() => setList("etapas", (l) => l.filter((_, j) => j !== i))}>Remover</Button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Nome da etapa" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Entrevista RH" value={e.nome} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} /></Field>
                    <Field label="Responsável" span="col-span-12 md:col-span-3"><EnumSelect value={e.responsavel} onChange={(v) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, responsavel: v } : x))} options={enumOpts(enums, "vagaEtapaResponsavel", "Selecionar")} /></Field>
                    <Field label="Modo" span="col-span-6 md:col-span-2"><EnumSelect value={e.modo} onChange={(v) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, modo: v } : x))} options={enumOpts(enums, "vagaEtapaModo", "Selecionar")} /></Field>
                    <Field label="SLA (dias)" span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="3" value={e.slaDias} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, slaDias: ev.target.value } : x))} /></Field>
                    <Field label="Descrição / instruções" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: entrevista por competências, 45min" value={e.descricao} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, descricao: ev.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
              <div className="col-span-12 flex items-center justify-between gap-2 pt-2">
                <div>
                  <p className="text-sm font-semibold">Perguntas de triagem</p>
                  <p className="text-xs text-muted-foreground">Perguntas com knockout, peso e opções de resposta.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setList("perguntasTriagem", (l) => [...l, { texto: "", tipo: "", peso: "1", obrigatoria: true, knockout: false, opcoes: "" }])}>+ Adicionar pergunta</Button>
              </div>
              {draft.perguntasTriagem.map((p, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Pergunta #{i + 1}</span><Button variant="destructive" size="sm" onClick={() => setList("perguntasTriagem", (l) => l.filter((_, j) => j !== i))}>Remover</Button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Pergunta" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Tem disponibilidade para presencial 2x por semana?" value={p.texto} onChange={(ev) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, texto: ev.target.value } : x))} /></Field>
                    <Field label="Tipo" span="col-span-12 md:col-span-4"><EnumSelect value={p.tipo} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, tipo: v } : x))} options={enumOpts(enums, "vagaPerguntaTipo", "Selecionar")} /></Field>
                    <Field label="Peso" span="col-span-6 md:col-span-2"><EnumSelect value={p.peso} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, peso: v } : x))} options={enumOpts(enums, "vagaPeso").length ? enumOpts(enums, "vagaPeso") : Array.from({ length: 10 }, (_, k) => ({ code: String(k + 1), text: String(k + 1) }))} /></Field>
                    <Field label="Obrigatória?" span="col-span-6 md:col-span-3"><Toggle label="Sim" checked={p.obrigatoria} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, obrigatoria: v } : x))} /></Field>
                    <Field label="Knockout?" span="col-span-6 md:col-span-3"><Toggle label="Sim" checked={p.knockout} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, knockout: v } : x))} /></Field>
                    <Field label="Opções (separe por ;)" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Sim;Não;Talvez" value={p.opcoes} onChange={(ev) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, opcoes: ev.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
              <Field label="Observações internas do processo" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Ex.: aprovações necessárias, critérios de corte" value={draft.observacoesProcesso} onChange={(e) => set("observacoesProcesso", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Publicação ───────────────────────────────────────── */}
          {tab === "publicacao" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Configurações de publicação" />
              <Field label="Tipo de Vaga *" span="col-span-12 md:col-span-6">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.eixoVagaId}
                  onChange={(e) => {
                    const selected = tipoVagaOptions.find((t) => t.id === e.target.value) ?? null;
                    selectTipoVaga(selected);
                  }}
                >
                  <option value="">Selecionar tipo…</option>
                  {tipoVagaOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayLabel}</option>
                  ))}
                </select>
              </Field>
              {draft.eixoVagaId && (
                <div className="col-span-12 md:col-span-6 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <div><span className="text-muted-foreground">SLA:</span> <strong>{draft.eixoVagaSlaDias || "—"}</strong> dias úteis</div>
                  <div><span className="text-muted-foreground">Permanência (turnover):</span> <strong>{draft.eixoVagaPermanenciaDisplay || "—"}</strong></div>
                </div>
              )}
              <Field label="Visibilidade" span="col-span-12 md:col-span-3"><EnumSelect value={draft.visibilidade} onChange={(v) => set("visibilidade", v)} options={enumOpts(enums, "vagaPublicacaoVisibilidade", "Selecionar")} /></Field>
              <Field label="Início previsto no cargo" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="date" value={draft.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} title="Data em que o colaborador admitido deve iniciar no cargo" /></Field>
              <Field label="Encerramento das candidaturas" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="date" value={draft.dataEncerramento} onChange={(e) => set("dataEncerramento", e.target.value)} title="Até quando a vaga permanece aberta a candidaturas no portal" /></Field>

              <SectionHeader title="Canais de divulgação" />
              <div className="col-span-12 flex flex-wrap gap-4 rounded-md border border-border bg-muted/30 px-4 py-3">
                <Toggle label="LinkedIn" checked={draft.canalLinkedIn} onChange={(v) => set("canalLinkedIn", v)} />
                <Toggle label="Site/Carreiras" checked={draft.canalSiteCarreiras} onChange={(v) => set("canalSiteCarreiras", v)} />
                <Toggle label="Indicação" checked={draft.canalIndicacao} onChange={(v) => set("canalIndicacao", v)} />
                <Toggle label="Portais de emprego" checked={draft.canalPortaisEmprego} onChange={(v) => set("canalPortaisEmprego", v)} />
              </div>

              <SectionHeader title="Conteúdo público" />
              <Field label="Descrição pública" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={4} placeholder="Inclua responsabilidades, requisitos e benefícios que serão exibidos no portal." value={draft.descricaoPublica} onChange={(e) => set("descricaoPublica", e.target.value)} /></Field>
              {draft.id && (
                <div className="col-span-12">
                  <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Link do Portal de Candidatura</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-xs">
                        {buildPortalVagasUrl(draft.id, getTenantId() ?? "")}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={() => {
                      const tenantId = getTenantId() ?? "";
                      const url = buildPortalVagasUrl(draft.id ?? "", tenantId);
                      void navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
                    }}>
                      Copiar link
                    </Button>
                  </div>
                </div>
              )}

              <SectionHeader title="Conformidade e requisitos" />
              <div className="col-span-12 md:col-span-6 rounded-md border border-border bg-card p-4">
                <p className="text-xs font-semibold text-foreground mb-2">LGPD / Consentimentos</p>
                <div className="space-y-2">
                  <Toggle label="Solicitar consentimento explícito" checked={draft.lgpdConsentimento} onChange={(v) => set("lgpdConsentimento", v)} />
                  <Toggle label="Compartilhar currículo internamente" checked={draft.lgpdCompartilhamento} onChange={(v) => set("lgpdCompartilhamento", v)} />
                  <Toggle label="Retenção por X meses" checked={draft.lgpdRetencao} onChange={(v) => set("lgpdRetencao", v)} />
                </div>
                {draft.lgpdRetencao && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prazo de retenção (meses)</label>
                    <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="12" value={draft.lgpdRetencaoMeses} onChange={(e) => set("lgpdRetencaoMeses", e.target.value)} />
                  </div>
                )}
              </div>
              <div className="col-span-12 md:col-span-6 rounded-md border border-border bg-card p-4">
                <p className="text-xs font-semibold text-foreground mb-2">Documentos / Exigências</p>
                <div className="space-y-2">
                  <Toggle label="Checagem de antecedentes" checked={draft.checagemAntecedentes} onChange={(v) => set("checagemAntecedentes", v)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Campos personalizados ────────────────────────────── */}
          {tab === "campos" && (
            <div className="mt-2">
              <CamposPersonalizadosTab vagaId={draft.id} />
            </div>
          )}

          {/* ── Candidatos ───────────────────────────────────────── */}
          {tab === "candidatos" && (
            <div className="mt-2">
              {!draft.id ? (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  Salve a vaga primeiro para ver candidatos vinculados.
                </div>
              ) : (
                <CandidatosTab vagaId={draft.id} />
              )}
            </div>
          )}

          {/* ── Posição (headcount + histórico de ocupação) ──── */}
          {tab === "posicao" && (
            <div className="mt-2">
              {!draft.id ? (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  Salve a vaga primeiro para gerenciar ocupação.
                </div>
              ) : (
                <PosicaoTab vagaId={draft.id} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-black/10 shrink-0">
          {wizardMode && (
            <div className="flex items-center gap-2 mr-auto">
              <Button variant="outline" size="sm"
                disabled={STEPPER_SEQUENCE.indexOf(tab) <= 0}
                onClick={() => setTab(STEPPER_SEQUENCE[Math.max(0, STEPPER_SEQUENCE.indexOf(tab) - 1)])}
              >
                Anterior
              </Button>
              {STEPPER_SEQUENCE.indexOf(tab) < STEPPER_SEQUENCE.length - 1 ? (
                <Button variant="outline" size="sm"
                  onClick={() => setTab(STEPPER_SEQUENCE[STEPPER_SEQUENCE.indexOf(tab) + 1])}
                >
                  Próximo
                </Button>
              ) : (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setWizardMode(false); onSaved(draft.id); }}
                >
                  Concluir
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors" type="button" onClick={() => { if (wizardMode) setWizardMode(false); onClose(); }}>Cancelar</button>
            <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none" type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Salvando..." : "Salvar vaga"}
            </button>
          </div>
        </div>
      </div>

      {embedded && embeddedBootstrapLoading ? (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-background/80 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
          <p className="text-base font-semibold text-foreground">Aguarde</p>
          <p className="text-xs text-muted-foreground">Carregando dados da vaga…</p>
        </div>
      ) : null}
    </div>
  );
}
