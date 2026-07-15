"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, FlaskConical, Loader2, Save, Sparkles, Network, AlertTriangle } from "lucide-react";

/* ────────── types ────────── */

interface TenantAiConfigDto {
    llmProvider: string | null;
    llmModel: string | null;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    usarIaParseCurriculo: boolean;
    llmTimeoutSeconds: number;
    knownProviders: string[];
    availableProviders: string[];   // Fase 4: providers com chave cadastrada
    aiEnabled: boolean;             // Fase 4: módulo "ai" do tenant
    effectiveLlmProvider: string;
    effectiveLlmModel: string;
    effectiveEmbeddingProvider: string;
    effectiveEmbeddingModel: string;
}

interface TenantAiTestResponse {
    success: boolean;
    content: string | null;
    error: string | null;
    provider: string | null;
    model: string | null;
    cost: number;
}

const ALL_PROVIDER_OPTIONS = [
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Google Gemini" },
    { value: "anthropic", label: "Anthropic Claude" },
    { value: "ollama", label: "Ollama (local)" },
];

function buildProviderOptions(available: string[]) {
    const lower = new Set(available.map(p => p.toLowerCase()));
    return [
        { value: "", label: "Usar padrão global" },
        ...ALL_PROVIDER_OPTIONS.filter(o => lower.has(o.value)),
    ];
}

const MODEL_PLACEHOLDERS: Record<string, string> = {
    openai: "ex.: mistral-small-24b, gpt-4o-mini, gpt-4o",
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

function clampTimeoutSeconds(value: unknown, fallback = 180): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(600, Math.max(30, Math.round(n)));
}

function readAiConfig(dto: Record<string, unknown>): TenantAiConfigDto {
    return {
        llmProvider: (dto.llmProvider ?? dto.LlmProvider ?? null) as string | null,
        llmModel: (dto.llmModel ?? dto.LlmModel ?? null) as string | null,
        embeddingProvider: (dto.embeddingProvider ?? dto.EmbeddingProvider ?? null) as string | null,
        embeddingModel: (dto.embeddingModel ?? dto.EmbeddingModel ?? null) as string | null,
        usarIaParseCurriculo: (dto.usarIaParseCurriculo ?? dto.UsarIaParseCurriculo ?? true) as boolean,
        llmTimeoutSeconds: clampTimeoutSeconds(dto.llmTimeoutSeconds ?? dto.LlmTimeoutSeconds, 180),
        knownProviders: (dto.knownProviders ?? dto.KnownProviders ?? []) as string[],
        availableProviders: (dto.availableProviders ?? dto.AvailableProviders ?? []) as string[],
        aiEnabled: (dto.aiEnabled ?? dto.AiEnabled ?? true) as boolean,
        effectiveLlmProvider: String(dto.effectiveLlmProvider ?? dto.EffectiveLlmProvider ?? "openai"),
        effectiveLlmModel: String(dto.effectiveLlmModel ?? dto.EffectiveLlmModel ?? ""),
        effectiveEmbeddingProvider: String(dto.effectiveEmbeddingProvider ?? dto.EffectiveEmbeddingProvider ?? "openai"),
        effectiveEmbeddingModel: String(dto.effectiveEmbeddingModel ?? dto.EffectiveEmbeddingModel ?? ""),
    };
}

/* ────────── component ────────── */

