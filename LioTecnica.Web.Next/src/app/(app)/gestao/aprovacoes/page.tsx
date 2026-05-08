import { Suspense } from "react";
import AprovacoesScreen from "@/features/gestao/aprovacoes/AprovacoesScreen";

export default function Page() {
    return (
        <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Carregando aprovações…</div>}>
            <AprovacoesScreen />
        </Suspense>
    );
}
