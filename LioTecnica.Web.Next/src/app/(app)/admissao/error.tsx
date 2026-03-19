"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdmissaoError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
            import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
        }
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center max-w-md mx-auto">
            <AlertTriangle className="size-10 text-destructive" />
            <div>
                <h4 className="font-semibold text-destructive mb-1">Erro no módulo de admissão</h4>
                <p className="text-sm text-muted-foreground">{error.message || "Ocorreu um erro inesperado."}</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Tentar novamente</Button>
                <Button variant="ghost" size="sm" onClick={() => window.location.href = "/app/admissao"}>Voltar para lista</Button>
            </div>
        </div>
    );
}
