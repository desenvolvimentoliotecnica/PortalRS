import AssistenteIaScreen from "@/features/assistente-ia/AssistenteIaScreen";

/**
 * Tela do Assistente IA (chat RAG com Qwen 2.5 + bge-m3).
 * Completamente client-side (useState, useEffect, streaming SSE) — compatível
 * com `output: "export"` do Next.js sem necessidade de `dynamic`.
 */
export default function AssistenteIaPage() {
    return <AssistenteIaScreen />;
}
