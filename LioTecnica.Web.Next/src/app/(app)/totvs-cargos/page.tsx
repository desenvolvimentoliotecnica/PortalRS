"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Compatibilidade: export estático não aplica `redirects` do next.config — redireciona no cliente para `/cargos`. */
export default function TotvsCargosRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/cargos");
    }, [router]);
    return (
        <p className="p-4 text-sm text-muted-foreground">
            Redirecionando para Cargos…
        </p>
    );
}
