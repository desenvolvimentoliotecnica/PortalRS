import PropostaPublicaPageClient from "./PropostaPublicaPageClient";

export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function Page() {
  return <PropostaPublicaPageClient />;
}
