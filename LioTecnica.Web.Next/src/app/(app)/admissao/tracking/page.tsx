import { Suspense } from "react";
import AdmissaoTrackingPageClient from "./AdmissaoTrackingPageClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdmissaoTrackingPageClient />
    </Suspense>
  );
}
