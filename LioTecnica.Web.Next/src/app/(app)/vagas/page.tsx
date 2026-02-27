import { Suspense } from "react";

import VagasClient from "./VagasClient";

export default function VagasPage() {
  return (
    <Suspense fallback={null}>
      <VagasClient />
    </Suspense>
  );
}
