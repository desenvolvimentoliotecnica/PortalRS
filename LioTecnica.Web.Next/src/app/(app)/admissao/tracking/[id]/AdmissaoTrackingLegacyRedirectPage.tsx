"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { admissaoTrackingPath } from "@/features/admissao/admissaoRoutes";

/** Compat: URLs antigas `/admissao/tracking/{id}` → query param (static export). */
export default function AdmissaoTrackingLegacyRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (id && id !== "__") {
      router.replace(admissaoTrackingPath(id));
    } else if (!id) {
      router.replace("/admissao");
    }
  }, [id, router]);

  return null;
}
