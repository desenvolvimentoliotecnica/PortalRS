"use client";
import { useMemo, useState } from "react";
import { type VagaDetail, type ParsedFiltros, parseMatchingFiltrosRaw, MODALIDADE_OPTIONS, SENIORIDADE_OPTIONS, ESCOLARIDADE_OPTIONS, TEMPO_EXP_OPTIONS, UF_LIST } from "./matchingHelpers";

export default function FilterModal({ vagaDetail, onClose, onSave }: { vagaDetail: VagaDetail; onClose: () => void; onSave: (raw: string | null) => void }) {
    const parsed = useMemo(() => parseMatchingFiltrosRaw(vagaDetail.matchingFiltrosRaw ?? ""), [vagaDetail]);
    const [f, setF] = useState<ParsedFiltros>(parsed);
    const up = <K extends keyof ParsedFiltros>(k: K, v: ParsedFiltros[K]) => setF(prev => ({ ...prev, [k]: v }));

    function buildRaw(): string | null {
        const parts: string[] = [];
        const ml = MODALIDADE_OPTIONS.find(x => x.code === f.modalidade)?.label ?? f.modalidade;
        const tl = TEMPO_EXP_OPTIONS.find(x => x.code === f.tempoExp)?.label ?? f.tempoExp;
        if (f.modalidade) parts.push(`Modalidade: ${ml}`);
        if (f.senioridade) parts.push(`Senioridade: ${f.senioridade}`);
        if (f.escolaridade) parts.push(`Escolaridade: ${f.escolaridade}`);
        if (f.formacaoArea) parts.push(`Formacao: ${f.formacaoArea}`);
        if (f.cidade) parts.push(`Cidade: ${f.cidade}`);
        if (f.uf) parts.push(`UF: ${f.uf}`);
        if (f.tempoExp) parts.push(`TempoExperiencia: ${tl}`);
        if (f.sexo) parts.push(`Sexo: ${f.sexo === "M" ? "Masculino" : f.sexo === "F" ? "Feminino" : "Outro / Não informar"}`);
        if (f.pcd) parts.push(`PCD: ${f.pcd === "S" ? "Sim" : "Nao"}`);
        if (f.idadeMin) parts.push(`IdadeMin: ${f.idadeMin}`);
        if (f.idadeMax) parts.push(`IdadeMax: ${f.idadeMax}`);
        if (f.requerCnh) parts.push("RequerCNH: Sim");
        if (f.requerCnh && f.cnhCategoria) parts.push(`CategoriaCNH: ${f.cnhCategoria}`);
        if (f.habilidades) parts.push(`Habilidades: ${f.habilidades}`);
        if (f.observacoes) parts.push(`Observacoes: ${f.observacoes}`);
        return parts.length ? parts.join(". ") : null;
    }

    const sel = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
    const inp = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-background rounded-2xl border border-border shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b px-5 py-3">
                    <div className="font-bold">Filtros de matching (IA)</div>
                    <button type="button" className="size-7 flex items-center justify-center rounded opacity-50 hover:opacity-100 transition text-sm" onClick={onClose}>✕</button>
                </div>
                <div className="px-5 py-4">
                    <div className="font-semibold text-sm">Regras de matching por IA</div>
                    <div className="text-muted-foreground text-xs mb-4">Preencha os critérios do candidato ideal.</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className="text-xs text-muted-foreground">Modalidade</label><select className={sel} value={f.modalidade} onChange={e => up("modalidade", e.target.value)}><option value="">Qualquer</option>{MODALIDADE_OPTIONS.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}</select></div>
                        <div><label className="text-xs text-muted-foreground">Senioridade</label><select className={sel} value={f.senioridade} onChange={e => up("senioridade", e.target.value)}><option value="">Qualquer</option>{SENIORIDADE_OPTIONS.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
                        <div><label className="text-xs text-muted-foreground">Escolaridade</label><select className={sel} value={f.escolaridade} onChange={e => up("escolaridade", e.target.value)}><option value="">Qualquer</option>{ESCOLARIDADE_OPTIONS.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
                        <div><label className="text-xs text-muted-foreground">Formação</label><input className={inp} value={f.formacaoArea} onChange={e => up("formacaoArea", e.target.value)} placeholder="Ex.: Engenharia" /></div>
                        <div><label className="text-xs text-muted-foreground">Cidade</label><input className={inp} value={f.cidade} onChange={e => up("cidade", e.target.value)} placeholder="Ex.: São Paulo" /></div>
                        <div><label className="text-xs text-muted-foreground">UF</label><select className={sel} value={f.uf} onChange={e => up("uf", e.target.value)}><option value="">Qualquer</option>{UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                        <div><label className="text-xs text-muted-foreground">Tempo experiência</label><select className={sel} value={f.tempoExp} onChange={e => up("tempoExp", e.target.value)}><option value="">Qualquer</option>{TEMPO_EXP_OPTIONS.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}</select></div>
                        <div><label className="text-xs text-muted-foreground">Sexo</label><select className={sel} value={f.sexo} onChange={e => up("sexo", e.target.value)}><option value="">Qualquer</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="O">Outro</option></select></div>
                        <div><label className="text-xs text-muted-foreground">PCD</label><select className={sel} value={f.pcd} onChange={e => up("pcd", e.target.value)}><option value="">Qualquer</option><option value="S">Sim</option><option value="N">Não</option></select></div>
                        <div><label className="text-xs text-muted-foreground">Idade min.</label><input type="number" className={inp} value={f.idadeMin} onChange={e => up("idadeMin", e.target.value)} min={14} max={100} placeholder="-" /></div>
                        <div><label className="text-xs text-muted-foreground">Idade max.</label><input type="number" className={inp} value={f.idadeMax} onChange={e => up("idadeMax", e.target.value)} min={14} max={100} placeholder="-" /></div>
                        <div className="flex items-end gap-2 pb-1">
                            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.requerCnh} onChange={e => up("requerCnh", e.target.checked)} /> Requer CNH</label>
                            {f.requerCnh && <select className={sel} style={{ width: "auto" }} value={f.cnhCategoria} onChange={e => up("cnhCategoria", e.target.value)}>{["A", "B", "AB", "C", "D", "E"].map(c => <option key={c} value={c}>{c}</option>)}</select>}
                        </div>
                    </div>
                    <div className="mt-3"><label className="text-xs text-muted-foreground">Habilidades desejadas</label><input className={inp} value={f.habilidades} onChange={e => up("habilidades", e.target.value)} placeholder="Ex.: .NET, SQL (separadas por vírgula)" /></div>
                    <div className="mt-3"><label className="text-xs text-muted-foreground">Observações</label><textarea className={`${inp} resize-none`} rows={2} value={f.observacoes} onChange={e => up("observacoes", e.target.value)} placeholder="Outros critérios" /></div>
                </div>
                <div className="flex justify-end gap-2 border-t px-5 py-3">
                    <button type="button" className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors" onClick={onClose}>Cancelar</button>
                    <button type="button" className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" onClick={() => onSave(buildRaw())}>Salvar</button>
                </div>
            </div>
        </div>
    );
}
