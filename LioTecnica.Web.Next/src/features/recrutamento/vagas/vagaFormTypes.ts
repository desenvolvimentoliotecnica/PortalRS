/* ── Types & helpers for VagaFormModal ── */

export type EnumOption = { code: string; text: string };
export type EnumMap = Record<string, EnumOption[]>;
export type LookupItem = { id: string; name: string; code?: string };

export type BenefitDraft = { tipo: string; valor: string; recorrencia: string; obrigatorio: boolean; obs: string };
export type ReqDetailDraft = { nome: string; peso: string; obrigatorio: boolean; anos: string; nivel: string; avaliacao: string; obs: string };
export type StageDraft = { nome: string; responsavel: string; modo: string; slaDias: string; descricao: string };
export type QuestionDraft = { pergunta: string; tipo: string; peso: string; obrigatoria: boolean; knockout: boolean; opcoes: string };

export type VagaTab = "dados" | "diversidade" | "projeto" | "local" | "remuneracao" | "requisitos" | "matching" | "processo" | "publicacao" | "candidatos";

export interface VagaDraftFull {
    id?: string;
    // Dados básicos
    titulo: string; codigo: string; centroCustoId: string; areaTime: string;
    modalidade: string; status: string; senioridade: string;
    quantidadeVagas: number; tipoContratacao: string; threshold: number;
    descricao: string; codigoInterno: string; cbo: string;
    motivoAbertura: string; orcamentoAprovado: string;
    gestorRequisitante: string; recrutadorResponsavel: string; prioridade: string;
    resumoPitch: string; tagsResponsabilidades: string; tagsKeywords: string;
    confidencial: boolean; aceitaPcd: boolean; urgente: boolean;
    // Diversidade
    generoPreferencia: string; vagaAfirmativa: boolean; linguagemInclusiva: boolean;
    publicoAfirmativo: string; pcdObs: string;
    // Projeto
    projetoNome: string; projetoCliente: string; projetoPrazo: string; projetoDescricao: string;
    // Local e jornada
    regime: string; cargaSemanal: string; escala: string;
    horaEntrada: string; horaSaida: string; intervalo: string;
    cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string;
    politicaTrabalho: string; deslocamentoObs: string;
    // Remuneração
    moeda: string; salarioMin: string; salarioMax: string; periodicidade: string;
    bonusTipo: string; bonusPercentual: string; remObs: string;
    beneficios: BenefitDraft[];
    // Requisitos
    escolaridade: string; formacaoArea: string; expMinAnos: string;
    tagsStack: string; tagsIdiomas: string; diferenciais: string;
    requisitosDetalhados: ReqDetailDraft[];
    // Matching IA
    matchingModalidade: string; matchingSenioridade: string; matchingEscolaridade: string;
    matchingFormacaoArea: string; matchingCidade: string; matchingUF: string;
    matchingExp: string; matchingSexo: string; matchingPcd: string;
    matchingIdadeMin: string; matchingIdadeMax: string;
    matchingRequerCnh: boolean; matchingCnhCategoria: string;
    matchingHabilidades: string; matchingObs: string;
    // Processo seletivo
    etapas: StageDraft[]; perguntas: QuestionDraft[]; obsProcesso: string;
    // Publicação
    visibilidade: string; dataInicio: string; dataFim: string; slaDiasMeta: string;
    canalLinkedin: boolean; canalSite: boolean; canalIndicacao: boolean; canalPortal: boolean;
    descricaoPublica: string;
    lgpdConsentimento: boolean; lgpdCompartilhamento: boolean; lgpdRetencao: boolean; lgpdRetencaoMeses: string;
    exigeCnh: boolean; disponibilidadeViagens: boolean; checagemAntecedentes: boolean;
}

