import { Suspense } from "react";
import FuncionarioPerfilPageClient from "./FuncionarioPerfilPageClient";

export function generateStaticParams() {
    return [{ id: "__" }];
}

export default function Page() {
    return (
        <Suspense fallback={<p className="text-gray-500 text-center p-8">Carregando...</p>}>
            <FuncionarioPerfilPageClient />
        </Suspense>
    );
}
