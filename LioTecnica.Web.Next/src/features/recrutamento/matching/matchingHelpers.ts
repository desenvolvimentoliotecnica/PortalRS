/* Matching helpers – extracted for reusability */
import { apiFetch } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRec = Record<string, any>;
export const BASE = "/app";

export interface VagaOption { id: string; titulo: string; codigo: string; label: string; createdAtUtc?: string; }
export interface RankItem { id: string; nome: string; email: string; score: number; pass: boolean; source?: string; obs?: string; scoreCompetencia?: number; scoreExperiencia?: number; scoreFormacao?: number; scoreLocalidade?: number; scoreFiltros?: number; scoreRequisitos?: number; justificativa?: string; mandatoryTotal?: number; missingMandatoryCount?: number; mandatoryCoverage?: number; hardPenalty?: number; ruleVersion?: string; trabalhando?: boolean | null; pretensaoSalarial?: string; linkedinUrl?: string; fone?: string; cidade?: string; uf?: string; }
export interface VagaDetail { id: string; titulo: string; codigo: string; threshold: number; requisitos: Requisito[]; matchingFiltrosRaw?: string | null; matchingFiltrosOriginaisRaw?: string | null; area?: string; modalidade?: string; senioridade?: string; cidade?: string; uf?: string; quantidadeVagas?: number; weightsCompetencia?: number; weightsExperiencia?: number; weightsFormacao?: number; weightsLocalidade?: number; }
export interface Requisito { id: string; termo: string; peso: number; obrigatorio: boolean; sinonimos: string[]; }
export interface CandidatoFull { id: string; nome: string; email: string; source?: string; cvText?: string; resumoProfissional?: string; documentos?: { nome?: string; fileName?: string; url?: string; link?: string }[]; updatedAt?: string; linkedinUrl?: string; fone?: string; trabalhando?: boolean | null; pretensaoSalarial?: string; cidade?: string; uf?: string; }
export interface MatchResult { score: number; pass: boolean; hits: Requisito[]; missMandatory: Requisito[]; totalPeso: number; hitPeso: number; threshold: number; }
export type TabKey = "suggestions" | "approved" | "rejected" | "pending";

export function pk(v: unknown, fb = ""): string { return typeof v === "string" ? v : v == null ? fb : String(v); }
export function pn(v: unknown, fb = 0): number { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : fb; }
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
export function formatDuration(ms: number) { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return m > 0 ? `${m}min ${(s % 60).toString().padStart(2, "0")}s` : `${s}s`; }
export function initials(name: string) { const p = name.trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1]?.[0] ?? "" : "")).toUpperCase(); }

