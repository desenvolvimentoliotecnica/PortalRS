import { Suspense } from "react";
import FuncionarioPerfilPageClient from "./FuncionarioPerfilPageClient";

export default function Page() {
    return (
        <Suspense fallback={<p className="text-gray-500 text-center p-8">Carregando...</p>}>
            <FuncionarioPerfilPageClient />
        </Suspense>
    );
}
