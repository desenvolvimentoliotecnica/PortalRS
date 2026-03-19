"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[AppError]", error);
        // Captura no Sentry se disponível
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
            import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
        }
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center max-w-md mx-auto py-20">
            <AlertTriangle className="size-12 text-destructive/60" />
            <div>
                <h3 className="font-semibold text-lg mb-1">Algo deu errado</h3>
                <p className="text-sm text-muted-foreground">{error.message || "Ocorreu um erro inesperado."}</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Tentar novamente</Button>
                <Button variant="ghost" onClick={() => (window.location.href = "/app/dashboard")}>
                    Ir para Dashboard
                </Button>
            </div>
        </div>
    );
}
