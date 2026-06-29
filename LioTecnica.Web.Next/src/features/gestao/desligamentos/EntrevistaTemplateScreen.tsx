"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    getTemplateAtivo,
    upsertTemplateAtivo,
    type TemplatePergunta,
} from "./entrevistaSaidaApi";

const TIPO_OPCOES = [
    { value: "Texto", label: "Texto livre" },
    { value: "Escala", label: "Escala (1-10)" },
    { value: "MultiplaEscolha", label: "Múltipla escolha" },
];

function emptyPergunta(ordem: number): TemplatePergunta {
    return {
        ordem,
        texto: "",
        tipoResposta: "Texto",
        opcoes: null,
        obrigatoria: false,
    };
}

export default function EntrevistaTemplateScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [nome, setNome] = useState("Entrevista de saída padrão");
    const [perguntas, setPerguntas] = useState<TemplatePergunta[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const template = await getTemplateAtivo();
            if (template) {
                setNome(template.nome);
                setPerguntas(template.perguntas.map((p) => ({ ...p })));
            } else {
                setPerguntas([
                    emptyPergunta(1),
                    { ...emptyPergunta(2), tipoResposta: "Escala", obrigatoria: true },
                ]);
            }
        } catch (e) {
            toast.error(`Falha ao carregar template: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    function updatePergunta(index: number, patch: Partial<TemplatePergunta>) {
        setPerguntas((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    }

    function addPergunta() {
        setPerguntas((prev) => [...prev, emptyPergunta(prev.length + 1)]);
    }

    function removePergunta(index: number) {
        setPerguntas((prev) =>
            prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, ordem: i + 1 })),
        );
    }

    async function save() {
        if (!nome.trim()) {
            toast.error("Informe o nome do questionário.");
            return;
        }
        if (perguntas.some((p) => !p.texto.trim())) {
            toast.error("Todas as perguntas precisam de texto.");
            return;
        }

        setSaving(true);
        try {
            await upsertTemplateAtivo({
                nome: nome.trim(),
                perguntas: perguntas.map((p, i) => ({
                    ...p,
                    ordem: i + 1,
                    opcoes:
                        p.tipoResposta === "MultiplaEscolha" && p.opcoes
                            ? p.opcoes
                            : null,
                })),
            });
            toast.success("Questionário salvo com sucesso.");
            await load();
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
                        <Link href="/gestao/desligamentos">
                            <ArrowLeft className="size-4 mr-1" />
                            Voltar aos desligamentos
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-semibold tracking-tight">Questionário de entrevista de saída</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Configure as perguntas enviadas ao colaborador no desligamento.
                    </p>
                </div>
                <Button onClick={() => void save()} disabled={saving || loading}>
                    <Save className="size-4" />
                    {saving ? "Salvando…" : "Salvar questionário"}
                </Button>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 space-y-4">
                <div>
                    <label className="text-sm font-medium">Nome do questionário</label>
                    <Input
                        className="mt-1 max-w-lg"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        disabled={loading}
                    />
                </div>

                {loading ? (
                    <div className="text-muted-foreground text-sm py-8 text-center">Carregando…</div>
                ) : (
                    <div className="space-y-3">
                        {perguntas.map((p, index) => (
                            <div key={index} className="rounded-lg border border-border/50 p-3 space-y-2 bg-background/60">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground">Pergunta {index + 1}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => removePergunta(index)}
                                        disabled={perguntas.length <= 1}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                                <Input
                                    placeholder="Texto da pergunta"
                                    value={p.texto}
                                    onChange={(e) => updatePergunta(index, { texto: e.target.value })}
                                />
                                <div className="flex flex-wrap gap-2 items-center">
                                    <select
                                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                        value={p.tipoResposta}
                                        onChange={(e) =>
                                            updatePergunta(index, {
                                                tipoResposta: e.target.value,
                                                opcoes: e.target.value === "MultiplaEscolha" ? [""] : null,
                                            })
                                        }
                                    >
                                        {TIPO_OPCOES.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    <label className="inline-flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={p.obrigatoria}
                                            onChange={(e) => updatePergunta(index, { obrigatoria: e.target.checked })}
                                        />
                                        Obrigatória
                                    </label>
                                </div>
                                {p.tipoResposta === "MultiplaEscolha" && (
                                    <Input
                                        placeholder="Opções separadas por ponto e vírgula (;)"
                                        value={(p.opcoes ?? []).join(";")}
                                        onChange={(e) =>
                                            updatePergunta(index, {
                                                opcoes: e.target.value
                                                    .split(";")
                                                    .map((s) => s.trim())
                                                    .filter(Boolean),
                                            })
                                        }
                                    />
                                )}
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addPergunta}>
                            <Plus className="size-4" />
                            Adicionar pergunta
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
