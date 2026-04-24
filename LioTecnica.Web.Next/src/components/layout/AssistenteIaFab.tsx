"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";

/**
 * Floating Action Button (FAB) do Assistente IA. Aparece fixo no canto inferior
 * direito em todas as telas do portal — facilita descoberta/acesso rápido.
 *
 * <para>Esconde-se automaticamente na própria tela do assistente (para não
 * duplicar) e em páginas públicas/login.</para>
 */
export default function AssistenteIaFab() {
    const pathname = usePathname();
    const router = useRouter();

    // Não mostrar na própria tela do assistente, login, portal externo ou owner
    if (
        !pathname ||
        pathname.startsWith("/app/assistente-ia") ||
        pathname.startsWith("/app/login") ||
        pathname.startsWith("/app/Owner") ||
        pathname.startsWith("/portal") ||
        pathname.startsWith("/PortalVagas")
    ) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={() => router.push("/assistente-ia")}
            className="fixed bottom-6 right-6 z-40 group
                       flex items-center gap-2 rounded-full
                       bg-gradient-to-br from-violet-600 to-purple-700
                       px-4 py-3 text-white shadow-lg shadow-violet-900/30
                       hover:shadow-xl hover:shadow-violet-900/50 hover:scale-105
                       transition-all duration-200"
            title="Abrir Assistente IA (Qwen 2.5)"
            aria-label="Abrir Assistente IA"
        >
            <Bot className="size-5" />
            <span className="font-medium text-sm hidden sm:inline">Assistente IA</span>
            <Sparkles className="size-3.5 opacity-80 group-hover:opacity-100 animate-pulse" />
        </button>
    );
}
