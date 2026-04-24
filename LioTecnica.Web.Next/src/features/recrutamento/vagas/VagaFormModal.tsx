"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getTenantId } from "@/lib/session";
import { CargoAutocomplete, type CargoLookup } from "@/components/autocomplete/CargoAutocomplete";
import { CategoriaSalarialAutocomplete } from "@/components/autocomplete/CategoriaSalarialAutocomplete";
import { CentroCustoAutocomplete } from "@/components/autocomplete/CentroCustoAutocomplete";
import { TurnoAutocomplete } from "@/components/autocomplete/TurnoAutocomplete";
import { UnidadeLotacaoAutocomplete } from "@/components/autocomplete/UnidadeLotacaoAutocomplete";
import { HorarioEditor } from "@/components/gestao/HorarioEditor";

const BASE = "/app";
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
const CNH_CATS = ["A", "B", "AB", "C", "D", "E"];

type EnumOption = { code: string; text: string };
type EnumData = Record<string, EnumOption[]>;
type AreaLookup = { id: string; name: string; code?: string };
type DeptLookup = { id: string; name: string; code?: string };

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
  titulo: string; codigo: string; departmentId: string; areaId: string;
  areaTime: string; modalidade: string; status: string; senioridade: string;
  quantidadeVagas: number; tipoContratacao: string; matchMinimoPercentual: number;
  descricaoInterna: string; codigoInterno: string; codigoCbo: string;
  cargoId: string; cargoCode: string; cargoName: string;
  categoriaSalarialId: string; categoriaSalarialCode: string; categoriaSalarialDescription: string;
  centroCustoId: string; centroCustoCode: string; centroCustoDescription: string;
  turnoId: string; turnoCode: string; turnoDescription: string;
  unidadeLotacaoId: string; unidadeLotacaoCode: string; unidadeLotacaoDescription: string;
  motivoAbertura: string; orcamentoAprovado: string; gestorRequisitante: string;
  recrutadorResponsavel: string; prioridade: string; resumoPitch: string;
  tagsResponsabilidades: string; tagsKeywords: string;
  confidencial: boolean; aceitaPcd: boolean; urgente: boolean;
  generoPreferencia: string; vagaAfirmativa: boolean; linguagemInclusiva: boolean;
  publicoAfirmativo: string; observacoesPcd: string;
  projetoNome: string; projetoCliente: string; projetoPrazo: string; projetoDescricao: string;
  regime: string; cargaSemanalHoras: string; escala: string; escalaTrabalhoRaw: string;
  horaEntrada: string; horaSaida: string; intervalo: string;
  cep: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; politicaTrabalho: string; observacoesDeslocamento: string;
  moeda: string; salarioMinimo: string; salarioMaximo: string; periodicidade: string;
  bonusTipo: string; bonusPercentual: string; observacoesRemuneracao: string;
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
    titulo: "", codigo: "", departmentId: "", areaId: "",
    areaTime: "", modalidade: "presencial", status: "aberta", senioridade: "",
    quantidadeVagas: 1, tipoContratacao: "", matchMinimoPercentual: 70,
    descricaoInterna: "", codigoInterno: "", codigoCbo: "",
    cargoId: "", cargoCode: "", cargoName: "",
    categoriaSalarialId: "", categoriaSalarialCode: "", categoriaSalarialDescription: "",
    centroCustoId: "", centroCustoCode: "", centroCustoDescription: "",
    turnoId: "", turnoCode: "", turnoDescription: "",
    unidadeLotacaoId: "", unidadeLotacaoCode: "", unidadeLotacaoDescription: "",
    motivoAbertura: "", orcamentoAprovado: "", gestorRequisitante: "",
    recrutadorResponsavel: "", prioridade: "", resumoPitch: "",
    tagsResponsabilidades: "", tagsKeywords: "",
    confidencial: false, aceitaPcd: false, urgente: false,
    generoPreferencia: "", vagaAfirmativa: false, linguagemInclusiva: false,
    publicoAfirmativo: "", observacoesPcd: "",
    projetoNome: "", projetoCliente: "", projetoPrazo: "", projetoDescricao: "",
    regime: "", cargaSemanalHoras: "", escala: "", escalaTrabalhoRaw: "",
    horaEntrada: "", horaSaida: "", intervalo: "",
    cep: "", logradouro: "", numero: "", bairro: "",
    cidade: "", uf: "", politicaTrabalho: "", observacoesDeslocamento: "",
    moeda: "", salarioMinimo: "", salarioMaximo: "", periodicidade: "",
    bonusTipo: "", bonusPercentual: "", observacoesRemuneracao: "",
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