export default function IaConfigScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [llmProvider, setLlmProvider] = useState<string>("");
    const [llmModel, setLlmModel] = useState<string>("");
    const [embeddingProvider, setEmbeddingProvider] = useState<string>("");
    const [embeddingModel, setEmbeddingModel] = useState<string>("");
    const [usarIaParseCurriculo, setUsarIaParseCurriculo] = useState(true);
    const [llmTimeoutSeconds, setLlmTimeoutSeconds] = useState(180);
    const [testing, setTesting] = useState(false);

    const [effective, setEffective] = useState<{
        llmProvider: string;
        llmModel: string;
        embeddingProvider: string;
        embeddingModel: string;
    } | null>(null);

    const [aiEnabled, setAiEnabled] = useState<boolean>(true);
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/tenant-configuracao/ai");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dto = readAiConfig((await res.json()) as Record<string, unknown>);
            setLlmProvider(dto.llmProvider ?? "");
            setLlmModel(dto.llmModel ?? "");
            setEmbeddingProvider(dto.embeddingProvider ?? "");
            setEmbeddingModel(dto.embeddingModel ?? "");
            setUsarIaParseCurriculo(dto.usarIaParseCurriculo ?? true);
            setLlmTimeoutSeconds(dto.llmTimeoutSeconds ?? 180);
            setEffective({
                llmProvider: dto.effectiveLlmProvider,
                llmModel: dto.effectiveLlmModel,
                embeddingProvider: dto.effectiveEmbeddingProvider,
                embeddingModel: dto.effectiveEmbeddingModel,
            });
            setAiEnabled(dto.aiEnabled);
            setAvailableProviders(dto.availableProviders ?? []);
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
                    usarIaParseCurriculo,
                    llmTimeoutSeconds: clampTimeoutSeconds(llmTimeoutSeconds, 180),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const dto = readAiConfig((await res.json()) as Record<string, unknown>);
            setUsarIaParseCurriculo(dto.usarIaParseCurriculo ?? true);
            setLlmTimeoutSeconds(dto.llmTimeoutSeconds ?? 180);
            setEffective({
                llmProvider: dto.effectiveLlmProvider,
                llmModel: dto.effectiveLlmModel,
                embeddingProvider: dto.effectiveEmbeddingProvider,
                embeddingModel: dto.effectiveEmbeddingModel,
            });
            setAiEnabled(dto.aiEnabled);
            setAvailableProviders(dto.availableProviders ?? []);
            toast.success("Configuração de IA salva.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    async function testAi() {
        const previousPointerEvents = document.body.style.pointerEvents;
        const bumpZIndex = () => {
            document.body.style.pointerEvents = "auto";
            const container = Swal.getContainer();
            if (container) container.style.zIndex = "10000";
        };

        const input = await Swal.fire({
            title: "Testar IA",
            html: `
              <p class="swal-ai-test-hint" style="text-align:left;font-size:13px;margin:0 0 8px;color:#64748b">
                Usa o <strong>provider/modelo já salvos</strong> deste tenant. Se alterou o modelo acima, salve antes de testar.
              </p>
            `,
            input: "textarea",
            inputLabel: "Prompt",
            inputValue: "Responda em uma única frase curta em português: a configuração de IA está funcionando.",
            inputAttributes: {
                "aria-label": "Prompt para a IA",
            },
            inputPlaceholder: "Digite o prompt de teste…",
            showCancelButton: true,
            confirmButtonText: "Enviar",
            cancelButtonText: "Cancelar",
            didOpen: bumpZIndex,
            willClose: () => {
                document.body.style.pointerEvents = previousPointerEvents;
            },
            preConfirm: (value) => {
                const text = (value ?? "").trim();
                if (!text) {
                    Swal.showValidationMessage("Informe um prompt.");
                    return false;
                }
                return text;
            },
        });

        if (!input.isConfirmed || typeof input.value !== "string") return;

        setTesting(true);
        Swal.fire({
            title: "Consultando a IA…",
            text: "Aguarde a resposta do modelo configurado.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                bumpZIndex();
                Swal.showLoading();
            },
            willClose: () => {
                document.body.style.pointerEvents = previousPointerEvents;
            },
        });

        try {
            const res = await apiFetch(
                "/api/tenant-configuracao/ai/test",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: input.value }),
                },
                clampTimeoutSeconds(llmTimeoutSeconds, 180) * 1000,
            );

            if (res.status === 403) throw new Error("Somente administradores podem testar a IA.");
            if (!res.ok) {
                const errBody = await res.text().catch(() => "");
                throw new Error(errBody || `HTTP ${res.status}`);
            }

            const raw = (await res.json()) as Record<string, unknown>;
            const dto: TenantAiTestResponse = {
                success: raw.success === true || raw.Success === true,
                content: typeof (raw.content ?? raw.Content) === "string" ? String(raw.content ?? raw.Content) : null,
                error: typeof (raw.error ?? raw.Error) === "string" ? String(raw.error ?? raw.Error) : null,
                provider: typeof (raw.provider ?? raw.Provider) === "string" ? String(raw.provider ?? raw.Provider) : null,
                model: typeof (raw.model ?? raw.Model) === "string" ? String(raw.model ?? raw.Model) : null,
                cost: typeof raw.cost === "number" ? raw.cost : typeof raw.Cost === "number" ? Number(raw.Cost) : 0,
            };

            const meta = [dto.provider, dto.model].filter(Boolean).join(" · ") || "sem provider/modelo";
            if (dto.success && dto.content) {
                await Swal.fire({
                    icon: "success",
                    title: "Resposta da IA",
                    html: `
                      <p style="text-align:left;font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(meta)}</p>
                      <pre style="text-align:left;white-space:pre-wrap;word-break:break-word;font-size:13px;max-height:320px;overflow:auto;margin:0;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">${escapeHtml(dto.content)}</pre>
                    `,
                    confirmButtonText: "Fechar",
                    width: 560,
                    didOpen: bumpZIndex,
                    willClose: () => {
                        document.body.style.pointerEvents = previousPointerEvents;
                    },
                });
            } else {
                await Swal.fire({
                    icon: "error",
                    title: "Falha no teste",
                    html: `
                      <p style="text-align:left;font-size:12px;color:#64748b;margin:0 0 8px">${escapeHtml(meta)}</p>
                      <pre style="text-align:left;white-space:pre-wrap;word-break:break-word;font-size:13px;max-height:320px;overflow:auto;margin:0;padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">${escapeHtml(dto.error || dto.content || "Não foi possível obter resposta da IA.")}</pre>
                    `,
                    confirmButtonText: "Fechar",
                    width: 560,
                    didOpen: bumpZIndex,
                    willClose: () => {
                        document.body.style.pointerEvents = previousPointerEvents;
                    },
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Falha ao testar a IA.";
            await Swal.fire({
                icon: "error",
                title: "Falha no teste",
                text: msg,
                confirmButtonText: "Fechar",
                didOpen: bumpZIndex,
                willClose: () => {
                    document.body.style.pointerEvents = previousPointerEvents;
                },
            });
        } finally {
            setTesting(false);
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
                    {/* ── Banner: IA não habilitada para este tenant ── */}
                    {!aiEnabled && (
                        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 p-4 flex items-start gap-3">
                            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-amber-900 dark:text-amber-100">
                                    IA não habilitada para este tenant
                                </p>
                                <p className="text-amber-800/80 dark:text-amber-200/70 mt-0.5">
                                    O módulo de IA está desativado para sua empresa. As features que dependem de
                                    LLM (extração de CV, geração de descrição de cargo, sugestão salarial,
                                    assistente RH e LLM scoring no matching) não funcionarão até que o owner
                                    da plataforma libere o acesso. Você ainda pode escolher um provider abaixo
                                    para quando a IA for ativada — mas as chamadas serão bloqueadas no servidor.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Banner: nenhum provider com chave cadastrada ── */}
                    {aiEnabled && availableProviders.length === 0 && (
                        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 p-4 flex items-start gap-3">
                            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-amber-900 dark:text-amber-100">
                                    Nenhum provider com chave cadastrada
                                </p>
                                <p className="text-amber-800/80 dark:text-amber-200/70 mt-0.5">
                                    O owner da plataforma ainda não cadastrou chaves OpenAI/Gemini/Anthropic
                                    nem habilitou o Ollama local. As features IA não vão funcionar.
                                </p>
                            </div>
                        </div>
                    )}

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
                                    {buildProviderOptions(availableProviders).map((o) => (
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
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        id="llmModel"
                                        type="text"
                                        className="flex-1 min-w-[12rem]"
                                        placeholder={MODEL_PLACEHOLDERS[llmProvider] ?? "vazio = default global"}
                                        value={llmModel}
                                        onChange={(e) => setLlmModel(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="shrink-0 gap-1.5"
                                        disabled={testing || !aiEnabled || saving}
                                        title={!aiEnabled ? "IA desabilitada para este tenant" : "Enviar um prompt de teste ao modelo salvo"}
                                        onClick={() => void testAi()}
                                    >
                                        {testing ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <FlaskConical className="size-4" />
                                        )}
                                        {testing ? "Testando…" : "Testar"}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    O teste usa a configuração <strong>salva</strong> (provider/modelo efetivos). Salve alterações antes de validar um modelo novo.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="llmTimeoutSeconds">Timeout da IA (segundos)</Label>
                                <Input
                                    id="llmTimeoutSeconds"
                                    type="number"
                                    min={30}
                                    max={600}
                                    step={10}
                                    className="max-w-[12rem]"
                                    value={llmTimeoutSeconds}
                                    onChange={(e) => setLlmTimeoutSeconds(clampTimeoutSeconds(e.target.value, 180))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Tempo máximo de espera no parse de CV e no Testar (30–600s). Default 180. Salve para aplicar.
                                </p>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-border/40">
                                <label className="flex items-start gap-3 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 rounded border-input"
                                        checked={usarIaParseCurriculo}
                                        onChange={(e) => setUsarIaParseCurriculo(e.target.checked)}
                                        disabled={!aiEnabled}
                                    />
                                    <span>
                                        <span className="font-medium">Usar IA para preencher novo candidato a partir do CV</span>
                                        <span className="block text-xs text-muted-foreground mt-0.5">
                                            No cadastro manual (Novo Candidato), ao anexar o currículo a IA preenche
                                            os campos e as observações (resumo e fit da vaga). Se a IA falhar ou
                                            estiver desligada, o analista preenche os dados manualmente.
                                        </span>
                                    </span>
                                </label>
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
                                    {buildProviderOptions(availableProviders).map((o) => (
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
                                <dt className="text-muted-foreground">Timeout IA</dt>
                                <dd className="font-medium">{llmTimeoutSeconds}s</dd>
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

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
