"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import PropostaPublicaScreen from "@/features/recrutamento/propostas-vaga/PropostaPublicaScreen";

function PropostaPublicaQueryContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  if (!token) {
    return (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        Link inválido — falta o token da proposta.
      </section>
    );
  }

  return <PropostaPublicaScreen token={token} />;
}

export default function PropostaPublicaQueryPageClient() {
  return (
    <Suspense fallback={null}>
      <PropostaPublicaQueryContent />
    </Suspense>
  );
}
