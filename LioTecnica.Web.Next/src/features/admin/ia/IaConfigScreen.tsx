"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Save, Sparkles, Network } from "lucide-react";

/* ────────── types ────────── */

interface TenantAiConfigDto {
    llmProvider: string | null;
    llmModel: string | null;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    knownProviders: string[];
    effectiveLlmProvider: string;
    effectiveLlmModel: string;
    effectiveEmbeddingProvider: string;
    effectiveEmbeddingModel: string;
}

const PROVIDER_OPTIONS = [
    { value: "", label: "Usar padrão global" },
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Google Gemini" },
    { value: "anthropic", label: "Anthropic Claude" },
    { value: "ollama", label: "Ollama (local)" },
];

const MODEL_PLACEHOLDERS: Record<string, string> = {
    openai: "ex.: gpt-4o-mini, gpt-4o",
    gemini: "ex.: gemini-2.5-flash, gemini-2.5-pro",
    anthropic: "ex.: claude-3-5-sonnet-20241022, claude-3-5-haiku",
    ollama: "ex.: qwen2.5:7b, llama3.1:8b",
};

const EMBEDDING_MODEL_PLACEHOLDERS: Record<string, string> = {
    openai: "ex.: text-embedding-3-small (1536d), text-embedding-3-large (3072d)",
    gemini: "ex.: models/gemini-embedding-001 (3072d)",
    anthropic: "Anthropic não fornece embeddings — use OpenAI/Gemini/Ollama",
    ollama: "ex.: bge-m3 (1024d), nomic-embed-text (768d)",
};

/* ────────── component ────────── */

export default function IaConfigScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [llmProvider, setLlmProvider] = useState<string>("");
    const [llmModel, setLlmModel] = useState<string>("");
    const [embeddingProvider, setEmbeddingProvider] = useState<string>("");
    const [embeddingModel, setEmbeddingModel] = useState<string>("");

    const [effective, setEffective] = useState<{
        llmProvider: string;
        llmModel: string;
        embeddingProvider: string;
        embeddingModel: string;
    } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/tenant-configuracao/ai");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dto = (await res.json()) as TenantAiConfigDto;
            setLlmProvider(dto.llmProvider ?? "");
            setLlmModel(dto.llmModel ?? "");
            setEmbeddingProvider(dto.embeddingProvider ?? "");
            setEmbeddingModel(dto.embeddingModel ?? "");
            setEffective({
                llmProvider: dto.effectiveLlmProvider,
                llmModel: dto.effectiveLlmModel,
                embeddingProvider: dto.effectiveEmbeddingProvider,
                embeddingModel: dto.effectiveEmbeddingModel,
            });
        } catch (e) {
            toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function save() {
        setSaving(true);
        try {
            const res = await apiFetch("/api/tenant-configuracao/ai", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    llmProvider: llmProvider.trim() || null,
                    llmModel: llmModel.trim() || null,
                    embeddingProvider: embeddingProvider.trim() || null,
                    embeddingModel: embeddingModel.trim() || null,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dto = (await res.json()) as TenantAiConfigDto;
            setEffective({
                llmProvider: dto.effectiveLlmProvider,
                llmModel: dto.effectiveLlmModel,
                embeddingProvider: dto.effectiveEmbeddingProvider,
                embeddingModel: dto.effectiveEmbeddingModel,
            });
            toast.success("Configuração de IA salva.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Brain className="size-5 text-muted-foreground" />
                    Configuração de IA
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Escolha o provider de LLM (chat) e de embeddings deste tenant.
                    Quando vazio, herda o padrão global do servidor.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                </div>
            ) : (
                <div className="space-y-10">
                    {/* ── LLM (chat) ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">LLM (chat)</h2>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6 max-w-2xl">
                            <div className="space-y-2">
                                <Label htmlFor="llmProvider">Provider</Label>
                                <select
                                    id="llmProvider"
                                    value={llmProvider}
                                    onChange={(e) => setLlmProvider(e.target.value)}
                                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                                >
                                    {PROVIDER_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Usado para extração de CV, geração de descrição de cargo, sugestão salarial,
                                    assistente RH e LLM scoring no matching.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="llmModel">Modelo (opcional — vazio = default do provider)</Label>
                                <Input
                                    id="llmModel"
                                    type="text"
                                    placeholder={MODEL_PLACEHOLDERS[llmProvider] ?? "vazio = default global"}
                                    value={llmModel}
                                    onChange={(e) => setLlmModel(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Embeddings ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Network className="size-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">Embeddings</h2>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6 max-w-2xl">
                            <div className="space-y-2">
                                <Label htmlFor="embeddingProvider">Provider</Label>
                                <select
                                    id="embeddingProvider"
                                    value={embeddingProvider}
                                    onChange={(e) => setEmbeddingProvider(e.target.value)}
                                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                                >
                                    {PROVIDER_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Usado para busca semântica (matching vetorial pré-filtro).
                                    A coluna <code>Embedding</code> nas tabelas é <code>vector(1024)</code>;
                                    providers que geram outras dimensões podem requerer ajuste.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="embeddingModel">Modelo (opcional)</Label>
                                <Input
                                    id="embeddingModel"
                                    type="text"
                                    placeholder={EMBEDDING_MODEL_PLACEHOLDERS[embeddingProvider] ?? "vazio = default global"}
                                    value={embeddingModel}
                                    onChange={(e) => setEmbeddingModel(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Effective ── */}
                    {effective && (
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-5 max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                Em uso agora (após resolução de fallbacks)
                            </p>
                            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">LLM provider</dt>
                                <dd className="font-medium">{effective.llmProvider}</dd>
                                <dt className="text-muted-foreground">LLM model</dt>
                                <dd className="font-mono text-xs">{effective.llmModel}</dd>
                                <dt className="text-muted-foreground">Embedding provider</dt>
                                <dd className="font-medium">{effective.embeddingProvider}</dd>
                                <dt className="text-muted-foreground">Embedding model</dt>
                                <dd className="font-mono text-xs">{effective.embeddingModel}</dd>
                            </dl>
                        </div>
                    )}

                    <div>
                        <Button onClick={() => void save()} disabled={saving}>
                            <Save className="size-4 mr-1.5" />
                            {saving ? "Salvando…" : "Salvar configuração de IA"}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