function buildPayload(d: VagaDraft, enums: EnumData) {
  const tagsRaw = (s: string) => s.split(";").map((x) => x.trim()).filter(Boolean).join(";") || null;
  const matchingFiltrosRaw = buildMatchingFiltrosRaw(d, enums);
  return {
    titulo: d.titulo.trim(),
    departmentId: emptyToNull(d.departmentId),
    areaId: d.areaId || null,
    status: d.status || "aberta",
    codigo: emptyToNull(d.codigo),
    areaTime: emptyToNull(d.areaTime),
    modalidade: emptyToNull(d.modalidade),
    senioridade: emptyToNull(d.senioridade),
    quantidadeVagas: Math.max(1, d.quantidadeVagas),
    tipoContratacao: emptyToNull(d.tipoContratacao),
    matchMinimoPercentual: clamp(d.matchMinimoPercentual, 0, 100),
    weights: { competencia: d.weightsCompetencia, experiencia: d.weightsExperiencia, formacao: d.weightsFormacao, localidade: d.weightsLocalidade },
    matchingFiltrosRaw,
    descricaoInterna: emptyToNull(d.descricaoInterna),
    codigoInterno: emptyToNull(d.codigoInterno),
    codigoCbo: emptyToNull(d.codigoCbo),
    jobPositionId: emptyToNull(d.cargoId) || null,
    categoriaSalarialId: emptyToNull(d.categoriaSalarialId) || null,
    centroCustoId: emptyToNull(d.centroCustoId) || null,
    turnoId: emptyToNull(d.turnoId) || null,
    unidadeLotacaoId: emptyToNull(d.unidadeLotacaoId) || null,
    motivoAbertura: emptyToNull(d.motivoAbertura),
    orcamentoAprovado: emptyToNull(d.orcamentoAprovado),
    gestorRequisitante: emptyToNull(d.gestorRequisitante),
    recrutadorResponsavel: emptyToNull(d.recrutadorResponsavel),
    prioridade: emptyToNull(d.prioridade),
    resumoPitch: emptyToNull(d.resumoPitch),
    tagsResponsabilidadesRaw: tagsRaw(d.tagsResponsabilidades),
    tagsKeywordsRaw: tagsRaw(d.tagsKeywords),
    confidencial: d.confidencial,
    aceitaPcd: d.aceitaPcd,
    urgente: d.urgente,
    generoPreferencia: emptyToNull(d.generoPreferencia),
    vagaAfirmativa: d.vagaAfirmativa,
    linguagemInclusiva: d.linguagemInclusiva,
    publicoAfirmativo: emptyToNull(d.publicoAfirmativo),
    observacoesPcd: emptyToNull(d.observacoesPcd),
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
    moeda: emptyToNull(d.moeda),
    salarioMinimo: d.salarioMinimo ? Number(d.salarioMinimo.replace(",", ".")) || null : null,
    salarioMaximo: d.salarioMaximo ? Number(d.salarioMaximo.replace(",", ".")) || null : null,
    periodicidade: emptyToNull(d.periodicidade),
    bonusTipo: emptyToNull(d.bonusTipo),
    bonusPercentual: d.bonusPercentual ? Number(d.bonusPercentual.replace(",", ".")) || null : null,
    observacoesRemuneracao: emptyToNull(d.observacoesRemuneracao),
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
    slaDiasMetaFechamento: d.slaDiasMetaFechamento ? Number(d.slaDiasMetaFechamento) || null : null,
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

/* ── Tab definitions ─────────────────────────────────────────────────── */

type TabKey = "identificacao" | "horario" | "dados" | "diversidade" | "projeto" | "local" | "remuneracao" | "requisitos" | "matching" | "processo" | "publicacao" | "campos" | "candidatos" | "posicao";

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "identificacao", icon: "🪪", label: "Identificação" },
  { key: "horario", icon: "🕐", label: "Horário" },
  { key: "dados", icon: "📋", label: "Dados básicos" },
  { key: "diversidade", icon: "💜", label: "Diversidade" },
  { key: "projeto", icon: "📁", label: "Projeto" },
  { key: "local", icon: "📍", label: "Localização" },
  { key: "remuneracao", icon: "💰", label: "Remuneração" },
  { key: "requisitos", icon: "✅", label: "Requisitos" },
  { key: "matching", icon: "✨", label: "Filtros matching (IA)" },
  { key: "processo", icon: "🔀", label: "Processo seletivo" },
  { key: "publicacao", icon: "📢", label: "Publicação" },
  { key: "campos", icon: "🧩", label: "Campos personalizados" },
  { key: "candidatos", icon: "👥", label: "Candidatos" },
  { key: "posicao", icon: "🏢", label: "Posição" },
];

