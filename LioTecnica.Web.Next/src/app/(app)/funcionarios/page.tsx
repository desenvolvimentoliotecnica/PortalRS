import { Suspense } from "react";
import FuncionariosClient from "./FuncionariosClient";

export default function FuncionariosPage() {
    return (
        <Suspense fallback={null}>
            <FuncionariosClient />
        </Suspense>
    );
}