export const EMPTY_DRAFT: VagaDraftFull = {
    titulo: "", codigo: "", centroCustoId: "", areaTime: "", modalidade: "presencial", status: "aberta", senioridade: "",
    quantidadeVagas: 1, tipoContratacao: "", threshold: 70, descricao: "", codigoInterno: "", cbo: "",
    motivoAbertura: "", orcamentoAprovado: "", gestorRequisitante: "", recrutadorResponsavel: "", prioridade: "",
    resumoPitch: "", tagsResponsabilidades: "", tagsKeywords: "", confidencial: false, aceitaPcd: false, urgente: false,
    generoPreferencia: "", vagaAfirmativa: false, linguagemInclusiva: false, publicoAfirmativo: "", pcdObs: "",
    projetoNome: "", projetoCliente: "", projetoPrazo: "", projetoDescricao: "",
    regime: "", cargaSemanal: "", escala: "", horaEntrada: "", horaSaida: "", intervalo: "",
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", politicaTrabalho: "", deslocamentoObs: "",
    moeda: "brl", salarioMin: "", salarioMax: "", periodicidade: "", bonusTipo: "", bonusPercentual: "", remObs: "", beneficios: [],
    escolaridade: "", formacaoArea: "", expMinAnos: "", tagsStack: "", tagsIdiomas: "", diferenciais: "", requisitosDetalhados: [],
    matchingModalidade: "", matchingSenioridade: "", matchingEscolaridade: "", matchingFormacaoArea: "",
    matchingCidade: "", matchingUF: "", matchingExp: "", matchingSexo: "", matchingPcd: "",
    matchingIdadeMin: "", matchingIdadeMax: "", matchingRequerCnh: false, matchingCnhCategoria: "",
    matchingHabilidades: "", matchingObs: "",
    etapas: [], perguntas: [], obsProcesso: "",
    visibilidade: "", dataInicio: "", dataFim: "", slaDiasMeta: "",
    canalLinkedin: false, canalSite: false, canalIndicacao: false, canalPortal: false, descricaoPublica: "",
    lgpdConsentimento: false, lgpdCompartilhamento: false, lgpdRetencao: false, lgpdRetencaoMeses: "",
    exigeCnh: false, disponibilidadeViagens: false, checagemAntecedentes: false,
};

const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const EXP_OPTIONS = [{ c: "", t: "Qualquer" }, { c: "0", t: "Sem experiencia" }, { c: "0-1", t: "0 a 1 ano" }, { c: "1-3", t: "1 a 3 anos" }, { c: "3-5", t: "3 a 5 anos" }, { c: "5+", t: "5 ou mais anos" }];
const SEXO_OPTIONS = [{ c: "", t: "Qualquer" }, { c: "M", t: "Masculino" }, { c: "F", t: "Feminino" }, { c: "O", t: "Outro" }];
const PCD_OPTIONS = [{ c: "", t: "Qualquer" }, { c: "S", t: "Sim (preferencia PCD)" }, { c: "N", t: "Nao" }];
const CNH_OPTIONS = ["A", "B", "AB", "C", "D", "E"];

export { UF_LIST, EXP_OPTIONS, SEXO_OPTIONS, PCD_OPTIONS, CNH_OPTIONS };

export function emptyToNull(s: string) { const v = (s ?? "").trim(); return v || null; }
function splitTags(t: string) { return (t || "").split(";").map(x => x.trim()).filter(Boolean); }
function joinTagsRaw(list: string[]) { return list.filter(Boolean).join(";"); }