const STEPPER_SEQUENCE: TabKey[] = ["identificacao", "horario", "dados", "requisitos", "matching", "publicacao", "campos"];
const STEPPER_LABELS: Record<string, string> = {
  identificacao: "Identificação", horario: "Horário", dados: "Dados básicos",
  requisitos: "Requisitos", matching: "Matching IA",
  publicacao: "Publicação", campos: "Campos do portal",
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
  const [areas, setAreas] = useState<AreaLookup[]>([]);
  const [depts, setDepts] = useState<DeptLookup[]>([]);
  const [vagas, setVagas] = useState<{ id: string; titulo: string; codigo: string }[]>([]);
  const [copySearch, setCopySearch] = useState("");
  const [wizardMode, setWizardMode] = useState(false);
  const loaded = useRef(false);

  // Histórico da decisão de headcount registrada na solicitação de vaga (read-only).
  // Decisão agora é feita pelo GESTOR na criação da solicitação — RH não decide mais aqui.
  const [decisaoRHFeita, setDecisaoRHFeita] = useState<{
    tipo: number; revisadoPorNome: string | null; emUtc: string | null; prazoMeses: number | null;
    expiresAtUtc: string | null;
  } | null>(null);

  const stepCompletion = useMemo(() => {
    const s = new Map<TabKey, boolean>();
    s.set("dados", !!(draft.titulo.trim() && draft.areaId && draft.status));
    s.set("requisitos", draft.requisitos.length > 0);
    s.set("matching", !!(draft.matchingModalidade || draft.matchingSenioridade || draft.matchingEscolaridade || draft.matchingHabilidades || draft.matchingCidade));
    s.set("publicacao", ["Externa", "InternaEExterna"].includes(draft.visibilidade));
    s.set("campos", true);
    return s;
  }, [draft]);

  const set = useCallback(<K extends keyof VagaDraft>(key: K, val: VagaDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: val }));
  }, []);

  const setList = useCallback(<K extends "beneficios" | "requisitos" | "etapas" | "perguntasTriagem">(
    key: K, fn: (list: VagaDraft[K]) => VagaDraft[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: fn(d[key]) }));
  }, []);

  useEffect(() => {
    if (!open) {
      loaded.current = false;
      setDecisaoRHFeita(null);
      return;
    }
    if (loaded.current) return;
    loaded.current = true;
    setTab(defaultTab ?? "identificacao");
    setCopySearch("");

    void Promise.all([
      fetchJson<unknown>(`${BASE}/api/lookup/enums`).catch(() => null),
      fetchJson<unknown>(`${BASE}/api/lookup/areas`).catch(() => []),
      fetchJson<unknown>(`${BASE}/api/lookup/departments`).catch(() => []),
      fetchJson<unknown>(`${BASE}/api/vagas`).catch(() => []),
    ]).then(([enumsRaw, areasRaw, deptsRaw, vagasRaw]) => {
      const eData: EnumData = {};
      if (enumsRaw && typeof enumsRaw === "object") {
        Object.entries(enumsRaw as Record<string, unknown>).forEach(([k, v]) => {
          eData[k] = Array.isArray(v) ? (v as { code: string; text: string }[]) : [];
        });
      }
      setEnums(eData);
      const aList = (Array.isArray(areasRaw) ? areasRaw : []).map((a: any) => ({ id: a.id, name: a.name ?? a.nome ?? "", code: a.code ?? "" }));
      setAreas(aList);
      const dList = (Array.isArray(deptsRaw) ? deptsRaw : []).map((d: any) => ({ id: d.id, name: d.name ?? d.nome ?? "", code: d.code ?? "" }));
      setDepts(dList);
      const vItems = Array.isArray(vagasRaw) ? vagasRaw : (asRec(vagasRaw)?.items as unknown[] ?? []);
      setVagas((vItems as any[]).map((v: any) => ({ id: v.id, titulo: v.titulo ?? "", codigo: v.codigo ?? "" })));

      if (vagaId) {
        void loadVagaIntoDraft(vagaId, eData);
      } else {
        const d = { ...emptyDraft(), ...prefill };
        setDraft(d);
      }
    }).catch(() => toast.error("Falha ao carregar dados do formulário."));
  }, [open, vagaId, prefill]);

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

      setDraft({
        id,
        titulo: pick(v.titulo), codigo: pick(v.codigo),
        departmentId: pick(v.departmentId), areaId: pick(v.areaId),
        areaTime: pickEnum(v.areaTime), modalidade: pickEnum(v.modalidade, "presencial"),
        status: pickEnum(v.status, "aberta"), senioridade: pickEnum(v.senioridade),
        quantidadeVagas: pickNum(v.quantidadeVagas, 1), tipoContratacao: pickEnum(v.tipoContratacao),
        matchMinimoPercentual: clamp(pickNum(v.matchMinimoPercentual, 70), 0, 100),
        descricaoInterna: pick(v.descricaoInterna), codigoInterno: pick(v.codigoInterno),
        codigoCbo: pick(v.codigoCbo),
        cargoId: pick(v.jobPositionId), cargoCode: pick(v.jobPositionCode), cargoName: pick(v.jobPositionName),
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
        motivoAbertura: pickEnum(v.motivoAbertura),
        orcamentoAprovado: pickEnum(v.orcamentoAprovado), gestorRequisitante: pick(v.gestorRequisitante),
        recrutadorResponsavel: pick(v.recrutadorResponsavel), prioridade: pickEnum(v.prioridade),
        resumoPitch: pick(v.resumoPitch),
        tagsResponsabilidades: pick(v.tagsResponsabilidadesRaw).replace(/;/g, "; "),
        tagsKeywords: pick(v.tagsKeywordsRaw).replace(/;/g, "; "),
        confidencial: pickBool(v.confidencial), aceitaPcd: pickBool(v.aceitaPcd), urgente: pickBool(v.urgente),
        generoPreferencia: pickEnum(v.generoPreferencia), vagaAfirmativa: pickBool(v.vagaAfirmativa),
        linguagemInclusiva: pickBool(v.linguagemInclusiva), publicoAfirmativo: pick(v.publicoAfirmativo),
        observacoesPcd: pick(v.observacoesPcd),
        projetoNome: pick(v.projetoNome), projetoCliente: pick(v.projetoClienteAreaImpactada),
        projetoPrazo: pick(v.projetoPrazoPrevisto), projetoDescricao: pick(v.projetoDescricao),
        regime: pickEnum(v.regime), cargaSemanalHoras: v.cargaSemanalHoras != null ? String(v.cargaSemanalHoras) : "",
        escala: pickEnum(v.escala), escalaTrabalhoRaw: pick(v.escalaTrabalhoRaw),
        horaEntrada: pick(v.horaEntrada), horaSaida: pick(v.horaSaida),
        intervalo: pick(v.intervalo),
        cep: pick(v.cep), logradouro: pick(v.logradouro), numero: pick(v.numero), bairro: pick(v.bairro),
        cidade: pick(v.cidade), uf: pick(v.uf), politicaTrabalho: pick(v.politicaTrabalho),
        observacoesDeslocamento: pick(v.observacoesDeslocamento),
        moeda: pickEnum(v.moeda), salarioMinimo: v.salarioMinimo != null ? String(v.salarioMinimo) : "",
        salarioMaximo: v.salarioMaximo != null ? String(v.salarioMaximo) : "",
        periodicidade: pickEnum(v.periodicidade), bonusTipo: pickEnum(v.bonusTipo),
        bonusPercentual: v.bonusPercentual != null ? String(v.bonusPercentual) : "",
        observacoesRemuneracao: pick(v.observacoesRemuneracao),
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

      // Histórico da decisão de headcount (read-only — decisão é feita na criação da solicitação pelo gestor)
      if (v.decisaoRH != null) {
        setDecisaoRHFeita({
          tipo: Number(v.decisaoRH),
          revisadoPorNome: v.decisaoRHRevisadoPorNome ? String(v.decisaoRHRevisadoPorNome) : null,
          emUtc: v.decisaoRHEmUtc ? String(v.decisaoRHEmUtc) : null,
          prazoMeses: v.decisaoRHPrazoMeses != null ? Number(v.decisaoRHPrazoMeses) : null,
          expiresAtUtc: v.headcountProvisorioExpiresAtUtc ? String(v.headcountProvisorioExpiresAtUtc) : null,
        });
      } else {
        setDecisaoRHFeita(null);
      }
    } catch { toast.error("Falha ao carregar dados da vaga."); }
  }

  async function copyFromVaga(id: string) {
    await loadVagaIntoDraft(id, enums);
    setDraft((d) => ({ ...d, id: undefined, codigo: "", codigoInterno: "" }));
    setCopySearch("");
    toast.success("Dados copiados. Edite e salve como nova.");
  }

  async function handleSave() {
    if (!draft.titulo.trim()) { toast.error("Informe o título da vaga."); setTab("identificacao"); return; }
    if (!draft.status) { toast.error("Selecione o status."); setTab("dados"); return; }
    if (!draft.cargoId) { toast.error("Selecione o cargo."); setTab("identificacao"); return; }

    // Ao publicar, exige campos essenciais preenchidos
    if (draft.status.toLowerCase() === "aberta") {
      const campos: string[] = [];
      if (!draft.tipoContratacao) campos.push("Tipo de Contratação");
      if (!draft.modalidade) campos.push("Modalidade");
      if (!draft.quantidadeVagas || draft.quantidadeVagas < 1) campos.push("Qtd. de Vagas");
      if (campos.length > 0) {
        toast.error(`Preencha antes de publicar: ${campos.join(", ")}`);
        setTab("dados");
        return;
      }
    }

    const mfRaw = buildMatchingFiltrosRaw(draft, enums);
    if (!draft.id && !mfRaw) { toast.error("Preencha os filtros de matching (IA) para criar a vaga."); setTab("matching"); return; }

    setSaving(true);
    const payload = buildPayload(draft, enums);
    try {
      if (draft.id) {
        await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
    } catch { toast.error("Falha ao salvar vaga."); }
    finally { setSaving(false); }
  }

  const filteredCopyVagas = useMemo(() => {
    if (!copySearch.trim()) return [];
    const q = copySearch.toLowerCase();
    return vagas.filter((v) => v.id !== draft.id && (v.titulo.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q))).slice(0, 8);
  }, [copySearch, vagas, draft.id]);

  const weightsTotal = draft.weightsCompetencia + draft.weightsExperiencia + draft.weightsFormacao + draft.weightsLocalidade;

  if (!open) return null;

  // Modo embutido (embedded): sem overlay, ocupa espaço na página
  // Modo modal (default): overlay lateral direito
  const outerCls = embedded
    ? "rounded-xl border border-border/40 bg-card shadow-sm flex flex-col overflow-hidden min-h-[70vh]"
    : "fixed inset-0 z-50 flex items-stretch justify-end bg-black/40";
  const innerCls = embedded
    ? "flex flex-col flex-1 overflow-hidden"
    : "w-full max-w-5xl bg-white shadow-2xl flex flex-col overflow-hidden";

  return (
    <div className={outerCls} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} onClick={embedded ? undefined : onClose}>
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

        {/* Histórico de decisão de headcount — quando já registrada (read-only) */}
        {decisaoRHFeita && (
          <div className="mx-4 mb-1 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 shrink-0">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              <strong>Decisão de HC:</strong>{" "}
              {decisaoRHFeita.tipo === 1
                ? `Substituição provisória${decisaoRHFeita.expiresAtUtc
                    ? ` — revisão em ${new Date(decisaoRHFeita.expiresAtUtc).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : decisaoRHFeita.prazoMeses
                      ? ` (${decisaoRHFeita.prazoMeses} meses)`
                      : ""}`
                : decisaoRHFeita.tipo === 3
                  ? "Headcount existente consumido — posição em aberto utilizada"
                  : "Aumento definitivo (encaminhado para aprovação)"}
              {decisaoRHFeita.revisadoPorNome && ` — por ${decisaoRHFeita.revisadoPorNome}`}
              {decisaoRHFeita.emUtc && ` em ${new Date(decisaoRHFeita.emUtc).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
        )}

        {/* Tab content (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* ── Identificação ───────────────────────────────────── */}
          {tab === "identificacao" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Identificação da vaga" description="Campos principais — espelham o formulário de solicitação do requisitante." />

              <Field label="Título da vaga" required span="col-span-12 md:col-span-8">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Analista de Marketing Jr" value={draft.titulo} onChange={(e) => set("titulo", e.target.value)} />
              </Field>

              <Field label="Cargo" required span="col-span-12 md:col-span-8">
                <CargoAutocomplete
                  value={draft.cargoCode || draft.cargoId}
                  defaultCargoLabel={draft.cargoCode ? { code: draft.cargoCode, name: draft.cargoName } : undefined}
                  onChange={(code) => set("cargoCode", code)}
                  onSelectId={(id) => set("cargoId", id)}
                  onSelect={(item: CargoLookup) => {
                    setDraft(d => ({
                      ...d,
                      cargoId: item.id,
                      cargoCode: item.code,
                      cargoName: item.name,
                      areaId: d.areaId || item.areaId || d.areaId,
                      senioridade: d.senioridade || (item.seniority ? item.seniority.toLowerCase() : ""),
                    }));
                  }}
                  placeholder="Digite código ou nome do cargo..."
                />
              </Field>
              <Field label="Tipo de contratação" span="col-span-12 md:col-span-4">
                <EnumSelect value={draft.tipoContratacao} onChange={(v) => set("tipoContratacao", v)} options={enumOpts(enums, "vagaTipoContratacao", "Selecionar")} />
              </Field>

              <Field label="Centro de custo" span="col-span-12 md:col-span-6">
                <CentroCustoAutocomplete
                  value={draft.centroCustoCode || draft.centroCustoId}
                  defaultLabel={draft.centroCustoCode ? { code: draft.centroCustoCode, description: draft.centroCustoDescription } : undefined}
                  onChange={(code) => set("centroCustoCode", code)}
                  onSelectId={(id) => set("centroCustoId", id)}
                  onSelectItem={(item) => {
                    setDraft((d) => ({
                      ...d,
                      centroCustoId: item.id,
                      centroCustoCode: item.code,
                      centroCustoDescription: item.description,
                    }));
                  }}
                  placeholder="Buscar centro de custo..."
                />
              </Field>
              <Field label="Unidade de lotação" span="col-span-12 md:col-span-6">
                <UnidadeLotacaoAutocomplete
                  value={draft.unidadeLotacaoCode || draft.unidadeLotacaoId}
                  defaultLabel={draft.unidadeLotacaoCode ? { code: draft.unidadeLotacaoCode, description: draft.unidadeLotacaoDescription } : undefined}
                  onChange={(code) => set("unidadeLotacaoCode", code)}
                  onSelectId={(id) => set("unidadeLotacaoId", id)}
                  onSelectItem={(item) => {
                    setDraft((d) => ({
                      ...d,
                      unidadeLotacaoId: item.id,
                      unidadeLotacaoCode: item.code,
                      unidadeLotacaoDescription: item.description,
                    }));
                  }}
                  placeholder="Buscar unidade de lotação..."
                />
              </Field>

              <Field label="Qtd. vagas" span="col-span-6 md:col-span-3">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={1} value={draft.quantidadeVagas} onChange={(e) => set("quantidadeVagas", Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Field label="Prioridade / Urgência" span="col-span-6 md:col-span-3">
                <EnumSelect value={draft.prioridade} onChange={(v) => set("prioridade", v)} options={enumOpts(enums, "vagaPrioridade", "Selecionar")} />
              </Field>

              <Field label="Justificativa / Desc. interna" span="col-span-12">
                <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Contexto da contratação, justificativa do requisitante, notas para o recrutador..." value={draft.descricaoInterna} onChange={(e) => set("descricaoInterna", e.target.value)} />
              </Field>

              <div className="col-span-12 rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Configurações rápidas</p>
                <div className="flex flex-wrap gap-6">
                  <Toggle label="Confidencial — ocultar empresa/gestor em canais públicos" checked={draft.confidencial} onChange={(v) => set("confidencial", v)} />
                  <Toggle label="Exige CNH" checked={draft.exigeCnh} onChange={(v) => set("exigeCnh", v)} />
                  <Toggle label="Disponibilidade para viagens" checked={draft.disponibilidadeViagens} onChange={(v) => set("disponibilidadeViagens", v)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Horário ──────────────────────────────────────────── */}
          {tab === "horario" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
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
                <p className="text-xs text-muted-foreground mb-2">Selecione a escala na lista ou preencha manualmente os horários por dia da semana.</p>
                <HorarioEditor value={draft.escalaTrabalhoRaw} onChange={(v) => set("escalaTrabalhoRaw", v)} />
              </div>
            </div>
          )}

          {/* ── Dados básicos ────────────────────────────────────── */}
          {tab === "dados" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">

              {/* Copiar de outra vaga */}
              <div className="col-span-12 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Copiar dados de outra vaga</label>
                <div className="relative">
                  <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Digite o título ou código de uma vaga para copiar os dados..." value={copySearch} onChange={(e) => setCopySearch(e.target.value)} />
                  {filteredCopyVagas.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCopyVagas.map((v) => (
                        <button key={v.id} type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm" onClick={() => void copyFromVaga(v.id)}>
                          <span className="font-semibold">{v.titulo}</span> <span className="text-muted-foreground">({v.codigo || "—"})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-1">O formulário será preenchido com os dados da vaga selecionada — edite e salve como nova.</p>
              </div>

              {/* Seção: Identificação */}
              <SectionHeader title="Código e posicionamento" description="Código, status e hierarquia interna da vaga." />
              <Field label="Código" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: MKT-JR-001" value={draft.codigo} onChange={(e) => set("codigo", e.target.value)} /></Field>
              <Field label="Status" required span="col-span-12 md:col-span-3"><EnumSelect value={draft.status} onChange={(v) => set("status", v)} options={enumOpts(enums, "vagaStatus")} /></Field>
              <Field label="Nome interno (engessado)" span="col-span-12 md:col-span-5">
                <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: Analista de TI Sênior" value={draft.nomeEngessado} onChange={(e) => set("nomeEngessado", e.target.value)} maxLength={200} />
                <p className="text-xs text-muted-foreground mt-1">Nome fixo para referência interna de cargo.</p>
              </Field>
              <Field label="Departamento" span="col-span-12 md:col-span-4"><EnumSelect value={draft.departmentId} onChange={(v) => set("departmentId", v)} options={depts.map((d) => ({ code: d.id, text: d.name }))} placeholder="Selecionar departamento" /></Field>

              {/* Seção: Configurações */}
              <SectionHeader title="Configurações da vaga" />
              <Field label="Modalidade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.modalidade} onChange={(v) => set("modalidade", v)} options={enumOpts(enums, "vagaModalidade")} /></Field>
              <Field label="Senioridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.senioridade} onChange={(v) => set("senioridade", v)} options={enumOpts(enums, "vagaSenioridade", "Selecionar")} /></Field>
              <Field label="Motivo de abertura" span="col-span-6 md:col-span-3"><EnumSelect value={draft.motivoAbertura} onChange={(v) => set("motivoAbertura", v)} options={enumOpts(enums, "vagaMotivoAbertura", "Selecionar")} /></Field>
              <Field label="Orçamento aprovado" span="col-span-6 md:col-span-3"><EnumSelect value={draft.orcamentoAprovado} onChange={(v) => set("orcamentoAprovado", v)} options={enumOpts(enums, "vagaOrcamentoAprovado", "Selecionar")} /></Field>
              <Field label="Área/Time" span="col-span-6 md:col-span-3"><EnumSelect value={draft.areaTime} onChange={(v) => set("areaTime", v)} options={enumOpts(enums, "vagaAreaTime", "Selecionar")} /></Field>

              {/* Seção: Responsáveis */}
              <SectionHeader title="Responsáveis" />
              <Field label="Gestor requisitante" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Nome do gestor" maxLength={120} value={draft.gestorRequisitante} onChange={(e) => set("gestorRequisitante", e.target.value)} /></Field>
              <Field label="Recrutador responsável" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Nome do recrutador" maxLength={120} value={draft.recrutadorResponsavel} onChange={(e) => set("recrutadorResponsavel", e.target.value)} /></Field>
              <Field label="Match mínimo (IA)" span="col-span-12 md:col-span-4">
                <div className="flex items-center gap-2">
                  <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.matchMinimoPercentual} onChange={(e) => set("matchMinimoPercentual", clamp(Number(e.target.value) || 0, 0, 100))} />
                  <span className="text-sm text-muted-foreground font-medium shrink-0">%</span>
                </div>
              </Field>

              {/* Seção: Referências */}
              <SectionHeader title="Referências / Códigos" />
              <Field label="Categoria salarial" span="col-span-12 md:col-span-6">
                <CategoriaSalarialAutocomplete
                  value={draft.categoriaSalarialCode || draft.categoriaSalarialId}
                  defaultLabel={draft.categoriaSalarialCode ? { code: draft.categoriaSalarialCode, description: draft.categoriaSalarialDescription } : undefined}
                  onChange={(code) => set("categoriaSalarialCode", code)}
                  onSelectId={(id) => set("categoriaSalarialId", id)}
                  onSelectItem={(item) => {
                    setDraft((d) => ({
                      ...d,
                      categoriaSalarialId: item.id,
                      categoriaSalarialCode: item.code,
                      categoriaSalarialDescription: item.description,
                    }));
                  }}
                  placeholder="Buscar categoria salarial..."
                />
              </Field>
              <Field label="Código interno" span="col-span-6 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="VAG-2025-0012" maxLength={40} value={draft.codigoInterno} onChange={(e) => set("codigoInterno", e.target.value)} /></Field>
              <Field label="Código CBO" span="col-span-6 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0000-00" value={draft.codigoCbo} onChange={(e) => set("codigoCbo", e.target.value)} /></Field>

              {/* Seção: Descrição e conteúdo */}
              <SectionHeader title="Descrição e conteúdo" />
              <Field label="Resumo / pitch da vaga" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Descreva brevemente o propósito da vaga e o diferencial para atrair candidatos." value={draft.resumoPitch} onChange={(e) => set("resumoPitch", e.target.value)} /></Field>
              <Field label="Responsabilidades (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: triagem de currículos; entrevistas; alinhamento com gestores" value={draft.tagsResponsabilidades} onChange={(e) => set("tagsResponsabilidades", e.target.value)} /></Field>
              <Field label="Palavras-chave (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3} placeholder="Ex.: recrutamento; ATS; entrevistas por competência" value={draft.tagsKeywords} onChange={(e) => set("tagsKeywords", e.target.value)} /></Field>

              {/* Seção: Flags */}
              <div className="col-span-12 rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Configurações rápidas</p>
                <div className="flex flex-wrap gap-6">
                  <Toggle label="Aceita PCD — vaga inclusiva" checked={draft.aceitaPcd} onChange={(v) => set("aceitaPcd", v)} />
                  <Toggle label="Urgente — SLA curto" checked={draft.urgente} onChange={(v) => set("urgente", v)} />
                </div>
              </div>

            </div>
          )}

          {/* ── Diversidade ──────────────────────────────────────── */}
          {tab === "diversidade" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Inclusão e diversidade" description="Configure preferências de gênero, ação afirmativa e acessibilidade." />
              <Field label="Preferência de gênero" span="col-span-12 md:col-span-4"><EnumSelect value={draft.generoPreferencia} onChange={(v) => set("generoPreferencia", v)} options={enumOpts(enums, "vagaGeneroPreferencia", "Sem preferência")} /></Field>
              <Field label="Público afirmativo" span="col-span-12 md:col-span-8"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: PCD; Mulheres; Pessoas Negras" maxLength={120} value={draft.publicoAfirmativo} onChange={(e) => set("publicoAfirmativo", e.target.value)} /></Field>
              <Field label="Observações PCD" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: acomodações necessárias, adaptações de ambiente ou processo" value={draft.observacoesPcd} onChange={(e) => set("observacoesPcd", e.target.value)} /></Field>
              <div className="col-span-12 rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Opções de inclusão</p>
                <div className="flex flex-wrap gap-6">
                  <Toggle label="Vaga afirmativa" checked={draft.vagaAfirmativa} onChange={(v) => set("vagaAfirmativa", v)} />
                  <Toggle label="Usar linguagem inclusiva na descrição" checked={draft.linguagemInclusiva} onChange={(v) => set("linguagemInclusiva", v)} />
                </div>
              </div>
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
              <Field label="CEP" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="00000-000" value={draft.cep} onChange={(e) => set("cep", e.target.value)} /></Field>
              <Field label="Logradouro" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Rua / Av." value={draft.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></Field>
              <Field label="Número" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="123" value={draft.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
              <Field label="Bairro" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Centro" value={draft.bairro} onChange={(e) => set("bairro", e.target.value)} /></Field>
              <Field label="Cidade" span="col-span-12 md:col-span-4"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: São Paulo" value={draft.cidade} onChange={(e) => set("cidade", e.target.value)} /></Field>
              <Field label="UF" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="SP" maxLength={2} value={draft.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></Field>
              <Field label="Política de trabalho" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: 2 dias presencial, 3 remoto" value={draft.politicaTrabalho} onChange={(e) => set("politicaTrabalho", e.target.value)} /></Field>
              <Field label="Obs. deslocamento / viagens" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: viagens 1x/mês, nacional" value={draft.observacoesDeslocamento} onChange={(e) => set("observacoesDeslocamento", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Remuneração ──────────────────────────────────────── */}
          {tab === "remuneracao" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <SectionHeader title="Salário" />
              <Field label="Moeda" span="col-span-6 md:col-span-2"><EnumSelect value={draft.moeda} onChange={(v) => set("moeda", v)} options={enumOpts(enums, "vagaMoeda", "Selecionar")} /></Field>
              <Field label="Salário mínimo" span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0,00" value={draft.salarioMinimo} onChange={(e) => set("salarioMinimo", e.target.value)} /></Field>
              <Field label="Salário máximo" span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0,00" value={draft.salarioMaximo} onChange={(e) => set("salarioMaximo", e.target.value)} /></Field>
              <Field label="Periodicidade" span="col-span-6 md:col-span-4"><EnumSelect value={draft.periodicidade} onChange={(v) => set("periodicidade", v)} options={enumOpts(enums, "vagaRemuneracaoPeriodicidade", "Selecionar")} /></Field>
              <Field label="Tipo de bônus / extra" span="col-span-12 md:col-span-4"><EnumSelect value={draft.bonusTipo} onChange={(v) => set("bonusTipo", v)} options={enumOpts(enums, "vagaBonusTipo", "Selecionar")} /></Field>
              <Field label="% bônus" span="col-span-6 md:col-span-2"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="0%" value={draft.bonusPercentual} onChange={(e) => set("bonusPercentual", e.target.value)} /></Field>
              <Field label="Observações de remuneração" span="col-span-12 md:col-span-6"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: faixa depende de senioridade" value={draft.observacoesRemuneracao} onChange={(e) => set("observacoesRemuneracao", e.target.value)} /></Field>
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
              <div className="col-span-12 md:col-span-5 flex items-end gap-3 pb-1">
                <Toggle label="Requer CNH" checked={draft.matchingRequerCnh} onChange={(v) => set("matchingRequerCnh", v)} />
                {draft.matchingRequerCnh && (
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-auto" value={draft.matchingCnhCategoria} onChange={(e) => set("matchingCnhCategoria", e.target.value)}>
                    {CNH_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <Field label="Habilidades desejadas" span="col-span-12"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Ex.: .NET, SQL, APIs REST (separadas por vírgula)" value={draft.matchingHabilidades} onChange={(e) => set("matchingHabilidades", e.target.value)} /></Field>
              <Field label="Observações adicionais (opcional)" span="col-span-12"><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} placeholder="Outros critérios em texto livre" value={draft.matchingObs} onChange={(e) => set("matchingObs", e.target.value)} /></Field>

              <SectionHeader title="Pesos do matching" description="Distribua o peso entre as dimensões — total recomendado: 100." />
              <Field label={`Competência (${draft.weightsCompetencia})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsCompetencia} onChange={(e) => set("weightsCompetencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Experiência (${draft.weightsExperiencia})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsExperiencia} onChange={(e) => set("weightsExperiencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Formação (${draft.weightsFormacao})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsFormacao} onChange={(e) => set("weightsFormacao", Number(e.target.value) || 0)} /></Field>
              <Field label={`Localidade (${draft.weightsLocalidade})`} span="col-span-6 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} max={100} value={draft.weightsLocalidade} onChange={(e) => set("weightsLocalidade", Number(e.target.value) || 0)} /></Field>
              <div className="col-span-12"><span className={`badge-soft ${weightsTotal === 100 ? "" : "text-red-600"}`}>Total: {weightsTotal}%{weightsTotal !== 100 && " (recomendado: 100%)"}</span></div>
            </div>
          )}

          {/* ── Processo seletivo ────────────────────────────────── */}
          {tab === "processo" && (
            <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-3">
              <div className="col-span-12 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Etapas do processo seletivo</p>
                  <p className="text-xs text-muted-foreground">Defina as etapas com responsável, modo e prazo (SLA).</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setList("etapas", (l) => [...l, { nome: "", responsavel: "", modo: "", slaDias: "3", descricao: "" }])}>+ Adicionar etapa</Button>
              </div>
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
              <Field label="Visibilidade" span="col-span-12 md:col-span-3"><EnumSelect value={draft.visibilidade} onChange={(v) => set("visibilidade", v)} options={enumOpts(enums, "vagaPublicacaoVisibilidade", "Selecionar")} /></Field>
              <Field label="Data de início" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="date" value={draft.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} /></Field>
              <Field label="Data de encerramento" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="date" value={draft.dataEncerramento} onChange={(e) => set("dataEncerramento", e.target.value)} /></Field>
              <Field label="Meta SLA (dias)" span="col-span-12 md:col-span-3"><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="number" min={0} placeholder="Ex.: 30" value={draft.slaDiasMetaFechamento} onChange={(e) => set("slaDiasMetaFechamento", e.target.value)} /></Field>

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
                        {typeof window !== "undefined" ? `${window.location.origin}/app/PortalVagas?tenantId=${encodeURIComponent(getTenantId() ?? "")}&vagaId=${encodeURIComponent(draft.id)}` : `/app/PortalVagas?vagaId=${draft.id}`}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={() => {
                      const tenantId = getTenantId() ?? "";
                      const url = `${window.location.origin}/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}&vagaId=${encodeURIComponent(draft.id ?? "")}`;
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
    </div>
  );
}