export function timingStorageKey(vagaId: string) { return `matching_timing_${vagaId}`; }
export function readExpectedTotalMs(vagaId: string) {
    if (!vagaId || typeof window === "undefined") return 180000;
    try { const raw = window.localStorage.getItem(timingStorageKey(vagaId)); const arr = raw ? (JSON.parse(raw) as number[]) : []; const valid = arr.filter(x => Number.isFinite(x) && x >= 5000 && x <= 600000); if (!valid.length) return 180000; return clamp(Math.round(valid.reduce((a, b) => a + b, 0) / valid.length), 30000, 600000); } catch { return 180000; }
}
export function saveObservedDurationMs(vagaId: string, durationMs: number) {
    if (!vagaId || typeof window === "undefined") return;
    if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 300000) return;
    try { const key = timingStorageKey(vagaId); const raw = window.localStorage.getItem(key); const arr = raw ? (JSON.parse(raw) as number[]) : []; const next = [...arr.filter(x => Number.isFinite(x)), durationMs].slice(-8); window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ }
}
function parsePeso(v: unknown): number {
    if (typeof v === "number" && Number.isFinite(v)) return clamp(v, 0, 10);
    const s = pk(v).trim().toLowerCase(); if (!s) return 0;
    const parsed = Number(s.replace(",", ".")); if (Number.isFinite(parsed)) return clamp(parsed, 0, 10);
    const map: Record<string, number> = { um: 1, dois: 2, tres: 3, "três": 3, quatro: 4, cinco: 5 };
    return map[s] ?? 0;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    if (!res.ok) {
        if (url.includes("matching-ranking")) { try { return (await res.json()) as T; } catch { /* */ } }
        const txt = await res.text().catch(() => "");
        let msg = txt;
        if (txt) { try { const parsed = JSON.parse(txt) as AnyRec; msg = pk(parsed?.message, txt); } catch { msg = txt; } }
        throw new Error(msg || `HTTP_${res.status}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

export function mapVagas(raw: unknown): VagaOption[] {
    const arr = Array.isArray(raw) ? raw : Array.isArray((raw as AnyRec)?.items) ? (raw as AnyRec).items : [];
    return arr.map((x: AnyRec) => { const id = pk(x.id); if (!id) return null; const titulo = pk(x.titulo); const codigo = pk(x.codigo); return { id, titulo, codigo, label: codigo ? `${titulo} (${codigo})` : titulo, createdAtUtc: pk(x.createdAtUtc) }; }).filter(Boolean) as VagaOption[];
}

export function mapRankItem(x: AnyRec): RankItem {
    return { id: pk(x.candidatoId ?? x.id), nome: pk(x.nome), email: pk(x.email), score: clamp(pn(x.score), 0, 100), pass: typeof x.pass === "boolean" ? x.pass : pn(x.score) >= 70, source: pk(x.source, "candidato"), obs: pk(x.obs), scoreCompetencia: pn(x.scoreCompetencia), scoreExperiencia: pn(x.scoreExperiencia), scoreFormacao: pn(x.scoreFormacao), scoreLocalidade: pn(x.scoreLocalidade), scoreFiltros: pn(x.scoreFiltros), scoreRequisitos: pn(x.scoreRequisitos), justificativa: pk(x.justificativa), mandatoryTotal: pn(x.mandatoryTotal), missingMandatoryCount: pn(x.missingMandatoryCount), mandatoryCoverage: pn(x.mandatoryCoverage, 100), hardPenalty: pn(x.hardPenalty), ruleVersion: pk(x.ruleVersion), trabalhando: x.trabalhando ?? x.trabalhandoAtualmente ?? null, pretensaoSalarial: pk(x.pretensaoSalarial), linkedinUrl: pk(x.linkedinUrl), fone: pk(x.fone), cidade: pk(x.cidade), uf: pk(x.uf) };
}

export function mapVagaDetail(d: AnyRec): VagaDetail {
    const reqs = Array.isArray(d.requisitos) ? d.requisitos : [];
    const w = (d.weights ?? {}) as AnyRec;
    return {
        id: pk(d.id), titulo: pk(d.titulo), codigo: pk(d.codigo), threshold: clamp(pn(d.threshold ?? d.matchingThreshold ?? d.matchMinimoPercentual), 0, 100),
        requisitos: reqs.map((r: AnyRec) => ({ id: pk(r.id ?? r.nome ?? r.termo), termo: pk(r.termo ?? r.nome), peso: parsePeso(r.peso), obrigatorio: !!r.obrigatorio, sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos.map(String) : pk(r.sinonimosRaw).split(/[;,]/).map(x => x.trim()).filter(Boolean) })),
        matchingFiltrosRaw: d.matchingFiltrosRaw ?? null, matchingFiltrosOriginaisRaw: d.matchingFiltrosOriginaisRaw ?? null,
        area: pk(d.areaName ?? d.area),
        modalidade: pk(d.modalidade),
        senioridade: pk(d.senioridade),
        cidade: pk(d.cidade),
        uf: pk(d.uf),
        quantidadeVagas: pn(d.quantidadeVagas),
        weightsCompetencia: pn(w.competencia ?? d.pesoCompetencia, 40),
        weightsExperiencia: pn(w.experiencia ?? d.pesoExperiencia, 30),
        weightsFormacao: pn(w.formacao ?? d.pesoFormacao, 15),
        weightsLocalidade: pn(w.localidade ?? d.pesoLocalidade, 15),
    };
}

export function calcMatch(cvText: string, reqs: Requisito[], threshold: number): MatchResult {
    const text = (cvText || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const totalPeso = reqs.reduce((a, r) => a + r.peso, 0) || 1;
    let hitPeso = 0; const hits: Requisito[] = []; const missMandatory: Requisito[] = [];
    for (const r of reqs) { const bag = [r.termo, ...r.sinonimos].map(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).filter(Boolean); const found = bag.some(t => t && text.includes(t)); if (found) { hitPeso += r.peso; hits.push(r); } else if (r.obrigatorio) missMandatory.push(r); }
    let score = Math.round((hitPeso / totalPeso) * 100);
    if (missMandatory.length) score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
    return { score, pass: score >= threshold, hits, missMandatory, totalPeso, hitPeso, threshold };
}

/* ── Filter modal parse/build helpers ── */
export const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
export const MODALIDADE_OPTIONS = [{ code: "Presencial", label: "Presencial" }, { code: "Remoto", label: "Remoto" }, { code: "Hibrido", label: "Híbrido" }];
export const SENIORIDADE_OPTIONS = ["Junior", "Pleno", "Senior", "Especialista"];
export const ESCOLARIDADE_OPTIONS = ["Fundamental", "Medio", "Tecnico", "Superior", "PosGraduacao"];
export const TEMPO_EXP_OPTIONS = [{ code: "0", label: "Sem experiência" }, { code: "0-1", label: "0 a 1 ano" }, { code: "1-3", label: "1 a 3 anos" }, { code: "3-5", label: "3 a 5 anos" }, { code: "5+", label: "5 ou mais anos" }];

function normalizeToken(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }

export interface ParsedFiltros { modalidade: string; senioridade: string; escolaridade: string; formacaoArea: string; cidade: string; uf: string; tempoExp: string; sexo: string; pcd: string; idadeMin: string; idadeMax: string; requerCnh: boolean; cnhCategoria: string; habilidades: string; observacoes: string; }

export function parseMatchingFiltrosRaw(raw: string): ParsedFiltros {
    const out: ParsedFiltros = { modalidade: "", senioridade: "", escolaridade: "", formacaoArea: "", cidade: "", uf: "", tempoExp: "", sexo: "", pcd: "", idadeMin: "", idadeMax: "", requerCnh: false, cnhCategoria: "", habilidades: "", observacoes: "" };
    if (!raw?.trim()) return out;
    const full = raw.trim();
    const keyRe = /(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observac[oõ]es)\s*:/gi;
    const found = Array.from(full.matchAll(keyRe));
    const matches: Array<{ label: string; value: string }> = [];
    for (let i = 0; i < found.length; i++) { const curr = found[i]; const next = found[i + 1]; const label = curr[1] ?? ""; const start = (curr.index ?? 0) + curr[0].length; const end = next?.index ?? full.length; matches.push({ label, value: full.slice(start, end).replace(/^\s*[.\-]?\s*/, "").replace(/\s*[.\-]?\s*$/, "").trim() }); }
    if (!matches.length) { out.observacoes = full; return out; }
    for (const part of matches) {
        const label = part.label.toLowerCase().replace(/[çõ]/g, c => c === "ç" ? "c" : "o"); const val = part.value.trim();
        if (label === "modalidade") { const nv = normalizeToken(val); out.modalidade = nv === "presencial" ? "Presencial" : nv === "remoto" ? "Remoto" : (nv === "hibrido" || nv === "hibrida") ? "Hibrido" : val; }
        else if (label === "senioridade") { const nv = normalizeToken(val); out.senioridade = nv === "junior" ? "Junior" : nv === "pleno" ? "Pleno" : nv === "senior" ? "Senior" : nv === "especialista" ? "Especialista" : val; }
        else if (label === "escolaridade") { const nv = normalizeToken(val); out.escolaridade = nv === "fundamental" ? "Fundamental" : nv === "medio" ? "Medio" : nv === "tecnico" ? "Tecnico" : nv === "superior" ? "Superior" : (nv === "pos-graduacao" || nv === "pos graduacao") ? "PosGraduacao" : val; }
        else if (label === "formacao") out.formacaoArea = val;
        else if (label === "cidade") out.cidade = val;
        else if (label === "uf") out.uf = val;
        else if (label === "tempoexperiencia") { const nv = normalizeToken(val); out.tempoExp = nv === "sem experiencia" ? "0" : nv === "0 a 1 ano" ? "0-1" : nv === "1 a 3 anos" ? "1-3" : nv === "3 a 5 anos" ? "3-5" : nv === "5 ou mais anos" ? "5+" : val; }
        else if (label === "sexo") { const nv = normalizeToken(val); out.sexo = nv === "masculino" ? "M" : nv === "feminino" ? "F" : "O"; }
        else if (label === "pcd") out.pcd = normalizeToken(val).startsWith("sim") ? "S" : "N";
        else if (label === "idademin") out.idadeMin = val;
        else if (label === "idademax") out.idadeMax = val;
        else if (label === "requercnh") out.requerCnh = val === "Sim";
        else if (label === "categoriacnh") out.cnhCategoria = val;
        else if (label === "habilidades") out.habilidades = val;
        else if (label === "observacoes") out.observacoes = val;
    }
    return out;
}
