import { Suspense } from "react";
import AdmissaoListScreen from "@/features/admissao/AdmissaoListScreen";

export default function Page() {
    return (
        <Suspense>
            <AdmissaoListScreen />
        </Suspense>
    );
}
