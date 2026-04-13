"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Save, Settings2 } from "lucide-react";

/* ──────────────────────────── types ──────────────────────────── */

interface TenantConfiguracaoDto {
    rhDeveAprovarAposGestor: boolean;
    aprovadorRhId: string | null;
    aprovadorRhNome: string | null;
}

interface LookupItem {
    id: string;
    name: string;
}

/* ──────────────────────────── AutocompleteSelect ──────────────────────────── */

function AutocompleteSelect({
    items,
    value,
    onChange,
    placeholder,
}: {
    items: LookupItem[];
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder: string;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = items.find((i) => i.id === value) ?? null;
    const displayText = selected?.name ?? "";
    const filtered = query.trim()
        ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
        : items;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false); setQuery("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div className="flex gap-1">
                <input
                    className="h-9 flex-1 rounded-md border border-input px-3 text-sm bg-background"
                    placeholder={`Buscar ${placeholder}...`}
                    value={open ? query : displayText}
                    onFocus={() => { setOpen(true); setQuery(""); }}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {value && (
                    <button type="button" onClick={() => { onChange(null); setQuery(""); }} className="px-2 text-muted-foreground hover:text-foreground text-xs" tabIndex={-1}>✕</button>
                )}
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                    ) : (
                        filtered.slice(0, 80).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); onChange(item.id); setOpen(false); setQuery(""); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${item.id === value ? "bg-muted font-medium" : ""}`}
                            >
                                {item.name}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function TenantConfiguracaoScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rhDeveAprovar, setRhDeveAprovar] = useState(false);
    const [aprovadorRhId, setAprovadorRhId] = useState<string | null>(null);
    const [funcionarios, setFuncionarios] = useState<LookupItem[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, funcsRes] = await Promise.all([
                apiFetch("/api/tenant-configuracao").then((r) => r.json() as Promise<TenantConfiguracaoDto>),
                apiFetch("/api/lookup/funcionarios?pageSize=200").then((r) => r.json()),
            ]);
            setRhDeveAprovar(configRes.rhDeveAprovarAposGestor ?? false);
            setAprovadorRhId(configRes.aprovadorRhId ?? null);

            const items = Array.isArray(funcsRes)
                ? funcsRes
                : Array.isArray(funcsRes?.items)
                    ? (funcsRes.items as { id: string; nome: string }[]).map((f) => ({ id: f.id, name: f.nome }))
                    : [];
            setFuncionarios(items as LookupItem[]);
        } catch {
            toast.error("Falha ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function save() {
        setSaving(true);
        try {
            const res = await apiFetch("/api/tenant-configuracao", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rhDeveAprovarAposGestor: rhDeveAprovar,
                    aprovadorRhId: aprovadorRhId || null,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success("Configurações salvas.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Settings2 className="size-5 text-muted-foreground" />
                    Configurações de Aprovação
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Defina como funciona o fluxo de aprovação de requisições de pessoal.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                </div>
            ) : (
                <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6">
                    {/* Toggle principal */}
                    <div className="flex items-start gap-4">
                        <div className="mt-0.5">
                            <input
                                id="rh-aprovar"
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={rhDeveAprovar}
                                onChange={(e) => setRhDeveAprovar(e.target.checked)}
                            />
                        </div>
                        <div>
                            <label htmlFor="rh-aprovar" className="text-sm font-medium cursor-pointer">
                                RH deve aprovar após aprovação dos gestores
                            </label>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                Quando ativado, após a aprovação pelos gestores na cadeia hierárquica, a solicitação
                                passa por uma etapa adicional de aprovação pelo RH antes de gerar a vaga.
                                Este fluxo é similar ao processo configurável do SuccessFactors.
                            </p>
                        </div>
                    </div>

                    {/* Aprovador RH — só aparece se a opção está ativa */}
                    {rhDeveAprovar && (
                        <div className="pl-8 space-y-2 border-l-2 border-primary/20 ml-2">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Aprovador RH responsável
                            </label>
                            <AutocompleteSelect
                                items={funcionarios}
                                value={aprovadorRhId}
                                onChange={setAprovadorRhId}
                                placeholder="funcionário"
                            />
                            <p className="text-xs text-muted-foreground">
                                Deixe em branco para que qualquer admin ou recrutador possa aprovar.
                            </p>
                        </div>
                    )}

                    {/* Resumo do fluxo */}
                    <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground text-sm mb-2">Fluxo de aprovação</p>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px]">1</span>
                            <span>Gestor cria a requisição de pessoal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-mono text-[10px]">2</span>
                            <span>Aprovação pela cadeia de gestores (Aprovador 1 / Aprovador 2)</span>
                        </div>
                        {rhDeveAprovar && (
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-amber-500/20 text-amber-700 px-2 py-0.5 font-mono text-[10px]">3</span>
                                <span className="text-amber-700 font-medium">Aprovação pelo RH{aprovadorRhId ? ` (${funcionarios.find(f => f.id === aprovadorRhId)?.name ?? "…"})` : " (qualquer recrutador)"}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${rhDeveAprovar ? "bg-primary/10 text-primary" : "bg-emerald-500/15 text-emerald-700"}`}>
                                {rhDeveAprovar ? "4" : "3"}
                            </span>
                            <span>Vaga gerada em rascunho → Fila de Análise RH em <code className="text-[10px]">/vagas</code></span>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => void save()} disabled={saving}>
                            <Save className="size-4 mr-1.5" />
                            {saving ? "Salvando…" : "Salvar configurações"}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
