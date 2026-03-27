import { Suspense } from "react";
import DocumentoAdmissaoScreen from "@/features/admissaoportal/DocumentoAdmissaoScreen";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <DocumentoAdmissaoScreen />
        </Suspense>
    );
}
