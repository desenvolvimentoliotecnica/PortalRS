import { Suspense } from "react";
import AdmissaoWizardScreen from "@/features/admissao/AdmissaoWizardScreen";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AdmissaoWizardScreen />
        </Suspense>
    );
}
