"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

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
  motivoAbertura: string; orcamentoAprovado: string; gestorRequisitante: string;
  recrutadorResponsavel: string; prioridade: string; resumoPitch: string;
  tagsResponsabilidades: string; tagsKeywords: string;
  confidencial: boolean; aceitaPcd: boolean; urgente: boolean;
  generoPreferencia: string; vagaAfirmativa: boolean; linguagemInclusiva: boolean;
  publicoAfirmativo: string; observacoesPcd: string;
  projetoNome: string; projetoCliente: string; projetoPrazo: string; projetoDescricao: string;
  regime: string; cargaSemanalHoras: string; escala: string;
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
    motivoAbertura: "", orcamentoAprovado: "", gestorRequisitante: "",
    recrutadorResponsavel: "", prioridade: "", resumoPitch: "",
    tagsResponsabilidades: "", tagsKeywords: "",
    confidencial: false, aceitaPcd: false, urgente: false,
    generoPreferencia: "", vagaAfirmativa: false, linguagemInclusiva: false,
    publicoAfirmativo: "", observacoesPcd: "",
    projetoNome: "", projetoCliente: "", projetoPrazo: "", projetoDescricao: "",
    regime: "", cargaSemanalHoras: "", escala: "",
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
    <div className={span ?? "col-span-12 md:col-span-4"}>
      <label className="form-label small text-muted-foreground block mb-1">{label}{required && " *"}</label>
      {children}
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
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {hasPlaceholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
    </select>
  );
}

/* ── Tab definitions ─────────────────────────────────────────────────── */

type TabKey = "dados" | "diversidade" | "projeto" | "local" | "remuneracao" | "requisitos" | "matching" | "processo" | "publicacao" | "candidatos";

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "dados", icon: "📋", label: "Dados básicos" },
  { key: "diversidade", icon: "💜", label: "Diversidade" },
  { key: "projeto", icon: "📁", label: "Projeto" },
  { key: "local", icon: "📍", label: "Local e jornada" },
  { key: "remuneracao", icon: "💰", label: "Remuneração" },
  { key: "requisitos", icon: "✅", label: "Requisitos" },
  { key: "matching", icon: "✨", label: "Filtros matching (IA)" },
  { key: "processo", icon: "🔀", label: "Processo seletivo" },
  { key: "publicacao", icon: "📢", label: "Publicação" },
  { key: "candidatos", icon: "👥", label: "Candidatos" },
];

/* ── Main component ──────────────────────────────────────────────────── */

export type VagaFormProps = {
  open: boolean;
  editId?: string | null;
  prefill?: Partial<VagaDraft>;
  onClose: () => void;
  onSaved: () => void;
};

