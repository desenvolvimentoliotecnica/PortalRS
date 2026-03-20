import { Suspense } from "react";
import AdmissaoRevisaoScreen from "@/features/admissao/AdmissaoRevisaoScreen";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AdmissaoRevisaoScreen />
        </Suspense>
    );
}
