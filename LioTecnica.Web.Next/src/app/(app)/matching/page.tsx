import { Suspense } from "react";

import MatchingClient from "./MatchingClient";

export default function MatchingPage() {
  return (
    <Suspense fallback={null}>
      <MatchingClient />
    </Suspense>
  );
}