export default function VagaFormModal({ open, editId: vagaId, prefill, onClose, onSaved }: VagaFormProps) {
  const [tab, setTab] = useState<TabKey>("dados");
  const [draft, setDraft] = useState<VagaDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [enums, setEnums] = useState<EnumData>({});
  const [areas, setAreas] = useState<AreaLookup[]>([]);
  const [depts, setDepts] = useState<DeptLookup[]>([]);
  const [vagas, setVagas] = useState<{ id: string; titulo: string; codigo: string }[]>([]);
  const [copySearch, setCopySearch] = useState("");
  const loaded = useRef(false);

  const set = useCallback(<K extends keyof VagaDraft>(key: K, val: VagaDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: val }));
  }, []);

  const setList = useCallback(<K extends "beneficios" | "requisitos" | "etapas" | "perguntasTriagem">(
    key: K, fn: (list: VagaDraft[K]) => VagaDraft[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: fn(d[key]) }));
  }, []);

  useEffect(() => {
    if (!open) { loaded.current = false; return; }
    if (loaded.current) return;
    loaded.current = true;
    setTab("dados");
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
        areaTime: pick(v.areaTime), modalidade: pick(v.modalidade, "presencial"),
        status: pick(v.status, "aberta"), senioridade: pick(v.senioridade),
        quantidadeVagas: pickNum(v.quantidadeVagas, 1), tipoContratacao: pick(v.tipoContratacao),
        matchMinimoPercentual: clamp(pickNum(v.matchMinimoPercentual, 70), 0, 100),
        descricaoInterna: pick(v.descricaoInterna), codigoInterno: pick(v.codigoInterno),
        codigoCbo: pick(v.codigoCbo), motivoAbertura: pick(v.motivoAbertura),
        orcamentoAprovado: pick(v.orcamentoAprovado), gestorRequisitante: pick(v.gestorRequisitante),
        recrutadorResponsavel: pick(v.recrutadorResponsavel), prioridade: pick(v.prioridade),
        resumoPitch: pick(v.resumoPitch),
        tagsResponsabilidades: pick(v.tagsResponsabilidadesRaw).replace(/;/g, "; "),
        tagsKeywords: pick(v.tagsKeywordsRaw).replace(/;/g, "; "),
        confidencial: pickBool(v.confidencial), aceitaPcd: pickBool(v.aceitaPcd), urgente: pickBool(v.urgente),
        generoPreferencia: pick(v.generoPreferencia), vagaAfirmativa: pickBool(v.vagaAfirmativa),
        linguagemInclusiva: pickBool(v.linguagemInclusiva), publicoAfirmativo: pick(v.publicoAfirmativo),
        observacoesPcd: pick(v.observacoesPcd),
        projetoNome: pick(v.projetoNome), projetoCliente: pick(v.projetoClienteAreaImpactada),
        projetoPrazo: pick(v.projetoPrazoPrevisto), projetoDescricao: pick(v.projetoDescricao),
        regime: pick(v.regime), cargaSemanalHoras: v.cargaSemanalHoras != null ? String(v.cargaSemanalHoras) : "",
        escala: pick(v.escala), horaEntrada: pick(v.horaEntrada), horaSaida: pick(v.horaSaida),
        intervalo: pick(v.intervalo),
        cep: pick(v.cep), logradouro: pick(v.logradouro), numero: pick(v.numero), bairro: pick(v.bairro),
        cidade: pick(v.cidade), uf: pick(v.uf), politicaTrabalho: pick(v.politicaTrabalho),
        observacoesDeslocamento: pick(v.observacoesDeslocamento),
        moeda: pick(v.moeda), salarioMinimo: v.salarioMinimo != null ? String(v.salarioMinimo) : "",
        salarioMaximo: v.salarioMaximo != null ? String(v.salarioMaximo) : "",
        periodicidade: pick(v.periodicidade), bonusTipo: pick(v.bonusTipo),
        bonusPercentual: v.bonusPercentual != null ? String(v.bonusPercentual) : "",
        observacoesRemuneracao: pick(v.observacoesRemuneracao),
        beneficios: benefRaw.map((b: any) => ({ tipo: pick(b.tipo), valor: b.valor != null ? String(b.valor) : "", recorrencia: pick(b.recorrencia, "mensal"), obrigatorio: pickBool(b.obrigatorio), obs: pick(b.observacoes) })),
        escolaridade: pick(v.escolaridade), formacaoArea: pick(v.formacaoArea),
        experienciaMinimaAnos: v.experienciaMinimaAnos != null ? String(v.experienciaMinimaAnos) : "",
        tagsStack: pick(v.tagsStackRaw).replace(/;/g, "; "),
        tagsIdiomas: pick(v.tagsIdiomasRaw).replace(/;/g, "; "),
        diferenciais: pick(v.diferenciais),
        requisitos: reqRaw.map((r: any) => ({ nome: pick(r.nome), categoria: pick(r.categoria, "competencia"), peso: pick(r.peso, "1"), obrigatorio: pickBool(r.obrigatorio), anosMinimos: r.anosMinimos != null ? String(r.anosMinimos) : "", nivel: pick(r.nivel), avaliacao: pick(r.avaliacao), sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos.join(", ") : "", obs: pick(r.observacoes) })),
        matchingModalidade: mf.modalidade, matchingSenioridade: mf.senioridade,
        matchingEscolaridade: mf.escolaridade, matchingFormacaoArea: mf.formacaoArea,
        matchingCidade: mf.cidade, matchingUF: mf.uf, matchingExp: mf.tempoExp,
        matchingSexo: mf.sexo, matchingPcd: mf.pcd, matchingIdadeMin: mf.idadeMin,
        matchingIdadeMax: mf.idadeMax, matchingRequerCnh: mf.requerCnh,
        matchingCnhCategoria: mf.cnhCategoria, matchingHabilidades: mf.habilidades, matchingObs: mf.observacoes,
        weightsCompetencia: pickNum(w?.competencia, 40), weightsExperiencia: pickNum(w?.experiencia, 30),
        weightsFormacao: pickNum(w?.formacao, 15), weightsLocalidade: pickNum(w?.localidade, 15),
        etapas: etaRaw.map((e: any) => ({ nome: pick(e.nome), responsavel: pick(e.responsavel), modo: pick(e.modo), slaDias: e.slaDias != null ? String(e.slaDias) : "", descricao: pick(e.descricaoInstrucoes) })),
        perguntasTriagem: pergRaw.map((p: any) => ({ texto: pick(p.texto), tipo: pick(p.tipo), peso: pick(p.peso, "1"), obrigatoria: pickBool(p.obrigatoria), knockout: pickBool(p.knockout), opcoes: pick(p.opcoesRaw) })),
        observacoesProcesso: pick(v.observacoesProcesso),
        visibilidade: pick(v.visibilidade), dataInicio: pick(v.dataInicio), dataEncerramento: pick(v.dataEncerramento),
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
    } catch { toast.error("Falha ao carregar dados da vaga."); }
  }

  async function copyFromVaga(id: string) {
    await loadVagaIntoDraft(id, enums);
    setDraft((d) => ({ ...d, id: undefined, codigo: "", codigoInterno: "" }));
    setCopySearch("");
    toast.success("Dados copiados. Edite e salve como nova.");
  }

  async function handleSave() {
    if (!draft.titulo.trim()) { toast.error("Informe o título da vaga."); setTab("dados"); return; }
    if (!draft.areaId) { toast.error("Selecione a área da vaga."); setTab("dados"); return; }
    if (!draft.status) { toast.error("Selecione o status."); setTab("dados"); return; }
    const mfRaw = buildMatchingFiltrosRaw(draft, enums);
    if (!draft.id && !mfRaw) { toast.error("Preencha os filtros de matching (IA) para criar a vaga."); setTab("matching"); return; }

    setSaving(true);
    const payload = buildPayload(draft, enums);
    try {
      if (draft.id) {
        await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(draft.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Vaga atualizada.");
      } else {
        await fetchJson(`${BASE}/api/vagas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Vaga criada.");
      }
      onSaved();
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

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-4 border-b border-black/10 shrink-0">
          <div>
            <h5 className="fw-bold text-lg">{draft.id ? "Editar vaga" : "Nova vaga"}</h5>
            <div className="text-muted-foreground text-sm">Dados principais da vaga. Requisitos e pesos ficam nos detalhes.</div>
          </div>
          <button className="btn-ghost px-3 py-2" type="button" onClick={onClose}>Fechar</button>
        </div>

        {/* Tab pills */}
        <div className="px-4 pt-3 pb-2 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 min-w-max" style={{ background: "rgba(173,200,220,.16)", padding: ".35rem", borderRadius: "999px", border: "1px solid rgba(16,82,144,.14)" }}>
            {TABS.map((t) => (
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
          {/* ── Dados básicos ────────────────────────────────────── */}
          {tab === "dados" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <div className="col-span-12">
                <label className="form-label small text-muted-foreground block mb-1">Copiar de outra vaga</label>
                <div className="relative">
                  <input className="form-control" placeholder="Buscar vaga para copiar dados..." value={copySearch} onChange={(e) => setCopySearch(e.target.value)} />
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
                <div className="text-muted-foreground text-xs mt-1">Selecione uma vaga para preencher o formulário com seus dados (edite e salve como nova).</div>
              </div>
              <div className="col-span-12 mt-1"><div className="fw-semibold">Identificação e contexto</div></div>
              <Field label="Código" span="col-span-12 md:col-span-4"><input className="form-control" placeholder="Ex.: MKT-JR-001" value={draft.codigo} onChange={(e) => set("codigo", e.target.value)} /></Field>
              <Field label="Título" required span="col-span-12 md:col-span-8"><input className="form-control" placeholder="Ex.: Analista de Marketing Jr" value={draft.titulo} onChange={(e) => set("titulo", e.target.value)} /></Field>
              <Field label="Nome Interno (Engessado)" span="col-span-12 md:col-span-8">
                <input
                  className="form-control"
                  placeholder="Ex.: Analista de TI Sênior"
                  value={draft.nomeEngessado}
                  onChange={(e) => set("nomeEngessado", e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">Nome fixo para uso interno (referência de cargo).</p>
              </Field>
              <Field label="Departamento"><EnumSelect value={draft.departmentId} onChange={(v) => set("departmentId", v)} options={depts.map((d) => ({ code: d.id, text: d.name }))} placeholder="Selecionar departamento" /></Field>
              <Field label="Área/Time"><EnumSelect value={draft.areaTime} onChange={(v) => set("areaTime", v)} options={enumOpts(enums, "vagaAreaTime", "Selecionar")} /></Field>
              <Field label="Área" required><EnumSelect value={draft.areaId} onChange={(v) => set("areaId", v)} options={areas.map((a) => ({ code: a.id, text: a.name }))} placeholder="Selecionar área" /></Field>
              <Field label="Modalidade"><EnumSelect value={draft.modalidade} onChange={(v) => set("modalidade", v)} options={enumOpts(enums, "vagaModalidade")} /></Field>
              <Field label="Status" required><EnumSelect value={draft.status} onChange={(v) => set("status", v)} options={enumOpts(enums, "vagaStatus")} /></Field>
              <Field label="Senioridade"><EnumSelect value={draft.senioridade} onChange={(v) => set("senioridade", v)} options={enumOpts(enums, "vagaSenioridade", "Selecionar")} /></Field>
              <Field label="Qtd. vagas" span="col-span-6 md:col-span-3"><input className="form-control" type="number" min={1} value={draft.quantidadeVagas} onChange={(e) => set("quantidadeVagas", Math.max(1, Number(e.target.value) || 1))} /></Field>
              <Field label="Tipo contratação" span="col-span-6 md:col-span-3"><EnumSelect value={draft.tipoContratacao} onChange={(v) => set("tipoContratacao", v)} options={enumOpts(enums, "vagaTipoContratacao", "Selecionar")} /></Field>
              <Field label="Match mínimo" span="col-span-12 md:col-span-3">
                <div className="flex items-center gap-1"><input className="form-control" type="number" min={0} max={100} value={draft.matchMinimoPercentual} onChange={(e) => set("matchMinimoPercentual", clamp(Number(e.target.value) || 0, 0, 100))} /><span className="text-sm text-muted-foreground">%</span></div>
              </Field>
              <Field label="Descrição interna" span="col-span-12"><textarea className="form-control" rows={3} placeholder="Resumo interno da vaga, responsabilidades, etc." value={draft.descricaoInterna} onChange={(e) => set("descricaoInterna", e.target.value)} /></Field>
              <Field label="Código interno" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="EX.: VAG-2025-0012" maxLength={40} value={draft.codigoInterno} onChange={(e) => set("codigoInterno", e.target.value)} /></Field>
              <Field label="Código CBO" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="0000-00" value={draft.codigoCbo} onChange={(e) => set("codigoCbo", e.target.value)} /></Field>
              <Field label="Motivo abertura" span="col-span-6 md:col-span-3"><EnumSelect value={draft.motivoAbertura} onChange={(v) => set("motivoAbertura", v)} options={enumOpts(enums, "vagaMotivoAbertura", "Selecionar")} /></Field>
              <Field label="Orçamento aprovado" span="col-span-6 md:col-span-3"><EnumSelect value={draft.orcamentoAprovado} onChange={(v) => set("orcamentoAprovado", v)} options={enumOpts(enums, "vagaOrcamentoAprovado", "Selecionar")} /></Field>
              <Field label="Gestor requisitante"><input className="form-control" placeholder="Buscar gestor..." maxLength={120} value={draft.gestorRequisitante} onChange={(e) => set("gestorRequisitante", e.target.value)} /></Field>
              <Field label="Recrutador responsável"><input className="form-control" placeholder="Buscar recrutador..." maxLength={120} value={draft.recrutadorResponsavel} onChange={(e) => set("recrutadorResponsavel", e.target.value)} /></Field>
              <Field label="Prioridade"><EnumSelect value={draft.prioridade} onChange={(v) => set("prioridade", v)} options={enumOpts(enums, "vagaPrioridade", "Selecionar")} /></Field>
              <Field label="Resumo / pitch da vaga" span="col-span-12"><textarea className="form-control" rows={2} placeholder="Explique rapidamente o propósito da vaga e o diferencial." value={draft.resumoPitch} onChange={(e) => set("resumoPitch", e.target.value)} /></Field>
              <Field label="Responsabilidades (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="form-control" rows={2} placeholder="Ex.: triagem de currículos; entrevistas; alinhamento com gestores" value={draft.tagsResponsabilidades} onChange={(e) => set("tagsResponsabilidades", e.target.value)} /></Field>
              <Field label="Palavras-chave (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="form-control" rows={2} placeholder="Ex.: recrutamento; ATS; entrevistas por competência" value={draft.tagsKeywords} onChange={(e) => set("tagsKeywords", e.target.value)} /></Field>
              <div className="col-span-12 flex flex-wrap gap-6 mt-1">
                <Field label="Confidencial?" span=""><Toggle label="Ocultar empresa/gestor em canais públicos" checked={draft.confidencial} onChange={(v) => set("confidencial", v)} /></Field>
                <Field label="Aceita PCD?" span=""><Toggle label="Vaga inclusiva" checked={draft.aceitaPcd} onChange={(v) => set("aceitaPcd", v)} /></Field>
                <Field label="Vaga urgente?" span=""><Toggle label="SLA curto" checked={draft.urgente} onChange={(v) => set("urgente", v)} /></Field>
              </div>
            </div>
          )}

          {/* ── Diversidade ──────────────────────────────────────── */}
          {tab === "diversidade" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Preferência de gênero"><EnumSelect value={draft.generoPreferencia} onChange={(v) => set("generoPreferencia", v)} options={enumOpts(enums, "vagaGeneroPreferencia", "Selecionar preferência")} /></Field>
              <Field label="Vaga afirmativa?" span="col-span-6 md:col-span-4"><Toggle label="Sim" checked={draft.vagaAfirmativa} onChange={(v) => set("vagaAfirmativa", v)} /></Field>
              <Field label="Linguagem inclusiva" span="col-span-6 md:col-span-4"><Toggle label="Revisar descrição" checked={draft.linguagemInclusiva} onChange={(v) => set("linguagemInclusiva", v)} /></Field>
              <Field label="Público afirmativo (opcional)" span="col-span-12 md:col-span-6"><input className="form-control" placeholder="Ex.: PCD; Mulheres; Pessoas Negras" maxLength={120} value={draft.publicoAfirmativo} onChange={(e) => set("publicoAfirmativo", e.target.value)} /></Field>
              <Field label="Observações PCD" span="col-span-12 md:col-span-6"><input className="form-control" placeholder="Ex.: acomodações ou ajustes necessários" value={draft.observacoesPcd} onChange={(e) => set("observacoesPcd", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Projeto ──────────────────────────────────────────── */}
          {tab === "projeto" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Nome do projeto"><input className="form-control" placeholder="Ex.: Migração RH" value={draft.projetoNome} onChange={(e) => set("projetoNome", e.target.value)} /></Field>
              <Field label="Cliente/Área impactada"><input className="form-control" placeholder="Ex.: Operações" value={draft.projetoCliente} onChange={(e) => set("projetoCliente", e.target.value)} /></Field>
              <Field label="Prazo previsto"><input className="form-control" placeholder="Ex.: Q3/2025" value={draft.projetoPrazo} onChange={(e) => set("projetoPrazo", e.target.value)} /></Field>
              <Field label="Descrição do projeto" span="col-span-12"><textarea className="form-control" rows={2} placeholder="Escopo e objetivos do projeto." value={draft.projetoDescricao} onChange={(e) => set("projetoDescricao", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Local e jornada ──────────────────────────────────── */}
          {tab === "local" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Regime"><EnumSelect value={draft.regime} onChange={(v) => set("regime", v)} options={enumOpts(enums, "vagaRegimeJornada", "Selecionar")} /></Field>
              <Field label="Carga semanal (h)"><input className="form-control" placeholder="40" value={draft.cargaSemanalHoras} onChange={(e) => set("cargaSemanalHoras", e.target.value)} /></Field>
              <Field label="Escala"><EnumSelect value={draft.escala} onChange={(v) => set("escala", v)} options={enumOpts(enums, "vagaEscalaTrabalho", "Selecionar")} /></Field>
              <Field label="Entrada"><input className="form-control" type="time" value={draft.horaEntrada} onChange={(e) => set("horaEntrada", e.target.value)} /></Field>
              <Field label="Saída"><input className="form-control" type="time" value={draft.horaSaida} onChange={(e) => set("horaSaida", e.target.value)} /></Field>
              <Field label="Intervalo"><input className="form-control" placeholder="01:00" value={draft.intervalo} onChange={(e) => set("intervalo", e.target.value)} /></Field>
              <Field label="CEP" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="00000-000" value={draft.cep} onChange={(e) => set("cep", e.target.value)} /></Field>
              <Field label="Logradouro" span="col-span-12 md:col-span-5"><input className="form-control" placeholder="Rua / Av." value={draft.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></Field>
              <Field label="Número" span="col-span-6 md:col-span-2"><input className="form-control" placeholder="123" value={draft.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
              <Field label="Bairro" span="col-span-6 md:col-span-2"><input className="form-control" placeholder="Centro" value={draft.bairro} onChange={(e) => set("bairro", e.target.value)} /></Field>
              <Field label="Cidade"><input className="form-control" placeholder="Ex.: Embu das Artes" value={draft.cidade} onChange={(e) => set("cidade", e.target.value)} /></Field>
              <Field label="UF" span="col-span-4 md:col-span-2"><input className="form-control" placeholder="SP" maxLength={2} value={draft.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></Field>
              <Field label="Política de trabalho" span="col-span-12 md:col-span-6"><input className="form-control" placeholder="Ex.: 2 dias presencial, 3 remoto" value={draft.politicaTrabalho} onChange={(e) => set("politicaTrabalho", e.target.value)} /></Field>
              <Field label="Obs. deslocamento" span="col-span-12 md:col-span-6"><input className="form-control" placeholder="Ex.: viagens 1x/mês" value={draft.observacoesDeslocamento} onChange={(e) => set("observacoesDeslocamento", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Remuneração ──────────────────────────────────────── */}
          {tab === "remuneracao" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Moeda" span="col-span-6 md:col-span-3"><EnumSelect value={draft.moeda} onChange={(v) => set("moeda", v)} options={enumOpts(enums, "vagaMoeda", "Selecionar")} /></Field>
              <Field label="Salário mínimo" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="0,00" value={draft.salarioMinimo} onChange={(e) => set("salarioMinimo", e.target.value)} /></Field>
              <Field label="Salário máximo" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="0,00" value={draft.salarioMaximo} onChange={(e) => set("salarioMaximo", e.target.value)} /></Field>
              <Field label="Periodicidade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.periodicidade} onChange={(v) => set("periodicidade", v)} options={enumOpts(enums, "vagaRemuneracaoPeriodicidade", "Selecionar")} /></Field>
              <Field label="Bônus/Comissão"><EnumSelect value={draft.bonusTipo} onChange={(v) => set("bonusTipo", v)} options={enumOpts(enums, "vagaBonusTipo", "Selecionar")} /></Field>
              <Field label="% bônus/comissão"><input className="form-control" placeholder="0,00%" value={draft.bonusPercentual} onChange={(e) => set("bonusPercentual", e.target.value)} /></Field>
              <Field label="Obs. remuneração"><input className="form-control" placeholder="Ex.: faixa depende de senioridade" value={draft.observacoesRemuneracao} onChange={(e) => set("observacoesRemuneracao", e.target.value)} /></Field>
              <div className="col-span-12 flex items-center justify-between gap-2 mt-2">
                <div><div className="fw-semibold">Benefícios</div><div className="text-muted-foreground text-xs">Adicione benefícios com tipo, valor e detalhes.</div></div>
                <button className="btn-ghost text-sm" type="button" onClick={() => setList("beneficios", (l) => [...l, { tipo: "", valor: "", recorrencia: "mensal", obrigatorio: true, obs: "" }])}>+ Adicionar</button>
              </div>
              {draft.beneficios.map((b, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Benefício #{i + 1}</span><button type="button" className="btn-ghost text-red-600 text-xs" onClick={() => setList("beneficios", (l) => l.filter((_, j) => j !== i))}>Remover</button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Tipo" span="col-span-12 md:col-span-4"><EnumSelect value={b.tipo} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, tipo: v } : x))} options={enumOpts(enums, "vagaBeneficioTipo", "Selecionar")} /></Field>
                    <Field label="Valor" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="R$ 0,00" value={b.valor} onChange={(e) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} /></Field>
                    <Field label="Recorrência" span="col-span-6 md:col-span-3"><EnumSelect value={b.recorrencia} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, recorrencia: v } : x))} options={enumOpts(enums, "vagaBeneficioRecorrencia")} /></Field>
                    <Field label="Obrigatório?" span="col-span-6 md:col-span-2"><Toggle label="Sim" checked={b.obrigatorio} onChange={(v) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, obrigatorio: v } : x))} /></Field>
                    <Field label="Observações" span="col-span-12"><input className="form-control" placeholder="Ex.: coparticipação, carência, faixa" value={b.obs} onChange={(e) => setList("beneficios", (l) => l.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Requisitos ───────────────────────────────────────── */}
          {tab === "requisitos" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Escolaridade"><EnumSelect value={draft.escolaridade} onChange={(v) => set("escolaridade", v)} options={enumOpts(enums, "vagaEscolaridade", "Selecionar")} /></Field>
              <Field label="Área de formação"><EnumSelect value={draft.formacaoArea} onChange={(v) => set("formacaoArea", v)} options={enumOpts(enums, "vagaFormacaoArea", "Selecionar")} /></Field>
              <Field label="Experiência mín. (anos)"><input className="form-control" placeholder="0" value={draft.experienciaMinimaAnos} onChange={(e) => set("experienciaMinimaAnos", e.target.value)} /></Field>
              <Field label="Stack / Ferramentas (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="form-control" rows={2} placeholder="Ex.: Excel; Power BI; ATS" value={draft.tagsStack} onChange={(e) => set("tagsStack", e.target.value)} /></Field>
              <Field label="Idiomas (separe por ;)" span="col-span-12 md:col-span-6"><textarea className="form-control" rows={2} placeholder="Ex.: Inglês (B2); Espanhol (A2)" value={draft.tagsIdiomas} onChange={(e) => set("tagsIdiomas", e.target.value)} /></Field>
              <div className="col-span-12 flex items-center justify-between gap-2 mt-2">
                <div><div className="fw-semibold">Requisitos detalhados</div><div className="text-muted-foreground text-xs">Peso, obrigatório, nível e avaliação.</div></div>
                <button className="btn-ghost text-sm" type="button" onClick={() => setList("requisitos", (l) => [...l, { nome: "", categoria: "competencia", peso: "1", obrigatorio: false, anosMinimos: "", nivel: "", avaliacao: "", sinonimos: "", obs: "" }])}>+ Adicionar</button>
              </div>
              {draft.requisitos.map((r, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Requisito #{i + 1}</span><button type="button" className="btn-ghost text-red-600 text-xs" onClick={() => setList("requisitos", (l) => l.filter((_, j) => j !== i))}>Remover</button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Requisito" span="col-span-12 md:col-span-6"><input className="form-control" placeholder="Ex.: Excel avançado, SQL, etc." value={r.nome} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></Field>
                    <Field label="Peso (1-10)" span="col-span-6 md:col-span-2"><EnumSelect value={r.peso} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, peso: v } : x))} options={enumOpts(enums, "vagaPeso").length ? enumOpts(enums, "vagaPeso") : Array.from({ length: 10 }, (_, k) => ({ code: String(k + 1), text: String(k + 1) }))} /></Field>
                    <Field label="Obrigatório" span="col-span-6 md:col-span-2"><Toggle label="Sim" checked={r.obrigatorio} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, obrigatorio: v } : x))} /></Field>
                    <Field label="Anos mín." span="col-span-6 md:col-span-2"><input className="form-control" placeholder="0" value={r.anosMinimos} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, anosMinimos: e.target.value } : x))} /></Field>
                    <Field label="Nível" span="col-span-6 md:col-span-4"><EnumSelect value={r.nivel} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, nivel: v } : x))} options={enumOpts(enums, "vagaRequisitoNivel", "Selecionar")} /></Field>
                    <Field label="Avaliação" span="col-span-6 md:col-span-4"><EnumSelect value={r.avaliacao} onChange={(v) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, avaliacao: v } : x))} options={enumOpts(enums, "vagaRequisitoAvaliacao", "Selecionar")} /></Field>
                    <Field label="Sinônimos (vírgula)" span="col-span-12 md:col-span-4"><input className="form-control" placeholder="Ex.: pbi, powerbi, business intelligence" value={r.sinonimos} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, sinonimos: e.target.value } : x))} /></Field>
                    <Field label="Obs." span="col-span-12"><input className="form-control" placeholder="Ex.: precisa ter aplicado em alto volume" value={r.obs} onChange={(e) => setList("requisitos", (l) => l.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
              <Field label="Diferenciais" span="col-span-12"><textarea className="form-control" rows={2} placeholder="Ex.: certificações, vivência em alto volume" value={draft.diferenciais} onChange={(e) => set("diferenciais", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Filtros matching (IA) ────────────────────────────── */}
          {tab === "matching" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <div className="col-span-12"><div className="fw-semibold">Regras de matching por IA</div><div className="text-muted-foreground text-xs">Preencha os critérios do candidato ideal. Esses dados serão usados como contexto para o matching (e para a IA).</div></div>
              <Field label="Modalidade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingModalidade} onChange={(v) => set("matchingModalidade", v)} options={enumOpts(enums, "vagaModalidade", "Qualquer")} /></Field>
              <Field label="Senioridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingSenioridade} onChange={(v) => set("matchingSenioridade", v)} options={enumOpts(enums, "vagaSenioridade", "Qualquer")} /></Field>
              <Field label="Escolaridade" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingEscolaridade} onChange={(v) => set("matchingEscolaridade", v)} options={enumOpts(enums, "vagaEscolaridade", "Qualquer")} /></Field>
              <Field label="Formação (área)" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingFormacaoArea} onChange={(v) => set("matchingFormacaoArea", v)} options={enumOpts(enums, "vagaFormacaoArea", "Qualquer")} /></Field>
              <Field label="Cidade" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="Ex.: São Paulo" value={draft.matchingCidade} onChange={(e) => set("matchingCidade", e.target.value)} /></Field>
              <Field label="UF" span="col-span-6 md:col-span-3">
                <select className="form-select" value={draft.matchingUF} onChange={(e) => set("matchingUF", e.target.value)}>
                  <option value="">Qualquer</option>
                  {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Tempo de experiência" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingExp} onChange={(v) => set("matchingExp", v)} options={EXP_OPTIONS} /></Field>
              <Field label="Sexo" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingSexo} onChange={(v) => set("matchingSexo", v)} options={SEXO_OPTIONS} /></Field>
              <Field label="PCD" span="col-span-6 md:col-span-3"><EnumSelect value={draft.matchingPcd} onChange={(v) => set("matchingPcd", v)} options={PCD_MATCH_OPTIONS} /></Field>
              <Field label="Idade mín." span="col-span-6 md:col-span-2"><input className="form-control" type="number" min={14} max={100} placeholder="—" value={draft.matchingIdadeMin} onChange={(e) => set("matchingIdadeMin", e.target.value)} /></Field>
              <Field label="Idade máx." span="col-span-6 md:col-span-2"><input className="form-control" type="number" min={14} max={100} placeholder="—" value={draft.matchingIdadeMax} onChange={(e) => set("matchingIdadeMax", e.target.value)} /></Field>
              <div className="col-span-12 md:col-span-5 flex items-end gap-3 pb-1">
                <Toggle label="Requer CNH" checked={draft.matchingRequerCnh} onChange={(v) => set("matchingRequerCnh", v)} />
                {draft.matchingRequerCnh && (
                  <select className="form-select w-auto" value={draft.matchingCnhCategoria} onChange={(e) => set("matchingCnhCategoria", e.target.value)}>
                    {CNH_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <Field label="Habilidades desejadas" span="col-span-12"><input className="form-control" placeholder="Ex.: .NET, SQL, APIs REST (separadas por vírgula)" value={draft.matchingHabilidades} onChange={(e) => set("matchingHabilidades", e.target.value)} /></Field>
              <Field label="Observações adicionais (opcional)" span="col-span-12"><textarea className="form-control" rows={2} placeholder="Outros critérios em texto livre" value={draft.matchingObs} onChange={(e) => set("matchingObs", e.target.value)} /></Field>

              <div className="col-span-12 mt-3"><div className="fw-semibold">Pesos do matching</div><div className="text-muted-foreground text-xs mb-2">Distribua o peso entre as dimensões (total recomendado: 100).</div></div>
              <Field label={`Competência (${draft.weightsCompetencia})`} span="col-span-6 md:col-span-3"><input className="form-control" type="number" min={0} max={100} value={draft.weightsCompetencia} onChange={(e) => set("weightsCompetencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Experiência (${draft.weightsExperiencia})`} span="col-span-6 md:col-span-3"><input className="form-control" type="number" min={0} max={100} value={draft.weightsExperiencia} onChange={(e) => set("weightsExperiencia", Number(e.target.value) || 0)} /></Field>
              <Field label={`Formação (${draft.weightsFormacao})`} span="col-span-6 md:col-span-3"><input className="form-control" type="number" min={0} max={100} value={draft.weightsFormacao} onChange={(e) => set("weightsFormacao", Number(e.target.value) || 0)} /></Field>
              <Field label={`Localidade (${draft.weightsLocalidade})`} span="col-span-6 md:col-span-3"><input className="form-control" type="number" min={0} max={100} value={draft.weightsLocalidade} onChange={(e) => set("weightsLocalidade", Number(e.target.value) || 0)} /></Field>
              <div className="col-span-12"><span className={`badge-soft ${weightsTotal === 100 ? "" : "text-red-600"}`}>Total: {weightsTotal}%{weightsTotal !== 100 && " (recomendado: 100%)"}</span></div>
            </div>
          )}

          {/* ── Processo seletivo ────────────────────────────────── */}
          {tab === "processo" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <div className="col-span-12 flex items-center justify-between gap-2">
                <div><div className="fw-semibold">Etapas do processo</div><div className="text-muted-foreground text-xs">Defina responsáveis, modo e SLA.</div></div>
                <button className="btn-ghost text-sm" type="button" onClick={() => setList("etapas", (l) => [...l, { nome: "", responsavel: "", modo: "", slaDias: "3", descricao: "" }])}>+ Adicionar</button>
              </div>
              {draft.etapas.map((e, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Etapa #{i + 1}</span><button type="button" className="btn-ghost text-red-600 text-xs" onClick={() => setList("etapas", (l) => l.filter((_, j) => j !== i))}>Remover</button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Nome da etapa" span="col-span-12 md:col-span-4"><input className="form-control" placeholder="Ex.: Entrevista RH" value={e.nome} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, nome: ev.target.value } : x))} /></Field>
                    <Field label="Responsável" span="col-span-12 md:col-span-3"><EnumSelect value={e.responsavel} onChange={(v) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, responsavel: v } : x))} options={enumOpts(enums, "vagaEtapaResponsavel", "Selecionar")} /></Field>
                    <Field label="Modo" span="col-span-6 md:col-span-2"><EnumSelect value={e.modo} onChange={(v) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, modo: v } : x))} options={enumOpts(enums, "vagaEtapaModo", "Selecionar")} /></Field>
                    <Field label="SLA (dias)" span="col-span-6 md:col-span-3"><input className="form-control" placeholder="3" value={e.slaDias} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, slaDias: ev.target.value } : x))} /></Field>
                    <Field label="Descrição / instruções" span="col-span-12"><input className="form-control" placeholder="Ex.: entrevista por competências, 45min" value={e.descricao} onChange={(ev) => setList("etapas", (l) => l.map((x, j) => j === i ? { ...x, descricao: ev.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
              <div className="col-span-12 flex items-center justify-between gap-2 mt-2">
                <div><div className="fw-semibold">Perguntas de triagem</div><div className="text-muted-foreground text-xs">Knockout, peso e opções.</div></div>
                <button className="btn-ghost text-sm" type="button" onClick={() => setList("perguntasTriagem", (l) => [...l, { texto: "", tipo: "", peso: "1", obrigatoria: true, knockout: false, opcoes: "" }])}>+ Adicionar</button>
              </div>
              {draft.perguntasTriagem.map((p, i) => (
                <div key={i} className="col-span-12 card-soft p-3">
                  <div className="flex justify-between items-start mb-2"><span className="fw-semibold text-sm">Pergunta #{i + 1}</span><button type="button" className="btn-ghost text-red-600 text-xs" onClick={() => setList("perguntasTriagem", (l) => l.filter((_, j) => j !== i))}>Remover</button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <Field label="Pergunta" span="col-span-12"><input className="form-control" placeholder="Ex.: Tem disponibilidade para presencial 2x por semana?" value={p.texto} onChange={(ev) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, texto: ev.target.value } : x))} /></Field>
                    <Field label="Tipo" span="col-span-12 md:col-span-4"><EnumSelect value={p.tipo} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, tipo: v } : x))} options={enumOpts(enums, "vagaPerguntaTipo", "Selecionar")} /></Field>
                    <Field label="Peso" span="col-span-6 md:col-span-2"><EnumSelect value={p.peso} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, peso: v } : x))} options={enumOpts(enums, "vagaPeso").length ? enumOpts(enums, "vagaPeso") : Array.from({ length: 10 }, (_, k) => ({ code: String(k + 1), text: String(k + 1) }))} /></Field>
                    <Field label="Obrigatória?" span="col-span-6 md:col-span-3"><Toggle label="Sim" checked={p.obrigatoria} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, obrigatoria: v } : x))} /></Field>
                    <Field label="Knockout?" span="col-span-6 md:col-span-3"><Toggle label="Sim" checked={p.knockout} onChange={(v) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, knockout: v } : x))} /></Field>
                    <Field label="Opções (separe por ;)" span="col-span-12"><input className="form-control" placeholder="Ex.: Sim;Não;Talvez" value={p.opcoes} onChange={(ev) => setList("perguntasTriagem", (l) => l.map((x, j) => j === i ? { ...x, opcoes: ev.target.value } : x))} /></Field>
                  </div>
                </div>
              ))}
              <Field label="Observações internas do processo" span="col-span-12"><textarea className="form-control" rows={2} placeholder="Ex.: aprovações necessárias, critérios de corte" value={draft.observacoesProcesso} onChange={(e) => set("observacoesProcesso", e.target.value)} /></Field>
            </div>
          )}

          {/* ── Publicação ───────────────────────────────────────── */}
          {tab === "publicacao" && (
            <div className="grid grid-cols-12 gap-x-3 gap-y-2 mt-2">
              <Field label="Visibilidade"><EnumSelect value={draft.visibilidade} onChange={(v) => set("visibilidade", v)} options={enumOpts(enums, "vagaPublicacaoVisibilidade", "Selecionar")} /></Field>
              <Field label="Data de início"><input className="form-control" type="date" value={draft.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} /></Field>
              <Field label="Data de encerramento"><input className="form-control" type="date" value={draft.dataEncerramento} onChange={(e) => set("dataEncerramento", e.target.value)} /></Field>
              <Field label="Meta SLA (dias)"><input className="form-control" type="number" min={0} placeholder="Ex.: 30" value={draft.slaDiasMetaFechamento} onChange={(e) => set("slaDiasMetaFechamento", e.target.value)} /></Field>
              <div className="col-span-12 mt-1"><div className="fw-semibold text-sm">Canais</div></div>
              <div className="col-span-12 flex flex-wrap gap-4">
                <Toggle label="LinkedIn" checked={draft.canalLinkedIn} onChange={(v) => set("canalLinkedIn", v)} />
                <Toggle label="Site/Carreiras" checked={draft.canalSiteCarreiras} onChange={(v) => set("canalSiteCarreiras", v)} />
                <Toggle label="Indicação" checked={draft.canalIndicacao} onChange={(v) => set("canalIndicacao", v)} />
                <Toggle label="Portais de emprego" checked={draft.canalPortaisEmprego} onChange={(v) => set("canalPortaisEmprego", v)} />
              </div>
              <Field label="Descrição pública" span="col-span-12"><textarea className="form-control" rows={4} placeholder="Inclua responsabilidades, requisitos e benefícios." value={draft.descricaoPublica} onChange={(e) => set("descricaoPublica", e.target.value)} /></Field>
              <div className="col-span-12 md:col-span-6">
                <div className="card-soft p-3">
                  <div className="fw-semibold mb-2 text-sm">LGPD / Consentimentos</div>
                  <div className="space-y-1">
                    <Toggle label="Solicitar consentimento explícito" checked={draft.lgpdConsentimento} onChange={(v) => set("lgpdConsentimento", v)} />
                    <Toggle label="Compartilhar currículo internamente" checked={draft.lgpdCompartilhamento} onChange={(v) => set("lgpdCompartilhamento", v)} />
                    <Toggle label="Retenção por X meses" checked={draft.lgpdRetencao} onChange={(v) => set("lgpdRetencao", v)} />
                  </div>
                  {draft.lgpdRetencao && (
                    <div className="mt-2"><label className="form-label small text-muted-foreground mb-1 block">Prazo de retenção (meses)</label><input className="form-control" placeholder="12" value={draft.lgpdRetencaoMeses} onChange={(e) => set("lgpdRetencaoMeses", e.target.value)} /></div>
                  )}
                </div>
              </div>
              <div className="col-span-12 md:col-span-6">
                <div className="card-soft p-3">
                  <div className="fw-semibold mb-2 text-sm">Documentos / Exigências</div>
                  <div className="space-y-1">
                    <Toggle label="Exige CNH" checked={draft.exigeCnh} onChange={(v) => set("exigeCnh", v)} />
                    <Toggle label="Disponibilidade para viagens" checked={draft.disponibilidadeViagens} onChange={(v) => set("disponibilidadeViagens", v)} />
                    <Toggle label="Checagem de antecedentes" checked={draft.checagemAntecedentes} onChange={(v) => set("checagemAntecedentes", v)} />
                  </div>
                </div>
              </div>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-black/10 shrink-0">
          <button className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors" type="button" onClick={onClose}>Cancelar</button>
          <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none" type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Salvando..." : "Salvar vaga"}
          </button>
        </div>
      </div>
    </div>
  );
}
