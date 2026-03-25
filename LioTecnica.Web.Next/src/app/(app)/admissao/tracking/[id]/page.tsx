import AdmissaoTrackingPageClient from "./AdmissaoTrackingPageClient";

export function generateStaticParams() {
  return [{ id: "__" }];
}

export default function Page() {
  return <AdmissaoTrackingPageClient />;
}
