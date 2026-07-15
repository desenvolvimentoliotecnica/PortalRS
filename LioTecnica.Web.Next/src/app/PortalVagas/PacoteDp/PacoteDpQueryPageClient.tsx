"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import PacoteDpPublicScreen from "@/features/admissao/PacoteDpPublicScreen";

function PacoteDpQueryContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  if (!token) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        Link inválido — falta o token do pacote.
      </section>
    );
  }

  return <PacoteDpPublicScreen token={token} />;
}

export default function PacoteDpQueryPageClient() {
  return (
    <Suspense fallback={null}>
      <PacoteDpQueryContent />
    </Suspense>
  );
}
