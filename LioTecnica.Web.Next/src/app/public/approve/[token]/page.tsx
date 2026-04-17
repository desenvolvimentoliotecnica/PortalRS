import { Suspense } from "react";
import PublicApprovePageClient from "./PublicApprovePageClient";

export function generateStaticParams() {
  return [{ token: "__" }];
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-gray-500 text-center p-8">Carregando...</p>}>
      <PublicApprovePageClient />
    </Suspense>
  );
}
