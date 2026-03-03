"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { EnumMap, LookupItem, VagaDraftFull, VagaTab, BenefitDraft, ReqDetailDraft, StageDraft, QuestionDraft } from "./vagaFormTypes";
import { EMPTY_DRAFT, UF_LIST, EXP_OPTIONS, SEXO_OPTIONS, PCD_OPTIONS, CNH_OPTIONS, buildSavePayload, mapApiToFormDraft } from "./vagaFormTypes";

const BASE = "/app";
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `HTTP_${res.status}`); }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const TABS: { key: VagaTab; icon: string; label: string }[] = [
    { key: "dados", icon: "bi-card-text", label: "Dados basicos" },
    { key: "diversidade", icon: "bi-heart", label: "Diversidade" },
    { key: "projeto", icon: "bi-folder", label: "Projeto" },
    { key: "local", icon: "bi-geo-alt", label: "Local e jornada" },
    { key: "remuneracao", icon: "bi-currency-dollar", label: "Remuneracao" },
    { key: "requisitos", icon: "bi-list-check", label: "Requisitos" },
    { key: "matching", icon: "bi-stars", label: "Filtros matching (IA)" },
    { key: "processo", icon: "bi-diagram-3", label: "Processo seletivo" },
    { key: "publicacao", icon: "bi-megaphone", label: "Publicacao" },
    { key: "candidatos", icon: "bi-people", label: "Candidatos" },
];

// Small helpers
function Lbl({ children }: { children: React.ReactNode }) { return <label className="form-label small text-muted">{children}</label>; }
function Section({ title, sub }: { title: string; sub?: string }) { return <div className="col-12"><div className="fw-semibold">{title}</div>{sub && <div className="text-muted small">{sub}</div>}</div>; }
function Switch({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} /><label className="form-check-label" htmlFor={id}>{label}</label></div>;
}
function EnumSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { code: string; text: string }[]; placeholder?: string }) {
    return <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map(o => <option key={o.code} value={o.code}>{o.text}</option>)}</select>;
}

