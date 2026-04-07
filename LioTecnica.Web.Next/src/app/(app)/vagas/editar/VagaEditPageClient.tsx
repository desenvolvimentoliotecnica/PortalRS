"use client";

import { useSearchParams } from "next/navigation";
import VagaEditScreen from "@/features/recrutamento/vagas/VagaEditScreen";

export default function VagaEditPageClient() {
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;
  return <VagaEditScreen editId={id} />;
}
