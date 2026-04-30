import { Suspense } from "react";
import SolicitacoesScreen from "@/features/gestao/solicitacoes/SolicitacoesScreen";

export default function Page() {
    return (
        <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Carregando solicitações…</div>}>
            <SolicitacoesScreen />
        </Suspense>
    );
}
