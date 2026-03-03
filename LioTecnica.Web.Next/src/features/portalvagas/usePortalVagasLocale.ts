"use client";

import { useState } from "react";
import { getPortalVagasLocale, type PortalVagasLocale } from "./strings";

/**
 * Hook para obter o locale do Portal de Vagas (pt-BR | en-US).
 * Usa localStorage "renderrh.locale". O Topbar recarrega a página ao trocar idioma.
 */
export function usePortalVagasLocale(): PortalVagasLocale {
  const [locale] = useState<PortalVagasLocale>(() => getPortalVagasLocale());
  return locale;
}
