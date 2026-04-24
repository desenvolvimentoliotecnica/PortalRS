/**
 * Cliente HTTP do módulo Assistente IA — wrappers tipados sobre `/api/assistente-ia/*`.
 *
 * Camada fina em cima de `apiFetch` / `apiJson` do `@/lib/api`, com suporte a
 * streaming (Server-Sent Events) no endpoint `/chat/stream`.
 */
import { apiFetch, apiJson } from "@/lib/api";

export type AssistantChatMessage = { role: "user" | "assistant"; content: string };

export interface AssistantReply {
    isSuccess: boolean;
    content: string;
    fontes?: SemanticEvidence[] | null;
    toolsUsadas?: AssistantToolInvocation[] | null;
    errorMessage?: string | null;
}

export interface AssistantToolInvocation {
    name: string;
    description: string;
    argsJson: string;
    resultPreview: string;
    durationMs: number;
}

export interface SemanticEvidence {
    categoria: string;
    subcategoria?: string | null;
    texto: string;
    similaridade: number;
}

export interface OllamaHealth {
    ollama: {
        reachable: boolean;
        hasChatModel: boolean;
        hasEmbeddingModel: boolean;
        error?: string | null;
    };
}

export interface IndexingStats {
    itensIndexados: number;
    candidatosIndexados: number;
    skipped: number;
    falhas: number;
}

export interface DescricaoCargoGenerationResult {
    isSuccess: boolean;
    request?: Record<string, unknown> | null;
    rawResponse?: string | null;
    errorMessage?: string | null;
}

export interface CvResumoResult {
    isSuccess: boolean;
    resumo?: string | null;
    usouCache: boolean;
    errorMessage?: string | null;
}

export interface SalarioSuggestion {
    isSuccess: boolean;
    salarioMinimoSugerido?: number | null;
    salarioMaximoSugerido?: number | null;
    justificativa?: string | null;
    referencias?: string[] | null;
    errorMessage?: string | null;
}

export const AssistenteIaApi = {
    health: () => apiJson<OllamaHealth>("/api/assistente-ia/health"),

    chat: (message: string, history: AssistantChatMessage[] = []) =>
        apiJson<AssistantReply>("/api/assistente-ia/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history }),
        }),

    /**
     * Chat streaming via SSE. Retorna um iterable assíncrono de chunks de texto —
     * use `for await (const chunk of ...)` na UI para renderizar token-a-token.
     * A promise resolve quando o servidor envia `data: [DONE]`.
     */
    chatStream: async function* (
        message: string,
        history: AssistantChatMessage[] = [],
        signal?: AbortSignal,
    ): AsyncGenerator<string, void, unknown> {
        const res = await apiFetch(
            "/api/assistente-ia/chat/stream",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, history }),
                signal,
            },
            360_000, // 6min (Qwen 7B CPU cold start pode levar 60-90s antes do 1º token; stream longo cabe)
        );
        if (!res.ok || !res.body) throw new Error(`API_ERROR_${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let explicitError: string | null = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
                const frame = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 2);
                if (!frame.startsWith("data:")) continue;
                const payload = frame.slice(5).trim();
                if (payload === "[DONE]") return;

                // Parse seguro — erros de sintaxe em 1 frame não abortam o stream inteiro,
                // mas `error` no JSON propaga via flag (não throw dentro do try/catch do parse,
                // senão vira silêncio).
                let parsed: { delta?: string; error?: string } | null = null;
                try {
                    parsed = JSON.parse(payload) as { delta?: string; error?: string };
                } catch {
                    // frame malformado — ignora e segue
                    continue;
                }
                if (parsed.error) {
                    explicitError = parsed.error;
                    break;
                }
                if (parsed.delta) yield parsed.delta;
            }
            if (explicitError) break;
        }

        if (explicitError) throw new Error(explicitError);
    },

    gerarDescricaoCargo: (titulo: string, areaOuDepartamento?: string, contextoAdicional?: string) =>
        apiJson<DescricaoCargoGenerationResult>("/api/assistente-ia/descricao-cargo/gerar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titulo, areaOuDepartamento, contextoAdicional }),
        }),

    resumirCv: (candidatoId: string, force = false) =>
        apiJson<CvResumoResult>(
            `/api/assistente-ia/cv/resumir/${candidatoId}?force=${force}`,
            { method: "POST" },
        ),

    sugerirSalario: (vagaId: string) =>
        apiJson<SalarioSuggestion>(`/api/assistente-ia/vagas/sugerir-salario/${vagaId}`, {
            method: "POST",
        }),

    reindexar: (force = false) =>
        apiJson<IndexingStats>(`/api/assistente-ia/embeddings/reindexar?force=${force}`, {
            method: "POST",
        }),
};
