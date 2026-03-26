import AvaliacaoCicloPageClient from "./AvaliacaoCicloPageClient";

// Necessário para build com `output: export` em rotas dinâmicas.
// A página real é client-side (usa `useParams`), então usamos um placeholder em build time.
export function generateStaticParams() {
  return [{ cicloId: "__" }];
}

export default function Page() {
  return <AvaliacaoCicloPageClient />;
}
