import AdmissaoTrackingLegacyRedirectPage from "./AdmissaoTrackingLegacyRedirectPage";

export function generateStaticParams() {
  return [{ id: "__" }];
}

export default function Page() {
  return <AdmissaoTrackingLegacyRedirectPage />;
}
