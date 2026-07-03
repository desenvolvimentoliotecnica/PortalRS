"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getTenantBrandingAdmin } from "@/lib/tenant-branding";
import { WHATSAPP_EMPRESA_FALLBACK } from "@/components/contact/whatsapp-utils";

let cachedEmpresaNome: string | null = null;
let fetchPromise: Promise<string> | null = null;

async function resolveEmpresaNome(): Promise<string> {
    if (cachedEmpresaNome) return cachedEmpresaNome;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        try {
            const res = await apiFetch("/api/lookup/empresas");
            if (res.ok) {
                const data = (await res.json()) as Array<{ name?: string | null }>;
                const label = data?.[0]?.name?.trim();
                if (label) {
                    cachedEmpresaNome = label;
                    return cachedEmpresaNome;
                }
            }
        } catch {
            /* fallback abaixo */
        }

        try {
            const branding = await getTenantBrandingAdmin();
            const nomePortal = branding?.nomePortal?.trim();
            if (nomePortal) {
                cachedEmpresaNome = nomePortal;
                return cachedEmpresaNome;
            }
        } catch {
            /* fallback abaixo */
        }

        cachedEmpresaNome = WHATSAPP_EMPRESA_FALLBACK;
        return cachedEmpresaNome;
    })();

    return fetchPromise;
}

export function useWhatsAppEmpresaNome(override?: string | null): string {
    const [nome, setNome] = useState(
        () => override?.trim() || cachedEmpresaNome || WHATSAPP_EMPRESA_FALLBACK,
    );

    useEffect(() => {
        if (override?.trim()) {
            setNome(override.trim());
            return;
        }
        void resolveEmpresaNome().then(setNome);
    }, [override]);

    return nome;
}