export function buildMatchingFiltrosRaw(d: VagaDraftFull, enumText: (key: string, code: string) => string): string | null {
    const parts: string[] = [];
    if (d.matchingModalidade) parts.push("Modalidade: " + enumText("vagaModalidade", d.matchingModalidade));
    if (d.matchingSenioridade) parts.push("Senioridade: " + enumText("vagaSenioridade", d.matchingSenioridade));
    if (d.matchingEscolaridade) parts.push("Escolaridade: " + enumText("vagaEscolaridade", d.matchingEscolaridade));
    if (d.matchingFormacaoArea) parts.push("Formacao: " + enumText("vagaFormacaoArea", d.matchingFormacaoArea));
    if (d.matchingCidade) parts.push("Cidade: " + d.matchingCidade);
    if (d.matchingUF) parts.push("UF: " + d.matchingUF);
    if (d.matchingExp) { const m: { [k: string]: string } = { "0": "Sem experiencia", "0-1": "0 a 1 ano", "1-3": "1 a 3 anos", "3-5": "3 a 5 anos", "5+": "5 ou mais anos" }; parts.push("TempoExperiencia: " + (m[d.matchingExp] || d.matchingExp)); }
    if (d.matchingSexo) { const m: { [k: string]: string } = { M: "Masculino", F: "Feminino", O: "Outro" }; parts.push("Sexo: " + (m[d.matchingSexo] || d.matchingSexo)); }
    if (d.matchingPcd) parts.push("PCD: " + (d.matchingPcd === "S" ? "Sim" : "Nao"));
    if (d.matchingIdadeMin) parts.push("IdadeMin: " + d.matchingIdadeMin);
    if (d.matchingIdadeMax) parts.push("IdadeMax: " + d.matchingIdadeMax);
    if (d.matchingRequerCnh) parts.push("RequerCNH: Sim");
    if (d.matchingRequerCnh && d.matchingCnhCategoria) parts.push("CategoriaCNH: " + d.matchingCnhCategoria);
    if (d.matchingHabilidades) parts.push("Habilidades: " + d.matchingHabilidades);
    if (d.matchingObs) parts.push("Observacoes: " + d.matchingObs);
    return parts.length ? parts.join(". ") : null;
}

export function parseMatchingFiltrosRaw(raw: string | null | undefined): Partial<VagaDraftFull> {
    const out: Partial<VagaDraftFull> = {};
    if (!raw) return out;
    const rest = raw.split(/\s*\.\s*/).filter(Boolean);
    const re = /^(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observacoes)\s*:\s*(.+)$/i;
    for (const part of rest) {
        const m = part.match(re);
        if (!m) continue;
        const l = m[1].toLowerCase().replace(/[ç]/g, "c"), v = m[2].trim();
        if (l === "modalidade") out.matchingModalidade = v;
        else if (l === "senioridade") out.matchingSenioridade = v;
        else if (l === "escolaridade") out.matchingEscolaridade = v;
        else if (l === "formacao") out.matchingFormacaoArea = v;
        else if (l === "cidade") out.matchingCidade = v;
        else if (l === "uf") out.matchingUF = v;
        else if (l === "tempoexperiencia") { const mm: { [k: string]: string } = { "sem experiencia": "0", "0 a 1 ano": "0-1", "1 a 3 anos": "1-3", "3 a 5 anos": "3-5", "5 ou mais anos": "5+" }; out.matchingExp = mm[v.toLowerCase()] || v; }
        else if (l === "sexo") { out.matchingSexo = v === "Masculino" ? "M" : v === "Feminino" ? "F" : "O"; }
        else if (l === "pcd") out.matchingPcd = v === "Sim" ? "S" : "N";
        else if (l === "idademin") out.matchingIdadeMin = v;
        else if (l === "idademax") out.matchingIdadeMax = v;
        else if (l === "requercnh") out.matchingRequerCnh = v === "Sim";
        else if (l === "categoriacnh") out.matchingCnhCategoria = v;
        else if (l === "habilidades") out.matchingHabilidades = v;
        else if (l === "observacoes") out.matchingObs = v;
    }
    return out;
}

