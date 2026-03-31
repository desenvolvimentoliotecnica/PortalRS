import { Suspense } from "react";
import VagaHubPageClient from "./VagaHubPageClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VagaHubPageClient />
    </Suspense>
  );
}
