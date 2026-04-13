import PainelRhDetailPageClient from "./PainelRhDetailPageClient";

export function generateStaticParams() {
  return [{ id: "__" }];
}

export default function Page() {
  return <PainelRhDetailPageClient />;
}