interface Props {
    open: boolean;
    editId?: string | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function VagaFormModal({ open, editId, onClose, onSaved }: Props) {
    const [tab, setTab] = useState<VagaTab>("dados");
    const [d, setD] = useState<VagaDraftFull>({ ...EMPTY_DRAFT });
    const [saving, setSaving] = useState(false);
    const [enums, setEnums] = useState<EnumMap>({});
    const [areas, setAreas] = useState<LookupItem[]>([]);
    const [depts, setDepts] = useState<LookupItem[]>([]);

    const getOpts = useCallback((key: string) => (Array.isArray(enums[key]) ? enums[key]! : []), [enums]);
    const getEnumText = useCallback((key: string, code: string) => { const list = getOpts(key); const t = (code || "").trim().toLowerCase(); const o = list.find(x => (x.code || "").trim().toLowerCase() === t); return o ? o.text : code || ""; }, [getOpts]);

    const upd = useCallback((patch: Partial<VagaDraftFull>) => setD(prev => ({ ...prev, ...patch })), []);

    // Load enums + lookups on mount
    useEffect(() => {
        if (!open) return;
        let alive = true;
        void Promise.all([
            fetchJson<EnumMap>(`${BASE}/api/lookup/enums`).catch(() => ({} as EnumMap)),
            fetchJson<LookupItem[]>(`${BASE}/api/lookup/areas`).catch(() => []),
            fetchJson<LookupItem[]>(`${BASE}/api/lookup/departments`).catch(() => []),
        ]).then(([e, a, dep]) => { if (!alive) return; setEnums(e || {}); setAreas(Array.isArray(a) ? a : []); setDepts(Array.isArray(dep) ? dep : []); });
        return () => { alive = false; };
    }, [open]);

    // Load existing vaga for edit
    useEffect(() => {
        if (!open) return;
        setTab("dados");
        if (!editId) { setD({ ...EMPTY_DRAFT }); return; }
        void fetchJson<Record<string, unknown>>(`${BASE}/api/vagas/${encodeURIComponent(editId)}`)
            .then(r => setD(mapApiToFormDraft(r)))
            .catch(() => toast.error("Falha ao carregar vaga."));
    }, [open, editId]);

    async function handleSave() {
        if (!d.titulo.trim()) { toast.error("Informe o titulo da vaga."); return; }
        if (!d.status.trim()) { toast.error("Selecione o status."); return; }
        setSaving(true);
        try {
            const payload = buildSavePayload(d, getEnumText);
            if (d.id) {
                await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(d.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Vaga atualizada.");
            } else {
                await fetchJson(`${BASE}/api/vagas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Vaga criada.");
            }
            onSaved();
            onClose();
        } catch { toast.error("Falha ao salvar vaga."); } finally { setSaving(false); }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="card-soft w-full max-w-5xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh", borderRadius: 18, border: "1px solid var(--lt-border)" }}>
                {/* Header */}
                <div className="p-4 flex items-start justify-between gap-2 border-b" style={{ borderColor: "var(--lt-border)" }}>
                    <div><h5 className="fw-bold text-lg">{d.id ? "Editar vaga" : "Nova vaga"}</h5><div className="text-muted small">Dados principais da vaga. Requisitos e pesos ficam nos detalhes.</div></div>
                    <button type="button" className="btn-close" onClick={onClose} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Tab pills */}
                    <div className="flex flex-wrap gap-2 mb-3 p-1 rounded-full" style={{ background: "rgba(173,200,220,.16)", border: "1px solid rgba(16,82,144,.14)" }}>
                        {TABS.map(t => (
                            <button key={t.key} type="button" className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.key ? "bg-white shadow-sm text-[var(--lt-primary)]" : "text-gray-600 hover:bg-white/50"}`} onClick={() => setTab(t.key)}>
                                <i className={`bi ${t.icon} me-1`} />{t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Dados básicos ── */}
                    {tab === "dados" && (
                        <div className="row g-2">
                            <Section title="Copiar de outra vaga" />
                            <div className="col-12 mb-2">
                                <input className="form-control" placeholder="Buscar vaga para copiar dados..." disabled />
                                <div className="small text-muted">Selecione uma vaga para preencher o formulario com seus dados (edite e salve como nova).</div>
                            </div>
                            <Section title="Identificacao e contexto" sub="Dados principais e internos da vaga." />
                            <div className="col-12 col-md-4"><Lbl>Codigo</Lbl><input className="form-control" placeholder="Ex.: MKT-JR-001" value={d.codigo} onChange={e => upd({ codigo: e.target.value })} /></div>
                            <div className="col-12 col-md-8"><Lbl>Titulo *</Lbl><input className="form-control" placeholder="Ex.: Analista de Marketing Jr" value={d.titulo} onChange={e => upd({ titulo: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Departamento</Lbl><select className="form-select" value={d.departmentId} onChange={e => upd({ departmentId: e.target.value })}><option value="">Selecionar departamento</option>{depts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                            <div className="col-12 col-md-4"><Lbl>Area/Time</Lbl><EnumSelect value={d.areaTime} onChange={v => upd({ areaTime: v })} options={getOpts("vagaAreaTime")} placeholder="Selecionar area/time" /></div>
                            <div className="col-12 col-md-4"><Lbl>Area *</Lbl><select className="form-select" value={d.areaId} onChange={e => upd({ areaId: e.target.value })}><option value="">Selecionar area</option>{areas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                            <div className="col-12 col-md-4"><Lbl>Modalidade</Lbl><EnumSelect value={d.modalidade} onChange={v => upd({ modalidade: v })} options={getOpts("vagaModalidade")} /></div>
                            <div className="col-12 col-md-4"><Lbl>Status *</Lbl><EnumSelect value={d.status} onChange={v => upd({ status: v })} options={getOpts("vagaStatus")} placeholder="Selecionar status" /></div>
                            <div className="col-12 col-md-4"><Lbl>Senioridade</Lbl><EnumSelect value={d.senioridade} onChange={v => upd({ senioridade: v })} options={getOpts("vagaSenioridade")} /></div>
                            <div className="col-12 col-md-3"><Lbl>Quantidade de vagas</Lbl><input type="number" className="form-control" min={1} value={d.quantidadeVagas} onChange={e => upd({ quantidadeVagas: Math.max(1, Number(e.target.value) || 1) })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Tipo de contratacao</Lbl><EnumSelect value={d.tipoContratacao} onChange={v => upd({ tipoContratacao: v })} options={getOpts("vagaTipoContratacao")} placeholder="Selecionar tipo" /></div>
                            <div className="col-12 col-md-3"><Lbl>Match minimo</Lbl><div className="input-group"><input type="number" className="form-control" min={0} max={100} value={d.threshold} onChange={e => upd({ threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /><span className="input-group-text">%</span></div></div>
                            <div className="col-12"><Lbl>Descricao interna</Lbl><textarea className="form-control" rows={3} placeholder="Resumo interno da vaga, responsabilidades, etc." value={d.descricao} onChange={e => upd({ descricao: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Codigo interno</Lbl><input className="form-control" placeholder="EX.: VAG-2025-0012" maxLength={40} value={d.codigoInterno} onChange={e => upd({ codigoInterno: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Codigo CBO (opcional)</Lbl><input className="form-control" placeholder="0000-00" value={d.cbo} onChange={e => upd({ cbo: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Motivo da abertura</Lbl><EnumSelect value={d.motivoAbertura} onChange={v => upd({ motivoAbertura: v })} options={getOpts("vagaMotivoAbertura")} placeholder="Selecionar motivo" /></div>
                            <div className="col-12 col-md-3"><Lbl>Orcamento aprovado</Lbl><EnumSelect value={d.orcamentoAprovado} onChange={v => upd({ orcamentoAprovado: v })} options={getOpts("vagaOrcamentoAprovado")} placeholder="Selecionar orcamento" /></div>
                            <div className="col-12 col-md-4"><Lbl>Gestor requisitante</Lbl><input className="form-control" placeholder="Buscar gestor..." maxLength={120} value={d.gestorRequisitante} onChange={e => upd({ gestorRequisitante: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Recrutador responsavel</Lbl><input className="form-control" placeholder="Buscar recrutador..." maxLength={120} value={d.recrutadorResponsavel} onChange={e => upd({ recrutadorResponsavel: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Prioridade</Lbl><EnumSelect value={d.prioridade} onChange={v => upd({ prioridade: v })} options={getOpts("vagaPrioridade")} placeholder="Selecionar prioridade" /></div>
                            <div className="col-12"><Lbl>Resumo / pitch da vaga</Lbl><textarea className="form-control" rows={2} placeholder="Explique rapidamente o proposito da vaga e o diferencial." value={d.resumoPitch} onChange={e => upd({ resumoPitch: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Responsabilidades (separe por ;)</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: triagem de curriculos; entrevistas; alinhamento com gestores" value={d.tagsResponsabilidades} onChange={e => upd({ tagsResponsabilidades: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Palavras-chave (separe por ;)</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: recrutamento; ATS; entrevistas por competencia" value={d.tagsKeywords} onChange={e => upd({ tagsKeywords: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Confidencial?</Lbl><Switch id="vConfidencial" label="Ocultar empresa/gestor em canais publicos" checked={d.confidencial} onChange={v => upd({ confidencial: v })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Aceita PCD?</Lbl><Switch id="vAceitaPcd" label="Vaga inclusiva" checked={d.aceitaPcd} onChange={v => upd({ aceitaPcd: v })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Vaga urgente?</Lbl><Switch id="vUrgente" label="SLA curto" checked={d.urgente} onChange={v => upd({ urgente: v })} /></div>
                        </div>
                    )}

                    {/* ── Diversidade ── */}
                    {tab === "diversidade" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-4"><Lbl>Preferencia de genero</Lbl><EnumSelect value={d.generoPreferencia} onChange={v => upd({ generoPreferencia: v })} options={getOpts("vagaGeneroPreferencia")} placeholder="Selecionar preferencia" /></div>
                            <div className="col-12 col-md-4"><Lbl>Vaga afirmativa?</Lbl><Switch id="vAfirmativa" label="Sim" checked={d.vagaAfirmativa} onChange={v => upd({ vagaAfirmativa: v })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Linguagem inclusiva</Lbl><Switch id="vLingInclusiva" label="Revisar descricao" checked={d.linguagemInclusiva} onChange={v => upd({ linguagemInclusiva: v })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Publico afirmativo (opcional)</Lbl><input className="form-control" placeholder="Ex.: PCD; Mulheres; Pessoas Negras" maxLength={120} value={d.publicoAfirmativo} onChange={e => upd({ publicoAfirmativo: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Observacoes PCD</Lbl><input className="form-control" placeholder="Ex.: acomodacoes ou ajustes necessarios" value={d.pcdObs} onChange={e => upd({ pcdObs: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Projeto ── */}
                    {tab === "projeto" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-4"><Lbl>Nome do projeto</Lbl><input className="form-control" placeholder="Ex.: Migracao RH" value={d.projetoNome} onChange={e => upd({ projetoNome: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Cliente/Area impactada</Lbl><input className="form-control" placeholder="Ex.: Operacoes" value={d.projetoCliente} onChange={e => upd({ projetoCliente: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Prazo previsto</Lbl><input className="form-control" placeholder="Ex.: Q3/2025" value={d.projetoPrazo} onChange={e => upd({ projetoPrazo: e.target.value })} /></div>
                            <div className="col-12"><Lbl>Descricao do projeto</Lbl><textarea className="form-control" rows={2} placeholder="Escopo e objetivos do projeto." value={d.projetoDescricao} onChange={e => upd({ projetoDescricao: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Local e jornada ── */}
                    {tab === "local" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-4"><Lbl>Regime</Lbl><EnumSelect value={d.regime} onChange={v => upd({ regime: v })} options={getOpts("vagaRegimeJornada")} placeholder="Selecionar regime" /></div>
                            <div className="col-12 col-md-4"><Lbl>Carga semanal (h)</Lbl><input className="form-control" placeholder="40" value={d.cargaSemanal} onChange={e => upd({ cargaSemanal: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Escala</Lbl><EnumSelect value={d.escala} onChange={v => upd({ escala: v })} options={getOpts("vagaEscalaTrabalho")} placeholder="Selecionar escala" /></div>
                            <div className="col-12 col-md-4"><Lbl>Entrada</Lbl><input className="form-control" placeholder="08:00" value={d.horaEntrada} onChange={e => upd({ horaEntrada: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Saida</Lbl><input className="form-control" placeholder="17:00" value={d.horaSaida} onChange={e => upd({ horaSaida: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Intervalo</Lbl><input className="form-control" placeholder="01:00" value={d.intervalo} onChange={e => upd({ intervalo: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>CEP</Lbl><input className="form-control" placeholder="00000-000" value={d.cep} onChange={e => upd({ cep: e.target.value })} /></div>
                            <div className="col-12 col-md-5"><Lbl>Logradouro</Lbl><input className="form-control" placeholder="Rua / Av." value={d.logradouro} onChange={e => upd({ logradouro: e.target.value })} /></div>
                            <div className="col-12 col-md-2"><Lbl>Numero</Lbl><input className="form-control" placeholder="123" value={d.numero} onChange={e => upd({ numero: e.target.value })} /></div>
                            <div className="col-12 col-md-2"><Lbl>Bairro</Lbl><input className="form-control" placeholder="Centro" value={d.bairro} onChange={e => upd({ bairro: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Cidade</Lbl><input className="form-control" placeholder="Ex.: Embu das Artes" value={d.cidade} onChange={e => upd({ cidade: e.target.value })} /></div>
                            <div className="col-12 col-md-2"><Lbl>UF</Lbl><input className="form-control" placeholder="SP" maxLength={2} value={d.uf} onChange={e => upd({ uf: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Politica de trabalho</Lbl><input className="form-control" placeholder="Ex.: 2 dias presencial, 3 remoto" value={d.politicaTrabalho} onChange={e => upd({ politicaTrabalho: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Observacoes de deslocamento</Lbl><input className="form-control" placeholder="Ex.: viagens 1x/mes" value={d.deslocamentoObs} onChange={e => upd({ deslocamentoObs: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Remuneracao ── */}
                    {tab === "remuneracao" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-3"><Lbl>Moeda</Lbl><EnumSelect value={d.moeda} onChange={v => upd({ moeda: v })} options={getOpts("vagaMoeda")} /></div>
                            <div className="col-12 col-md-3"><Lbl>Salario minimo</Lbl><input className="form-control" placeholder="0,00" value={d.salarioMin} onChange={e => upd({ salarioMin: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Salario maximo</Lbl><input className="form-control" placeholder="0,00" value={d.salarioMax} onChange={e => upd({ salarioMax: e.target.value })} /></div>
                            <div className="col-12 col-md-3"><Lbl>Periodicidade</Lbl><EnumSelect value={d.periodicidade} onChange={v => upd({ periodicidade: v })} options={getOpts("vagaRemuneracaoPeriodicidade")} placeholder="Selecionar periodicidade" /></div>
                            <div className="col-12 col-md-4"><Lbl>Bonus/Comissao</Lbl><EnumSelect value={d.bonusTipo} onChange={v => upd({ bonusTipo: v })} options={getOpts("vagaBonusTipo")} placeholder="Selecionar bonus" /></div>
                            <div className="col-12 col-md-4"><Lbl>Percentual bonus/comissao</Lbl><input className="form-control" placeholder="0,00%" value={d.bonusPercentual} onChange={e => upd({ bonusPercentual: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Observacoes de remuneracao</Lbl><input className="form-control" placeholder="Ex.: faixa depende de senioridade" value={d.remObs} onChange={e => upd({ remObs: e.target.value })} /></div>
                            <div className="col-12 d-flex align-items-center justify-content-between gap-2 flex-wrap mt-1">
                                <div><div className="fw-semibold">Beneficios</div><div className="text-muted small">Adicione beneficios com tipo, valor e detalhes.</div></div>
                                <button type="button" className="btn btn-outline-success btn-sm" onClick={() => upd({ beneficios: [...d.beneficios, { tipo: "", valor: "", recorrencia: "mensal", obrigatorio: false, obs: "" }] })}><i className="bi bi-plus-lg me-1" />Adicionar beneficio</button>
                            </div>
                            {d.beneficios.map((b, i) => (
                                <div key={i} className="col-12 card-soft p-2">
                                    <div className="d-flex justify-content-between"><span className="fw-semibold">Beneficio {i + 1}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => upd({ beneficios: d.beneficios.filter((_, j) => j !== i) })}><i className="bi bi-trash3" /></button></div>
                                    <div className="row g-2 mt-1">
                                        <div className="col-12 col-md-4"><Lbl>Tipo</Lbl><EnumSelect value={b.tipo} onChange={v => { const n = [...d.beneficios]; n[i] = { ...n[i], tipo: v }; upd({ beneficios: n }); }} options={getOpts("vagaBeneficioTipo")} /></div>
                                        <div className="col-12 col-md-4"><Lbl>Valor (opcional)</Lbl><input className="form-control form-control-sm" placeholder="R$ 0,00" value={b.valor} onChange={e => { const n = [...d.beneficios]; n[i] = { ...n[i], valor: e.target.value }; upd({ beneficios: n }); }} /></div>
                                        <div className="col-12 col-md-2"><Lbl>Recorrencia</Lbl><EnumSelect value={b.recorrencia} onChange={v => { const n = [...d.beneficios]; n[i] = { ...n[i], recorrencia: v }; upd({ beneficios: n }); }} options={getOpts("vagaBeneficioRecorrencia")} /></div>
                                        <div className="col-12 col-md-2"><Lbl>Obrigatorio?</Lbl><div className="form-check mt-1"><input className="form-check-input" type="checkbox" checked={b.obrigatorio} onChange={e => { const n = [...d.beneficios]; n[i] = { ...n[i], obrigatorio: e.target.checked }; upd({ beneficios: n }); }} /><label className="form-check-label">Sim</label></div></div>
                                        <div className="col-12"><Lbl>Observacoes</Lbl><input className="form-control form-control-sm" placeholder="Ex.: coparticipacao, carencia, faixa" value={b.obs} onChange={e => { const n = [...d.beneficios]; n[i] = { ...n[i], obs: e.target.value }; upd({ beneficios: n }); }} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Requisitos ── */}
                    {tab === "requisitos" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-4"><Lbl>Escolaridade</Lbl><EnumSelect value={d.escolaridade} onChange={v => upd({ escolaridade: v })} options={getOpts("vagaEscolaridade")} placeholder="Selecionar escolaridade" /></div>
                            <div className="col-12 col-md-4"><Lbl>Area de formacao</Lbl><EnumSelect value={d.formacaoArea} onChange={v => upd({ formacaoArea: v })} options={getOpts("vagaFormacaoArea")} placeholder="Selecionar formacao" /></div>
                            <div className="col-12 col-md-4"><Lbl>Experiencia minima (anos)</Lbl><input className="form-control" placeholder="0" value={d.expMinAnos} onChange={e => upd({ expMinAnos: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Stack / Ferramentas (separe por ;)</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: Excel; Power BI; ATS" value={d.tagsStack} onChange={e => upd({ tagsStack: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><Lbl>Idiomas (separe por ;)</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: Ingles (B2); Espanhol (A2)" value={d.tagsIdiomas} onChange={e => upd({ tagsIdiomas: e.target.value })} /></div>
                            <div className="col-12 d-flex align-items-center justify-content-between gap-2 flex-wrap mt-1">
                                <div><div className="fw-semibold">Requisitos detalhados</div><div className="text-muted small">Peso, obrigatorio, nivel e avaliacao.</div></div>
                                <button type="button" className="btn btn-outline-success btn-sm" onClick={() => upd({ requisitosDetalhados: [...d.requisitosDetalhados, { nome: "", peso: "1", obrigatorio: false, anos: "", nivel: "", avaliacao: "", obs: "" }] })}><i className="bi bi-plus-lg me-1" />Adicionar requisito</button>
                            </div>
                            {d.requisitosDetalhados.map((r, i) => (
                                <div key={i} className="col-12 card-soft p-2">
                                    <div className="d-flex justify-content-between"><span className="fw-semibold">Requisito {i + 1}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => upd({ requisitosDetalhados: d.requisitosDetalhados.filter((_, j) => j !== i) })}><i className="bi bi-trash3" /></button></div>
                                    <div className="row g-2 mt-1">
                                        <div className="col-12 col-md-6"><Lbl>Requisito</Lbl><input className="form-control form-control-sm" placeholder="Ex.: Excel avancado, SQL, etc." value={r.nome} onChange={e => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], nome: e.target.value }; upd({ requisitosDetalhados: n }); }} /></div>
                                        <div className="col-6 col-md-2"><Lbl>Peso (1-5)</Lbl><select className="form-select form-select-sm" value={r.peso} onChange={e => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], peso: e.target.value }; upd({ requisitosDetalhados: n }); }}>{[1, 2, 3, 4, 5].map(p => <option key={p} value={String(p)}>{p}</option>)}</select></div>
                                        <div className="col-6 col-md-2"><Lbl>Obrigatorio</Lbl><div className="form-check mt-1"><input className="form-check-input" type="checkbox" checked={r.obrigatorio} onChange={e => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], obrigatorio: e.target.checked }; upd({ requisitosDetalhados: n }); }} /><label className="form-check-label">Sim</label></div></div>
                                        <div className="col-12 col-md-2"><Lbl>Anos min.</Lbl><input className="form-control form-control-sm" placeholder="0" value={r.anos} onChange={e => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], anos: e.target.value }; upd({ requisitosDetalhados: n }); }} /></div>
                                        <div className="col-12 col-md-4"><Lbl>Nivel</Lbl><EnumSelect value={r.nivel} onChange={v => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], nivel: v }; upd({ requisitosDetalhados: n }); }} options={getOpts("vagaRequisitoNivel")} /></div>
                                        <div className="col-12 col-md-4"><Lbl>Avaliacao</Lbl><EnumSelect value={r.avaliacao} onChange={v => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], avaliacao: v }; upd({ requisitosDetalhados: n }); }} options={getOpts("vagaRequisitoAvaliacao")} /></div>
                                        <div className="col-12 col-md-4"><Lbl>Obs.</Lbl><input className="form-control form-control-sm" placeholder="Ex.: precisa ter aplicado em alto volume" value={r.obs} onChange={e => { const n = [...d.requisitosDetalhados]; n[i] = { ...n[i], obs: e.target.value }; upd({ requisitosDetalhados: n }); }} /></div>
                                    </div>
                                </div>
                            ))}
                            <div className="col-12"><Lbl>Diferenciais</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: certificacoes, vivencia em alto volume" value={d.diferenciais} onChange={e => upd({ diferenciais: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Filtros matching (IA) ── */}
                    {tab === "matching" && (
                        <div className="row g-2">
                            <Section title="Regras de matching por IA" sub="Preencha os criterios do candidato ideal. Esses dados serao usados como contexto para o matching (e para a IA)." />
                            <div className="col-6 col-md-3"><Lbl>Modalidade</Lbl><EnumSelect value={d.matchingModalidade} onChange={v => upd({ matchingModalidade: v })} options={getOpts("vagaModalidade")} placeholder="Qualquer" /></div>
                            <div className="col-6 col-md-3"><Lbl>Senioridade</Lbl><EnumSelect value={d.matchingSenioridade} onChange={v => upd({ matchingSenioridade: v })} options={getOpts("vagaSenioridade")} placeholder="Qualquer" /></div>
                            <div className="col-6 col-md-3"><Lbl>Escolaridade</Lbl><EnumSelect value={d.matchingEscolaridade} onChange={v => upd({ matchingEscolaridade: v })} options={getOpts("vagaEscolaridade")} placeholder="Qualquer" /></div>
                            <div className="col-6 col-md-3"><Lbl>Formacao (area)</Lbl><EnumSelect value={d.matchingFormacaoArea} onChange={v => upd({ matchingFormacaoArea: v })} options={getOpts("vagaFormacaoArea")} placeholder="Qualquer" /></div>
                            <div className="col-6 col-md-3"><Lbl>Cidade</Lbl><input className="form-control" placeholder="Ex.: Sao Paulo" value={d.matchingCidade} onChange={e => upd({ matchingCidade: e.target.value })} /></div>
                            <div className="col-6 col-md-3"><Lbl>UF</Lbl><select className="form-select" value={d.matchingUF} onChange={e => upd({ matchingUF: e.target.value })}><option value="">Qualquer</option>{UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                            <div className="col-6 col-md-3"><Lbl>Tempo de experiencia</Lbl><select className="form-select" value={d.matchingExp} onChange={e => upd({ matchingExp: e.target.value })}>{EXP_OPTIONS.map(o => <option key={o.c} value={o.c}>{o.t}</option>)}</select></div>
                            <div className="col-6 col-md-3"><Lbl>Sexo</Lbl><select className="form-select" value={d.matchingSexo} onChange={e => upd({ matchingSexo: e.target.value })}>{SEXO_OPTIONS.map(o => <option key={o.c} value={o.c}>{o.t}</option>)}</select></div>
                            <div className="col-6 col-md-3"><Lbl>PCD</Lbl><select className="form-select" value={d.matchingPcd} onChange={e => upd({ matchingPcd: e.target.value })}>{PCD_OPTIONS.map(o => <option key={o.c} value={o.c}>{o.t}</option>)}</select></div>
                            <div className="col-6 col-md-2"><Lbl>Idade min.</Lbl><input type="number" className="form-control" min={14} max={100} placeholder="-" value={d.matchingIdadeMin} onChange={e => upd({ matchingIdadeMin: e.target.value })} /></div>
                            <div className="col-6 col-md-2"><Lbl>Idade max.</Lbl><input type="number" className="form-control" min={14} max={100} placeholder="-" value={d.matchingIdadeMax} onChange={e => upd({ matchingIdadeMax: e.target.value })} /></div>
                            <div className="col-12 col-md-4 d-flex align-items-end gap-2 flex-wrap pb-2">
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vMatchCnh" checked={d.matchingRequerCnh} onChange={e => upd({ matchingRequerCnh: e.target.checked })} /><label className="form-check-label small" htmlFor="vMatchCnh">Requer CNH</label></div>
                                {d.matchingRequerCnh && <div><Lbl>Categoria</Lbl><select className="form-select form-select-sm" style={{ width: "auto" }} value={d.matchingCnhCategoria} onChange={e => upd({ matchingCnhCategoria: e.target.value })}>{CNH_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
                            </div>
                            <div className="col-12"><Lbl>Habilidades desejadas</Lbl><input className="form-control" placeholder="Ex.: .NET, SQL, APIs REST (separadas por virgula)" value={d.matchingHabilidades} onChange={e => upd({ matchingHabilidades: e.target.value })} /></div>
                            <div className="col-12"><Lbl>Observacoes adicionais (opcional)</Lbl><textarea className="form-control" rows={2} placeholder="Outros criterios em texto livre" value={d.matchingObs} onChange={e => upd({ matchingObs: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Processo seletivo ── */}
                    {tab === "processo" && (
                        <div className="row g-2">
                            <div className="col-12 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                <div><div className="fw-semibold">Etapas do processo</div><div className="text-muted small">Defina responsaveis, modo e SLA.</div></div>
                                <button type="button" className="btn btn-outline-success btn-sm" onClick={() => upd({ etapas: [...d.etapas, { nome: "", responsavel: "", modo: "", slaDias: "", descricao: "" }] })}><i className="bi bi-plus-lg me-1" />Adicionar etapa</button>
                            </div>
                            {d.etapas.map((et, i) => (
                                <div key={i} className="col-12 card-soft p-2">
                                    <div className="d-flex justify-content-between"><span className="fw-semibold">Etapa {i + 1}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => upd({ etapas: d.etapas.filter((_, j) => j !== i) })}><i className="bi bi-trash3" /></button></div>
                                    <div className="row g-2 mt-1">
                                        <div className="col-12 col-md-4"><Lbl>Nome da etapa</Lbl><input className="form-control form-control-sm" placeholder="Ex.: Entrevista RH" value={et.nome} onChange={e => { const n = [...d.etapas]; n[i] = { ...n[i], nome: e.target.value }; upd({ etapas: n }); }} /></div>
                                        <div className="col-12 col-md-3"><Lbl>Responsavel</Lbl><input className="form-control form-control-sm" placeholder="Buscar gestor..." value={et.responsavel} onChange={e => { const n = [...d.etapas]; n[i] = { ...n[i], responsavel: e.target.value }; upd({ etapas: n }); }} /></div>
                                        <div className="col-6 col-md-2"><Lbl>Modo</Lbl><EnumSelect value={et.modo} onChange={v => { const n = [...d.etapas]; n[i] = { ...n[i], modo: v }; upd({ etapas: n }); }} options={getOpts("vagaEtapaModo")} /></div>
                                        <div className="col-6 col-md-3"><Lbl>SLA (dias)</Lbl><input className="form-control form-control-sm" placeholder="3" value={et.slaDias} onChange={e => { const n = [...d.etapas]; n[i] = { ...n[i], slaDias: e.target.value }; upd({ etapas: n }); }} /></div>
                                        <div className="col-12"><Lbl>Descricao / instrucoes</Lbl><input className="form-control form-control-sm" placeholder="Ex.: entrevista por competencias, 45min" value={et.descricao} onChange={e => { const n = [...d.etapas]; n[i] = { ...n[i], descricao: e.target.value }; upd({ etapas: n }); }} /></div>
                                    </div>
                                </div>
                            ))}
                            <div className="col-12 d-flex align-items-center justify-content-between gap-2 flex-wrap mt-1">
                                <div><div className="fw-semibold">Perguntas de triagem</div><div className="text-muted small">Knockout, peso e opcoes.</div></div>
                                <button type="button" className="btn btn-outline-success btn-sm" onClick={() => upd({ perguntas: [...d.perguntas, { pergunta: "", tipo: "", peso: "1", obrigatoria: false, knockout: false, opcoes: "" }] })}><i className="bi bi-plus-lg me-1" />Adicionar pergunta</button>
                            </div>
                            {d.perguntas.map((p, i) => (
                                <div key={i} className="col-12 card-soft p-2">
                                    <div className="d-flex justify-content-between"><span className="fw-semibold">Pergunta {i + 1}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => upd({ perguntas: d.perguntas.filter((_, j) => j !== i) })}><i className="bi bi-trash3" /></button></div>
                                    <div className="row g-2 mt-1">
                                        <div className="col-12"><Lbl>Pergunta</Lbl><input className="form-control form-control-sm" placeholder="Ex.: Tem disponibilidade para presencial 2x por semana?" value={p.pergunta} onChange={e => { const n = [...d.perguntas]; n[i] = { ...n[i], pergunta: e.target.value }; upd({ perguntas: n }); }} /></div>
                                        <div className="col-12 col-md-4"><Lbl>Tipo</Lbl><EnumSelect value={p.tipo} onChange={v => { const n = [...d.perguntas]; n[i] = { ...n[i], tipo: v }; upd({ perguntas: n }); }} options={getOpts("vagaPerguntaTipo")} /></div>
                                        <div className="col-6 col-md-2"><Lbl>Peso</Lbl><select className="form-select form-select-sm" value={p.peso} onChange={e => { const n = [...d.perguntas]; n[i] = { ...n[i], peso: e.target.value }; upd({ perguntas: n }); }}>{[1, 2, 3, 4, 5].map(w => <option key={w} value={String(w)}>{w}</option>)}</select></div>
                                        <div className="col-6 col-md-3"><Lbl>Obrigatoria?</Lbl><div className="form-check mt-1"><input className="form-check-input" type="checkbox" checked={p.obrigatoria} onChange={e => { const n = [...d.perguntas]; n[i] = { ...n[i], obrigatoria: e.target.checked }; upd({ perguntas: n }); }} /><label className="form-check-label">Sim</label></div></div>
                                        <div className="col-12 col-md-3"><Lbl>Knockout?</Lbl><div className="form-check mt-1"><input className="form-check-input" type="checkbox" checked={p.knockout} onChange={e => { const n = [...d.perguntas]; n[i] = { ...n[i], knockout: e.target.checked }; upd({ perguntas: n }); }} /><label className="form-check-label">Sim</label></div></div>
                                        <div className="col-12"><Lbl>Opcoes (separe por ;)</Lbl><input className="form-control form-control-sm" placeholder="Ex.: Sim;Nao;Talvez" value={p.opcoes} onChange={e => { const n = [...d.perguntas]; n[i] = { ...n[i], opcoes: e.target.value }; upd({ perguntas: n }); }} /></div>
                                    </div>
                                </div>
                            ))}
                            <div className="col-12"><Lbl>Observacoes internas do processo</Lbl><textarea className="form-control" rows={2} placeholder="Ex.: aprovacoes necessarias, criterios de corte" value={d.obsProcesso} onChange={e => upd({ obsProcesso: e.target.value })} /></div>
                        </div>
                    )}

                    {/* ── Publicacao ── */}
                    {tab === "publicacao" && (
                        <div className="row g-2">
                            <div className="col-12 col-md-4"><Lbl>Visibilidade</Lbl><EnumSelect value={d.visibilidade} onChange={v => upd({ visibilidade: v })} options={getOpts("vagaPublicacaoVisibilidade")} placeholder="Selecionar visibilidade" /></div>
                            <div className="col-12 col-md-4"><Lbl>Data de inicio</Lbl><input className="form-control" placeholder="dd/mm/aaaa" value={d.dataInicio} onChange={e => upd({ dataInicio: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Data de encerramento</Lbl><input className="form-control" placeholder="dd/mm/aaaa" value={d.dataFim} onChange={e => upd({ dataFim: e.target.value })} /></div>
                            <div className="col-12 col-md-4"><Lbl>Meta SLA (dias)</Lbl><input type="number" className="form-control" min={0} placeholder="Ex.: 30" value={d.slaDiasMeta} onChange={e => upd({ slaDiasMeta: e.target.value })} /></div>
                            <div className="col-12"><Lbl>Canais</Lbl>
                                <div className="row g-2">
                                    <div className="col-12 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="vCanalLin" checked={d.canalLinkedin} onChange={e => upd({ canalLinkedin: e.target.checked })} /><label className="form-check-label" htmlFor="vCanalLin">LinkedIn</label></div></div>
                                    <div className="col-12 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="vCanalSite" checked={d.canalSite} onChange={e => upd({ canalSite: e.target.checked })} /><label className="form-check-label" htmlFor="vCanalSite">Site/Carreiras</label></div></div>
                                    <div className="col-12 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="vCanalInd" checked={d.canalIndicacao} onChange={e => upd({ canalIndicacao: e.target.checked })} /><label className="form-check-label" htmlFor="vCanalInd">Indicacao</label></div></div>
                                    <div className="col-12 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="vCanalPortal" checked={d.canalPortal} onChange={e => upd({ canalPortal: e.target.checked })} /><label className="form-check-label" htmlFor="vCanalPortal">Portais de emprego</label></div></div>
                                </div>
                            </div>
                            <div className="col-12"><Lbl>Descricao publica</Lbl><textarea className="form-control" rows={4} placeholder="Inclua responsabilidades, requisitos e beneficios." value={d.descricaoPublica} onChange={e => upd({ descricaoPublica: e.target.value })} /></div>
                            <div className="col-12 col-md-6"><div className="card-soft p-2"><div className="fw-semibold mb-2">LGPD / Consentimentos</div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vLgpd1" checked={d.lgpdConsentimento} onChange={e => upd({ lgpdConsentimento: e.target.checked })} /><label className="form-check-label" htmlFor="vLgpd1">Solicitar consentimento explicito</label></div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vLgpd2" checked={d.lgpdCompartilhamento} onChange={e => upd({ lgpdCompartilhamento: e.target.checked })} /><label className="form-check-label" htmlFor="vLgpd2">Compartilhar curriculo internamente</label></div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vLgpd3" checked={d.lgpdRetencao} onChange={e => upd({ lgpdRetencao: e.target.checked })} /><label className="form-check-label" htmlFor="vLgpd3">Retencao por X meses</label></div>
                                <div className="mt-2"><Lbl>Prazo de retencao (meses)</Lbl><input className="form-control" placeholder="12" value={d.lgpdRetencaoMeses} onChange={e => upd({ lgpdRetencaoMeses: e.target.value })} /></div>
                            </div></div>
                            <div className="col-12 col-md-6"><div className="card-soft p-2"><div className="fw-semibold mb-2">Documentos / Exigencias</div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vDocCnh" checked={d.exigeCnh} onChange={e => upd({ exigeCnh: e.target.checked })} /><label className="form-check-label" htmlFor="vDocCnh">Exige CNH</label></div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vDocViag" checked={d.disponibilidadeViagens} onChange={e => upd({ disponibilidadeViagens: e.target.checked })} /><label className="form-check-label" htmlFor="vDocViag">Disponibilidade para viagens</label></div>
                                <div className="form-check"><input className="form-check-input" type="checkbox" id="vDocAnt" checked={d.checagemAntecedentes} onChange={e => upd({ checagemAntecedentes: e.target.checked })} /><label className="form-check-label" htmlFor="vDocAnt">Checagem de antecedentes</label></div>
                            </div></div>
                        </div>
                    )}

                    {/* ── Candidatos ── */}
                    {tab === "candidatos" && (
                        <div>
                            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                <div><div className="fw-semibold">Candidatos vinculados</div><div className="text-muted small">Disponivel apos salvar a vaga. Use Detalhes na lista para gerenciar candidatos.</div></div>
                            </div>
                            <div className="text-muted py-4 text-center">Os candidatos vinculados sao gerenciados pela tela de detalhes da vaga.</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 flex justify-end gap-2 border-t" style={{ borderColor: "var(--lt-border)" }}>
                    <button className="btn-ghost" type="button" onClick={onClose}><i className="bi bi-x-lg me-1" />Cancelar</button>
                    <button className="btn-brand" type="button" disabled={saving} onClick={() => void handleSave()}><i className="bi bi-check2 me-1" />Salvar vaga</button>
                </div>
            </div>
        </div>
    );
}
