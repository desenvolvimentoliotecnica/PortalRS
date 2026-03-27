"use client";
import { useMemo, useState } from "react";
import { Check, X, Clock, RotateCcw, Mail, MessageCircle, Linkedin } from "lucide-react";
import { type RankItem, type VagaDetail, type CandidatoFull, type MatchResult, type TabKey, calcMatch, initials } from "./matchingHelpers";

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
    const r = (size - 6) / 2, circ = 2 * Math.PI * r, offset = circ - (score / 100) * circ;
    const color = score >= 60 ? "#16a34a" : score >= 30 ? "#eab308" : "#dc2626";
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={4} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-700" />
            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="text-[0.7rem] font-bold" fill={color}>{score}%</text>
        </svg>
    );
}

interface Props {
    item: RankItem;
    candidatoFull: CandidatoFull | null;
    vagaDetail: VagaDetail | null;
    tab: TabKey;
    threshold: number;
    cvText: string;
    onCvTextChange: (v: string) => void;
    onClose: () => void;
    onRecalc: () => void;
    onApprove: () => void;
    onReject: () => void;
    onRestore: () => void;
    onPending: () => void;
    onSaveCv: () => void;
    onUpdateObs?: (obs: string) => void;
}

export default function CandidateDetailModal({ item, candidatoFull, vagaDetail, tab, threshold, cvText, onCvTextChange, onClose, onRecalc, onApprove, onReject, onRestore, onPending, onSaveCv, onUpdateObs }: Props) {
    const matchResult: MatchResult | null = useMemo(() => {
        if (!vagaDetail || !candidatoFull) return null;
        return calcMatch(candidatoFull.cvText ?? "", vagaDetail.requisitos, vagaDetail.threshold);
    }, [vagaDetail, candidatoFull]);

    const [obsLocal, setObsLocal] = useState(item.obs || "");

    const pass = item.score >= threshold;
    const displayName = (candidatoFull?.nome || item.nome || "—").trim() || "—";
    const displayEmail = (candidatoFull?.email || item.email || "").trim();
    const cidadeUf = [candidatoFull?.cidade || item.cidade, candidatoFull?.uf || item.uf].filter(Boolean).join("/");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-background rounded-2xl border border-border shadow-2xl max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 rounded-t-2xl">
                    <button type="button" className="absolute top-3 right-4 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors" onClick={onClose}><X className="size-4" /></button>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                            {initials(displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold leading-tight break-words">{displayName}</div>
                            <div className="text-muted-foreground text-sm break-all">{displayEmail}</div>
                        </div>
                        <ScoreRing score={item.score} size={52} />
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${pass ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {item.score}% • {pass ? "Dentro do corte" : "Abaixo do corte"}
                        </span>
                        {item.source && <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium border border-border bg-muted text-muted-foreground">{item.source === "talento" ? "Talento" : "Candidato"}</span>}
                        <span className="text-muted-foreground text-xs ml-auto">Mínimo: {threshold}%</span>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                        <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-border bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors" type="button" onClick={onRecalc}>Recalcular IA</button>
                        {tab === "suggestions" && <>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors" type="button" onClick={onApprove}><Check className="size-3.5" /> Aprovar</button>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors" type="button" onClick={onReject}><X className="size-3.5" /> Reprovar</button>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors" type="button" onClick={onPending}><Clock className="size-3.5" /> Pendente</button>
                        </>}
                        {tab === "approved" && <>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-border bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors" type="button" onClick={onRestore}><RotateCcw className="size-3.5" /> Triagem</button>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors" type="button" onClick={onReject}><X className="size-3.5" /> Reprovar</button>
                        </>}
                        {tab === "rejected" && <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-border bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors" type="button" onClick={onRestore}><RotateCcw className="size-3.5" /> Voltar p/ Triagem</button>}
                        {tab === "pending" && <>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors" type="button" onClick={onApprove}><Check className="size-3.5" /> Aprovar</button>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-border bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors" type="button" onClick={onRestore}><RotateCcw className="size-3.5" /> Triagem</button>
                            <button className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium transition-colors" type="button" onClick={onReject}><X className="size-3.5" /> Reprovar</button>
                        </>}
                    </div>

                    {/* Candidate Info */}
                    <div className="rounded-xl border border-border/60 bg-slate-50/50 p-4 grid grid-cols-2 gap-3 text-sm">
                        {cidadeUf && <div><span className="text-muted-foreground text-xs block">Cidade/UF</span><span className="font-medium">{cidadeUf}</span></div>}
                        <div>
                            <span className="text-muted-foreground text-xs block">Trabalhando?</span>
                            <span className="font-medium">{(candidatoFull?.trabalhando ?? item.trabalhando) === true ? "Sim" : (candidatoFull?.trabalhando ?? item.trabalhando) === false ? "Não" : "—"}</span>
                        </div>
                        {item.source && <div><span className="text-muted-foreground text-xs block">Fonte</span><span className="font-medium">{item.source === "talento" ? "Talento" : "Candidato"}</span></div>}
                        <div>
                            <span className="text-muted-foreground text-xs block">Contato direto</span>
                            <div className="flex gap-2 mt-0.5">
                                {displayEmail && <a href={`mailto:${displayEmail}`} className="inline-flex items-center gap-1 text-sm hover:underline text-blue-600" title="Email"><Mail className="size-3.5" /> Email</a>}
                                {(candidatoFull?.fone || item.fone) && <a href={`https://wa.me/${(candidatoFull?.fone || item.fone || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline text-green-600" title="WhatsApp"><MessageCircle className="size-3.5" /> WhatsApp</a>}
                                {(candidatoFull?.linkedinUrl || item.linkedinUrl) && <a href={candidatoFull?.linkedinUrl || item.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline text-blue-700" title="LinkedIn"><Linkedin className="size-3.5" /> LinkedIn</a>}
                            </div>
                        </div>
                    </div>

                    {/* Observação */}
                    <div>
                        <div className="font-bold text-sm mb-1">Observação</div>
                        <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} value={obsLocal} onChange={e => setObsLocal(e.target.value)} placeholder="Adicionar observação sobre o candidato..." />
                        {onUpdateObs && obsLocal !== (item.obs || "") && (
                            <button className="text-xs mt-1 text-muted-foreground hover:text-foreground transition-colors" type="button" onClick={() => onUpdateObs(obsLocal)}>Salvar observação</button>
                        )}
                    </div>

                    {/* Score breakdown */}
                    {matchResult && (
                        <div className="rounded-xl border border-[rgba(16,82,144,.12)] bg-[rgba(16,82,144,.03)] p-4">
                            <div className="font-bold text-sm mb-3">Composição do Score (IA)</div>
                            <div className="space-y-2.5">
                                {([
                                    { label: "Competência", score: item.scoreCompetencia ?? 0, peso: vagaDetail?.weightsCompetencia ?? 40 },
                                    { label: "Experiência", score: item.scoreExperiencia ?? 0, peso: vagaDetail?.weightsExperiencia ?? 30 },
                                    { label: "Formação", score: item.scoreFormacao ?? 0, peso: vagaDetail?.weightsFormacao ?? 15 },
                                    { label: "Localidade", score: item.scoreLocalidade ?? 0, peso: vagaDetail?.weightsLocalidade ?? 15 },
                                ] as const).map(dim => (
                                    <div key={dim.label}>
                                        <div className="flex justify-between text-sm mb-0.5">
                                            <span className="text-muted-foreground">{dim.label} <span className="text-xs opacity-60">(peso {dim.peso})</span></span>
                                            <span className="font-semibold">{Math.round(dim.score)}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${Math.round(dim.score)}%`,
                                                    backgroundColor: dim.score >= 60 ? "#16a34a" : dim.score >= 30 ? "#eab308" : "#dc2626",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-[rgba(16,82,144,.1)] grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                <div className="text-muted-foreground">Cobertura obrigatórios</div><div className="text-right font-semibold">{Math.round(item.mandatoryCoverage ?? 100)}%</div>
                                <div className="text-muted-foreground">Obrigatórios faltando</div><div className="text-right font-semibold">{Math.round(item.missingMandatoryCount ?? 0)}</div>
                                {(item.hardPenalty ?? 0) > 0 && <><div className="text-muted-foreground">Penalidade rígida</div><div className="text-right font-semibold text-red-600">-{Math.round(item.hardPenalty ?? 0)}</div></>}
                            </div>
                            {item.justificativa && <div className="text-muted-foreground text-xs mt-3 border-t pt-2"><span className="font-semibold">Justificativa IA:</span> {item.justificativa}</div>}
                        </div>
                    )}

                    {/* Requirements */}
                    {vagaDetail && vagaDetail.requisitos.length > 0 && matchResult && (
                        <div>
                            <div className="font-bold text-sm mb-2">Requisitos ({matchResult.hits.length}/{vagaDetail.requisitos.length} encontrados)</div>
                            <div className="grid gap-2">
                                {vagaDetail.requisitos.map(r => {
                                    const isHit = matchResult.hits.some(h => h.id === r.id);
                                    const isMiss = matchResult.missMandatory.some(m => m.id === r.id);
                                    return (
                                        <div key={r.id} className={`rounded-lg border p-2.5 text-sm flex items-center justify-between gap-2 ${isHit ? "border-green-200 bg-green-50" : isMiss ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                                            <div>
                                                <span className="font-semibold">{r.termo}</span>
                                                <span className="text-muted-foreground text-xs ml-2">Peso: {r.peso} • {r.obrigatorio ? <span className="text-red-600 font-semibold">obrigatório</span> : "desejável"}</span>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${isHit ? "bg-green-200 text-green-800" : isMiss ? "bg-red-200 text-red-800" : "bg-gray-200 text-gray-600"}`}>{isHit ? "OK" : isMiss ? "Faltando" : "Não achou"}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Resumo */}
                    {candidatoFull?.resumoProfissional?.trim() && (
                        <div>
                            <div className="font-bold text-sm mb-1">Resumo profissional</div>
                            <div className="text-muted-foreground text-sm">{candidatoFull.resumoProfissional}</div>
                        </div>
                    )}

                    {/* Docs */}
                    {candidatoFull?.documentos && candidatoFull.documentos.length > 0 && (
                        <div>
                            <div className="font-bold text-sm mb-1">Documentos</div>
                            {candidatoFull.documentos.map((d, i) => {
                                const name = d.nome ?? d.fileName ?? "Documento";
                                const link = d.url ?? d.link;
                                return link ? <a key={i} href={link} target="_blank" rel="noopener" className="block text-sm text-blue-600 hover:underline">{name}</a> : <div key={i} className="text-sm text-muted-foreground">{name}</div>;
                            })}
                        </div>
                    )}

                    {/* CV text */}
                    <div>
                        <div className="font-bold text-sm mb-1">Texto do CV</div>
                        <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={5} value={cvText} onChange={e => onCvTextChange(e.target.value)} />
                        <button className="text-xs mt-1 text-muted-foreground hover:text-foreground transition-colors" type="button" onClick={onSaveCv}>Salvar texto do CV</button>
                    </div>
                </div>
            </div>
        </div >
    );
}
