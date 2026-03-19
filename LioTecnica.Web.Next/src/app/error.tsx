"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[GlobalError]", error);
    }, [error]);

    return (
        <html>
            <body className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                    <AlertTriangle className="size-12 text-red-500" />
                    <div>
                        <h3 className="font-semibold text-lg mb-1">Erro crítico</h3>
                        <p className="text-sm text-gray-500">{error.message || "Ocorreu um erro inesperado."}</p>
                    </div>
                    <Button variant="outline" onClick={reset}>Tentar novamente</Button>
                </div>
            </body>
        </html>
    );
}
