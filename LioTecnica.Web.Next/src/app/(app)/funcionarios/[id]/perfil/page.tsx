import FuncionarioPerfilPageClient from "./FuncionarioPerfilPageClient";

export function generateStaticParams() {
    return [{ id: "__" }];
}

export default function Page() {
    return <FuncionarioPerfilPageClient />;
}