export function buildSavePayload(d: VagaDraftFull, enumText: (key: string, code: string) => string) {
    const parseIntOrNull = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };
    const parseDecOrNull = (s: string) => { const n = parseFloat((s || "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
    const matchingFiltrosRaw = buildMatchingFiltrosRaw(d, enumText);
    return {
        titulo: d.titulo.trim(),
        centroCustoId: emptyToNull(d.centroCustoId),
        status: emptyToNull(d.status),
        codigo: emptyToNull(d.codigo),
        areaTime: emptyToNull(d.areaTime),
        modalidade: emptyToNull(d.modalidade),
        senioridade: emptyToNull(d.senioridade),
        quantidadeVagas: d.quantidadeVagas || 1,
        tipoContratacao: emptyToNull(d.tipoContratacao),
        matchMinimoPercentual: d.threshold,
        matchingFiltrosRaw,
        descricaoInterna: emptyToNull(d.descricao),
        codigoInterno: emptyToNull(d.codigoInterno),
        codigoCbo: emptyToNull(d.cbo),
        motivoAbertura: emptyToNull(d.motivoAbertura),
        orcamentoAprovado: emptyToNull(d.orcamentoAprovado),
        gestorRequisitante: emptyToNull(d.gestorRequisitante),
        recrutadorResponsavel: emptyToNull(d.recrutadorResponsavel),
        prioridade: emptyToNull(d.prioridade),
        resumoPitch: emptyToNull(d.resumoPitch),
        tagsResponsabilidadesRaw: emptyToNull(joinTagsRaw(splitTags(d.tagsResponsabilidades))),
        tagsKeywordsRaw: emptyToNull(joinTagsRaw(splitTags(d.tagsKeywords))),
        confidencial: d.confidencial, aceitaPcd: d.aceitaPcd, urgente: d.urgente,
        generoPreferencia: emptyToNull(d.generoPreferencia),
        vagaAfirmativa: d.vagaAfirmativa, linguagemInclusiva: d.linguagemInclusiva,
        publicoAfirmativo: emptyToNull(d.publicoAfirmativo),
        observacoesPcd: emptyToNull(d.pcdObs),
        projetoNome: emptyToNull(d.projetoNome),
        projetoClienteAreaImpactada: emptyToNull(d.projetoCliente),
        projetoPrazoPrevisto: emptyToNull(d.projetoPrazo),
        projetoDescricao: emptyToNull(d.projetoDescricao),
        regime: emptyToNull(d.regime),
        cargaSemanalHoras: parseIntOrNull(d.cargaSemanal),
        escala: emptyToNull(d.escala),
        horaEntrada: emptyToNull(d.horaEntrada), horaSaida: emptyToNull(d.horaSaida),
        intervalo: emptyToNull(d.intervalo),
        cep: emptyToNull(d.cep), logradouro: emptyToNull(d.logradouro),
        numero: emptyToNull(d.numero), bairro: emptyToNull(d.bairro),
        cidade: emptyToNull(d.cidade), uf: emptyToNull(d.uf)?.toUpperCase().slice(0, 2) || null,
        politicaTrabalho: emptyToNull(d.politicaTrabalho),
        observacoesDeslocamento: emptyToNull(d.deslocamentoObs),
        moeda: emptyToNull(d.moeda),
        salarioMinimo: parseDecOrNull(d.salarioMin), salarioMaximo: parseDecOrNull(d.salarioMax),
        periodicidade: emptyToNull(d.periodicidade),
        bonusTipo: emptyToNull(d.bonusTipo), bonusPercentual: parseDecOrNull(d.bonusPercentual),
        observacoesRemuneracao: emptyToNull(d.remObs),
        escolaridade: emptyToNull(d.escolaridade), formacaoArea: emptyToNull(d.formacaoArea),
        experienciaMinimaAnos: parseIntOrNull(d.expMinAnos),
        tagsStackRaw: emptyToNull(joinTagsRaw(splitTags(d.tagsStack))),
        tagsIdiomasRaw: emptyToNull(joinTagsRaw(splitTags(d.tagsIdiomas))),
        diferenciais: emptyToNull(d.diferenciais),
        observacoesProcesso: emptyToNull(d.obsProcesso),
        visibilidade: emptyToNull(d.visibilidade),
        dataInicio: emptyToNull(d.dataInicio), dataEncerramento: emptyToNull(d.dataFim),
        slaDiasMetaFechamento: parseIntOrNull(d.slaDiasMeta),
        canalLinkedIn: d.canalLinkedin, canalSiteCarreiras: d.canalSite,
        canalIndicacao: d.canalIndicacao, canalPortaisEmprego: d.canalPortal,
        descricaoPublica: emptyToNull(d.descricaoPublica),
        lgpdSolicitarConsentimentoExplicito: d.lgpdConsentimento,
        lgpdCompartilharCurriculoInternamente: d.lgpdCompartilhamento,
        lgpdRetencaoAtiva: d.lgpdRetencao,
        lgpdRetencaoMeses: parseIntOrNull(d.lgpdRetencaoMeses),
        exigeCnh: d.exigeCnh, disponibilidadeParaViagens: d.disponibilidadeViagens,
        checagemAntecedentes: d.checagemAntecedentes,
        beneficios: d.beneficios.map((b, i) => ({ ordem: i + 1, tipo: emptyToNull(b.tipo), valor: parseDecOrNull(b.valor), recorrencia: emptyToNull(b.recorrencia), obrigatorio: b.obrigatorio, observacoes: emptyToNull(b.obs) })),
        requisitos: d.requisitosDetalhados.filter(r => r.nome.trim()).map((r, i) => ({ ordem: i + 1, categoria: "geral", nome: r.nome.trim(), peso: emptyToNull(r.peso) || "1", obrigatorio: r.obrigatorio, anosMinimos: parseIntOrNull(r.anos), nivel: emptyToNull(r.nivel), avaliacao: emptyToNull(r.avaliacao), observacoes: emptyToNull(r.obs) })),
        etapas: d.etapas.filter(e => e.nome.trim()).map((e, i) => ({ ordem: i + 1, nome: e.nome.trim(), responsavel: emptyToNull(e.responsavel), modo: emptyToNull(e.modo), slaDias: parseIntOrNull(e.slaDias) != null ? parseIntOrNull(e.slaDias) : null, descricaoInstrucoes: emptyToNull(e.descricao) })),
        perguntasTriagem: d.perguntas.filter(p => p.pergunta.trim()).map((p, i) => ({ ordem: i + 1, texto: p.pergunta.trim(), tipo: emptyToNull(p.tipo), peso: emptyToNull(p.peso) || "1", obrigatoria: p.obrigatoria, knockout: p.knockout, opcoesRaw: emptyToNull(p.opcoes) })),
    };
}

export function mapApiToFormDraft(r: Record<string, unknown>): VagaDraftFull {
    const ps = (k: string, fb = "") => typeof r[k] === "string" ? r[k] as string : fb;
    const pn = (k: string, fb: number) => { const v = r[k]; const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : fb; };
    const pb = (k: string) => !!r[k];
    const splitT = (k: string) => { const v = r[k]; return typeof v === "string" ? v.split(";").map(x => x.trim()).filter(Boolean).join("; ") : ""; };
    const matchParsed = parseMatchingFiltrosRaw(ps("matchingFiltrosRaw"));
    const benefsRaw = Array.isArray(r.beneficios) ? r.beneficios : [];
    const reqsRaw = Array.isArray(r.requisitos) ? r.requisitos : [];
    const etapasRaw = Array.isArray(r.etapas) ? r.etapas : [];
    const pergsRaw = Array.isArray(r.perguntasTriagem) ? r.perguntasTriagem : [];
    return {
        ...EMPTY_DRAFT,
        id: ps("id"),
        titulo: ps("titulo"), codigo: ps("codigo"),
        centroCustoId: ps("centroCustoId") || ps("areaId") || ps("departmentId"), areaTime: ps("areaTime"),
        modalidade: ps("modalidade", "presencial"), status: ps("status", "aberta"),
        senioridade: ps("senioridade"),
        quantidadeVagas: pn("quantidadeVagas", 1),
        tipoContratacao: ps("tipoContratacao"),
        threshold: Math.max(0, Math.min(100, pn("matchMinimoPercentual", pn("threshold", 70)))),
        descricao: ps("descricaoInterna") || ps("descricao"),
        codigoInterno: ps("codigoInterno"), cbo: ps("codigoCbo"),
        motivoAbertura: ps("motivoAbertura"), orcamentoAprovado: ps("orcamentoAprovado"),
        gestorRequisitante: ps("gestorRequisitante"), recrutadorResponsavel: ps("recrutadorResponsavel"),
        prioridade: ps("prioridade"),
        resumoPitch: ps("resumoPitch"),
        tagsResponsabilidades: splitT("tagsResponsabilidadesRaw"),
        tagsKeywords: splitT("tagsKeywordsRaw"),
        confidencial: pb("confidencial"), aceitaPcd: pb("aceitaPcd"), urgente: pb("urgente"),
        generoPreferencia: ps("generoPreferencia"), vagaAfirmativa: pb("vagaAfirmativa"),
        linguagemInclusiva: pb("linguagemInclusiva"), publicoAfirmativo: ps("publicoAfirmativo"), pcdObs: ps("observacoesPcd"),
        projetoNome: ps("projetoNome"), projetoCliente: ps("projetoClienteAreaImpactada"),
        projetoPrazo: ps("projetoPrazoPrevisto"), projetoDescricao: ps("projetoDescricao"),
        regime: ps("regime"), cargaSemanal: r.cargaSemanalHoras != null ? String(r.cargaSemanalHoras) : "",
        escala: ps("escala"), horaEntrada: ps("horaEntrada"), horaSaida: ps("horaSaida"), intervalo: ps("intervalo"),
        cep: ps("cep"), logradouro: ps("logradouro"), numero: ps("numero"), bairro: ps("bairro"),
        cidade: ps("cidade"), uf: ps("uf"), politicaTrabalho: ps("politicaTrabalho"),
        deslocamentoObs: ps("observacoesDeslocamento"),
        moeda: ps("moeda", "brl"),
        salarioMin: r.salarioMinimo != null ? String(r.salarioMinimo) : "",
        salarioMax: r.salarioMaximo != null ? String(r.salarioMaximo) : "",
        periodicidade: ps("periodicidade"), bonusTipo: ps("bonusTipo"),
        bonusPercentual: r.bonusPercentual != null ? String(r.bonusPercentual) : "",
        remObs: ps("observacoesRemuneracao"),
        beneficios: benefsRaw.map((b: Record<string, unknown>) => ({ tipo: String(b.tipo || ""), valor: b.valor != null ? String(b.valor) : "", recorrencia: String(b.recorrencia || "mensal"), obrigatorio: !!b.obrigatorio, obs: String(b.observacoes || "") })),
        escolaridade: ps("escolaridade"), formacaoArea: ps("formacaoArea"),
        expMinAnos: r.experienciaMinimaAnos != null ? String(r.experienciaMinimaAnos) : "",
        tagsStack: splitT("tagsStackRaw"), tagsIdiomas: splitT("tagsIdiomasRaw"),
        diferenciais: ps("diferenciais"),
        requisitosDetalhados: reqsRaw.map((rq: Record<string, unknown>) => ({ nome: String(rq.nome || ""), peso: String(rq.peso || "1"), obrigatorio: !!rq.obrigatorio, anos: rq.anosMinimos != null ? String(rq.anosMinimos) : "", nivel: String(rq.nivel || ""), avaliacao: String(rq.avaliacao || ""), obs: String(rq.observacoes || "") })),
        ...matchParsed,
        etapas: etapasRaw.map((e: Record<string, unknown>) => ({ nome: String(e.nome || ""), responsavel: String(e.responsavel || ""), modo: String(e.modo || ""), slaDias: e.slaDias != null ? String(e.slaDias) : "", descricao: String(e.descricaoInstrucoes || "") })),
        perguntas: pergsRaw.map((p: Record<string, unknown>) => ({ pergunta: String(p.texto || ""), tipo: String(p.tipo || ""), peso: String(p.peso || "1"), obrigatoria: !!p.obrigatoria, knockout: !!p.knockout, opcoes: String(p.opcoesRaw || "") })),
        obsProcesso: ps("observacoesProcesso"),
        visibilidade: ps("visibilidade"), dataInicio: ps("dataInicio"), dataFim: ps("dataEncerramento"),
        slaDiasMeta: r.slaDiasMetaFechamento != null ? String(r.slaDiasMetaFechamento) : "",
        canalLinkedin: pb("canalLinkedIn"), canalSite: pb("canalSiteCarreiras"),
        canalIndicacao: pb("canalIndicacao"), canalPortal: pb("canalPortaisEmprego"),
        descricaoPublica: ps("descricaoPublica"),
        lgpdConsentimento: pb("lgpdSolicitarConsentimentoExplicito"),
        lgpdCompartilhamento: pb("lgpdCompartilharCurriculoInternamente"),
        lgpdRetencao: pb("lgpdRetencaoAtiva"),
        lgpdRetencaoMeses: r.lgpdRetencaoMeses != null ? String(r.lgpdRetencaoMeses) : "",
        exigeCnh: pb("exigeCnh"), disponibilidadeViagens: pb("disponibilidadeParaViagens"),
        checagemAntecedentes: pb("checagemAntecedentes"),
    };
}
