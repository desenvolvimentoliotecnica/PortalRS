import Link from "next/link";
import { FileQuestion } from "lucide-react";

export const metadata = {
    title: "Página não encontrada — Voltage RenderRH",
};

/**
 * Página 404 global (Fase 13.1 — Sessão 25).
 *
 * Substitui a `Views/Shared/Error.cshtml` do MVC legado.
 */
export default function NotFoundPage() {
    return (
        <main className="flex min-h-screen items-center justify-center px-6">
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <FileQuestion className="size-14 text-slate-400" aria-hidden="true" />
                <div>
                    <h1 className="mb-2 text-2xl font-semibold text-slate-900">
                        Página não encontrada
                    </h1>
                    <p className="text-sm text-slate-500">
                        A rota que você tentou acessar não existe ou foi movida. Verifique o
                        endereço ou volte para a tela inicial.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                    Voltar ao painel
                </Link>
            </div>
        </main>
    );
}
