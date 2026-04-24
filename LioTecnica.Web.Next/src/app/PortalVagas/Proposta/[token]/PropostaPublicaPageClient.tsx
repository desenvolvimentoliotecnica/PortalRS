"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import PropostaPublicaScreen from "@/features/recrutamento/propostas-vaga/PropostaPublicaScreen";

export default function PropostaPublicaPageClient() {
  const { token } = useParams<{ token: string }>();
  return (
    <Suspense fallback={null}>
      <PropostaPublicaScreen token={token} />
    </Suspense>
  );
}
