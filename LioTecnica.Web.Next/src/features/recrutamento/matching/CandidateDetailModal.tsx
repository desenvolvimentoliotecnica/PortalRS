"use client";
import { useMemo } from "react";
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
}

export default function CandidateDetailModal({ item, candidatoFull, vagaDetail, tab, threshold, cvText, onCvTextChange, onClose, onRecalc, onApprove, onReject, onRestore, onPending, onSaveCv }: Props) {
    const matchResult: MatchResult | null = useMemo(() => {
        if (!vagaDetail || !candidatoFull) return null;
        return calcMatch(candidatoFull.cvText ?? "", vagaDetail.requisitos, vagaDetail.threshold);
    }, [vagaDetail, candidatoFull]);

    const pass = item.score >= threshold;
    const displayName = (candidatoFull?.nome || item.nome || "—").trim() || "—";
    const displayEmail = (candidatoFull?.email || item.email || "").trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}
                style={{ animation: "modalIn .22s ease-out" }}>

                {/* Header */}
                <div className="sticky top-0 z-10 bg-[rgb(var(--lt-primary))] text-white px-6 py-5 rounded-t-2xl">
                    <button type="button" className="absolute top-3 right-4 text-white/70 hover:text-white text-xl transition" onClick={onClose}>✕</button>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 text-white font-bold text-lg shrink-0">
                            {initials(displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xl font-extrabold leading-tight break-words">{displayName}</div>
                            <div className="text-white/90 text-sm break-all">{displayEmail}</div>
                            {candidatoFull?.updatedAt && <div className="text-white/60 text-xs mt-0.5">Atualizado: {new Date(candidatoFull.updatedAt).toLocaleString("pt-BR")}</div>}
                        </div>
                        <ScoreRing score={item.score} size={60} />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pass ? "bg-green-400/30 text-green-100" : "bg-amber-400/30 text-amber-100"}`}>
                            {item.score}% • {pass ? "Dentro" : "Abaixo"}
                        </span>
                        {item.source && <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${item.source === "talento" ? "bg-sky-400/30 text-sky-100" : "bg-white/20 text-white/90"}`}>{item.source === "talento" ? "Talento" : "Candidato"}</span>}
                        <span className="text-white/60 text-xs ml-auto">Mínimo: {threshold}%</span>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                        <button className="btn-brand text-sm py-2 px-4 rounded-xl" type="button" onClick={onRecalc}>🔄 Recalcular</button>
                        {tab === "suggestions" && <>
                            <button className="text-sm py-2 px-4 rounded-xl bg-green-600 text-white hover:bg-green-700 transition font-semibold" type="button" onClick={onApprove}>✅ Aprovar</button>
                            <button className="text-sm py-2 px-4 rounded-xl bg-red-500 text-white hover:bg-red-600 transition font-semibold" type="button" onClick={onReject}>✕ Reprovar</button>
                            <button className="text-sm py-2 px-4 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 transition font-semibold" type="button" onClick={onPending}>⏳ Pendente</button>
                        </>}
                        {tab === "approved" && <>
                            <button className="text-sm py-2 px-4 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition font-semibold" type="button" onClick={onRestore}>↩ Triagem</button>
                            <button className="text-sm py-2 px-4 rounded-xl bg-red-500 text-white hover:bg-red-600 transition font-semibold" type="button" onClick={onReject}>✕ Reprovar</button>
                        </>}
                        {tab === "rejected" && <button className="text-sm py-2 px-4 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition font-semibold" type="button" onClick={onRestore}>↩ Voltar p/ Triagem</button>}
                        {tab === "pending" && <>
                            <button className="text-sm py-2 px-4 rounded-xl bg-green-600 text-white hover:bg-green-700 transition font-semibold" type="button" onClick={onApprove}>✅ Aprovar</button>
                            <button className="text-sm py-2 px-4 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition font-semibold" type="button" onClick={onRestore}>↩ Triagem</button>
                            <button className="text-sm py-2 px-4 rounded-xl bg-red-500 text-white hover:bg-red-600 transition font-semibold" type="button" onClick={onReject}>✕ Reprovar</button>
                        </>}
                    </div>

                    {/* Score breakdown */}
                    {matchResult && (
                        <div className="rounded-xl border border-[rgba(16,82,144,.12)] bg-[rgba(16,82,144,.03)] p-4">
                            <div className="font-bold text-sm mb-3">Composição do Score (IA)</div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                                <div className="text-muted-foreground">Score filtros</div><div className="text-right font-semibold">{Math.round(item.scoreFiltros ?? 0)}%</div>
                                <div className="text-muted-foreground">Score requisitos</div><div className="text-right font-semibold">{Math.round(item.scoreRequisitos ?? 0)}%</div>
                                <div className="text-muted-foreground">Cobertura obrigatórios</div><div className="text-right font-semibold">{Math.round(item.mandatoryCoverage ?? 100)}%</div>
                                <div className="text-muted-foreground">Obrigatórios faltando</div><div className="text-right font-semibold">{Math.round(item.missingMandatoryCount ?? 0)}</div>
                                <div className="text-muted-foreground">Penalidade rígida</div><div className="text-right font-semibold">-{Math.round(item.hardPenalty ?? 0)}</div>
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
                                                <span className="font-semibold">{isHit ? "✅" : isMiss ? "❌" : "➖"} {r.termo}</span>
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
                        <textarea className="form-control w-full text-sm" rows={5} value={cvText} onChange={e => onCvTextChange(e.target.value)} />
                        <button className="btn-ghost text-xs mt-1" type="button" onClick={onSaveCv}>💾 Salvar texto do CV</button>
                    </div>
                </div>
            </div>
        </div >
    );
}
