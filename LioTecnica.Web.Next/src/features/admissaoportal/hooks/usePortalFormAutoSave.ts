"use client";

import { useEffect, useRef } from "react";
import { admissaoPortalFetch, isMockPortalSession, type AdmissaoPortalSession } from "../publicApi";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";

/** Auto-save debounced dos dados do formulário. */
export function usePortalFormAutoSave(session: AdmissaoPortalSession) {
    const { formData, setAutoSaving, setLastSavedAt } = useAdmissaoWizardStore();
    const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        if (isMockPortalSession(session)) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setAutoSaving(true);
            try {
                await admissaoPortalFetch(
                    session.tenantId,
                    `/api/public/admissao-portal/${session.preAdmissaoId}/dados`,
                    session.cpf,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(formData),
                    },
                );
                setLastSavedAt(new Date());
            } catch {
                /* silencioso — candidato pode continuar */
            }
            setAutoSaving(false);
        }, 2000);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [formData, session, setAutoSaving, setLastSavedAt]);
}

export async function savePortalFormNow(session: AdmissaoPortalSession, formData: Record<string, unknown>) {
    await admissaoPortalFetch(
        session.tenantId,
        `/api/public/admissao-portal/${session.preAdmissaoId}/dados`,
        session.cpf,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        },
    );
}
