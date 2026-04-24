"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Bot, RotateCw, Sparkles, FileText, DollarSign, Loader2, AlertCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    AssistenteIaApi,
    type AssistantChatMessage,
    type SemanticEvidence,
    type OllamaHealth,
    type AssistantToolInvocation,
} from "./assistente-ia-api";

/**
 * Tela do Assistente RH — chat RAG + ferramentas (gerar descrição de cargo,
 * reindexar embeddings). Streaming token-a-token via SSE.
 *
 * <para>Sidebar à esquerda: saúde do Ollama + botão reindexar.
 * Área principal: histórico de chat + prompts sugeridos + input com streaming.</para>
 */
export default function AssistenteIaScreen() {
    const [health, setHealth] = useState<OllamaHealth | null>(null);
    const [history, setHistory] = useState<Array<{
        role: "user" | "assistant";
        content: string;
        fontes?: SemanticEvidence[] | null;
        tools?: AssistantToolInvocation[] | null;
    }>>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [reindexando, setReindexando] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        AssistenteIaApi.health().then(setHealth).catch(() => setHealth(null));
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [history, streaming]);

    const send = useCallback(async () => {
        const msg = input.trim();
        if (!msg || streaming) return;

        const newHistory = [...history, { role: "user" as const, content: msg }];
        setHistory(newHistory);
        setInput("");
        setStreaming(true);

        const pastMessages: AssistantChatMessage[] = newHistory
            .slice(0, -1)
            .map((m) => ({ role: m.role, content: m.content }));

        const controller = new AbortController();
        abortRef.current = controller;

        // Placeholder (a UI mostra o LoadingDots enquanto content estiver vazio)
        setHistory((prev) => [...prev, { role: "assistant", content: "" }]);

        try {
            // Usa o endpoint buffered (/chat) — suporta Function Calling + retorna fontes e tools.
            // O streaming (/chat/stream) seria mais fluido mas ainda não suporta tools.
            const reply = await AssistenteIaApi.chat(msg, pastMessages);
            if (!reply.isSuccess) throw new Error(reply.errorMessage || "Falha no chat");
            setHistory((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                    role: "assistant",
                    content: reply.content || "(sem resposta)",
                    fontes: reply.fontes,
                    tools: reply.toolsUsadas,
                };
                return copy;
            });
        } catch (err) {
            toast.error(`Erro no chat: ${(err as Error).message}`);
            setHistory((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                    role: "assistant",
                    content: "(erro — tente novamente ou verifique o Ollama na sidebar)",
                };
                return copy;
            });
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, [input, history, streaming]);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        setStreaming(false);
    }, []);

    const reindexar = useCallback(async () => {
        setReindexando(true);
        try {
            const r = await AssistenteIaApi.reindexar(true);
            toast.success(`Reindexado: ${r.itensIndexados} itens + ${r.candidatosIndexados} candidatos`);
            const h = await AssistenteIaApi.health();
            setHealth(h);
        } catch (err) {
            toast.error(`Erro ao reindexar: ${(err as Error).message}`);
        } finally {
            setReindexando(false);
        }
    }, []);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        send();
    };

    const sugestoes = [
        "Quais candidatos têm perfil próximo do Assistente de Suporte Técnico?",
        "Resuma as principais responsabilidades do Assistente de Suporte Técnico",
        "Qual faixa salarial é justa para um Assistente Júnior em São Paulo?",
        "Liste as competências DNALIO e o que cada uma significa",
    ];

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Sidebar */}
            <aside className="w-72 shrink-0 rounded-lg border bg-card p-4 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-2">
                    <Bot className="size-5 text-primary" />
                    <h2 className="font-semibold">Assistente IA</h2>
                </div>

                <div className="space-y-2 text-sm">
                    <h3 className="font-medium">Status</h3>
                    {health ? (
                        <div className="space-y-1">
                            <HealthRow label="Ollama alcançável" ok={health.ollama.reachable} />
                            <HealthRow label="Modelo chat (Qwen 2.5)" ok={health.ollama.hasChatModel} />
                            <HealthRow label="Modelo embedding (bge-m3)" ok={health.ollama.hasEmbeddingModel} />
                            {health.ollama.error && (
                                <p className="text-xs text-muted-foreground mt-1">{health.ollama.error}</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Carregando…</p>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium">Ferramentas</h3>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={reindexar} disabled={reindexando}>
                        {reindexando ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                        Reindexar embeddings
                    </Button>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium flex items-center gap-1">
                        <Sparkles className="size-3.5" />
                        Sugestões
                    </h3>
                    <div className="space-y-1">
                        {sugestoes.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className="w-full text-left text-xs bg-accent/50 hover:bg-accent px-2 py-1.5 rounded text-accent-foreground transition-colors"
                                onClick={() => setInput(s)}
                                disabled={streaming}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {!health?.ollama.reachable && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <div>
                                Ollama não está acessível. Verifique se está rodando em <code>localhost:11434</code>.
                                Sem ele, o chat e geração por IA não funcionam — o matching cai em fallback léxico.
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Chat area */}
            <section className="flex-1 flex flex-col rounded-lg border bg-card overflow-hidden">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {history.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <Bot className="size-16 text-muted-foreground" />
                            <div>
                                <h3 className="font-semibold text-lg">Pergunte o que quiser sobre RH</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Uso RAG sobre seus descritivos de cargo + vagas. Respondo em português, cito fontes,
                                    e ajudo a gerar templates, resumos e sugestões salariais.
                                </p>
                            </div>
                        </div>
                    )}

                    {history.map((m, i) => (
                        <ChatBubble key={i} role={m.role} content={m.content} fontes={m.fontes} tools={m.tools} />
                    ))}

                    {streaming && history[history.length - 1]?.role === "assistant" && history[history.length - 1]?.content === "" && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="size-4 animate-spin" />
                            Pensando…
                        </div>
                    )}
                </div>

                <form onSubmit={onSubmit} className="border-t p-4 flex gap-2">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Digite sua pergunta..."
                        className="resize-none"
                        rows={2}
                        disabled={streaming}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                    />
                    {streaming ? (
                        <Button type="button" variant="outline" onClick={stop}>
                            Parar
                        </Button>
                    ) : (
                        <Button type="submit" disabled={!input.trim() || !health?.ollama.reachable}>
                            <Send className="size-4" />
                        </Button>
                    )}
                </form>
            </section>
        </div>
    );
}

function HealthRow({ label, ok }: { label: string; ok: boolean }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span>{label}</span>
            <span className={ok ? "text-green-600" : "text-red-600"}>{ok ? "✓" : "✗"}</span>
        </div>
    );
}

function ChatBubble({
    role, content, fontes, tools,
}: {
    role: "user" | "assistant";
    content: string;
    fontes?: SemanticEvidence[] | null;
    tools?: AssistantToolInvocation[] | null;
}) {
    const isUser = role === "user";
    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && <Bot className="size-6 shrink-0 mt-1 text-primary" />}
            <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {/* Chips das ferramentas usadas — aparecem ANTES do texto da resposta */}
                {!isUser && tools && tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-muted-foreground/20">
                        {tools.map((t, i) => (
                            <ToolChip key={i} tool={t} />
                        ))}
                    </div>
                )}

                <div className="whitespace-pre-wrap text-sm leading-relaxed">{content || " "}</div>

                {!isUser && fontes && fontes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fontes usadas</p>
                        <ul className="space-y-1">
                            {fontes.map((f, i) => (
                                <li key={i} className="text-xs">
                                    <span className="font-medium">[{i + 1}]</span> {f.categoria}
                                    {f.subcategoria ? ` / ${f.subcategoria}` : ""} — {f.texto.slice(0, 120)}
                                    {f.texto.length > 120 ? "…" : ""}
                                    <span className="text-muted-foreground ml-2">(sim {f.similaridade.toFixed(2)})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Chip visual para cada tool invocada pelo agente. Mostra nome + hover com args/resultado.
 */
function ToolChip({ tool }: { tool: AssistantToolInvocation }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 px-2 py-0.5 text-[11px] font-medium hover:bg-violet-500/25 transition-colors"
                title={tool.description}
            >
                <Wrench className="size-3" />
                {tool.name}
                <span className="text-[10px] opacity-60">({tool.durationMs}ms)</span>
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 w-80 z-10 bg-popover border border-border rounded-md p-2 shadow-lg text-[11px]">
                    <p className="font-semibold text-foreground mb-1">{tool.name}</p>
                    <p className="text-muted-foreground mb-2">{tool.description}</p>
                    <div className="mb-1">
                        <span className="font-semibold">Args:</span>
                        <code className="block bg-muted px-1.5 py-0.5 rounded mt-0.5 text-[10px] overflow-auto">
                            {tool.argsJson}
                        </code>
                    </div>
                    <div>
                        <span className="font-semibold">Resultado (preview):</span>
                        <code className="block bg-muted px-1.5 py-0.5 rounded mt-0.5 text-[10px] overflow-auto max-h-24">
                            {tool.resultPreview}
                        </code>
                    </div>
                </div>
            )}
        </div>
    );
}
