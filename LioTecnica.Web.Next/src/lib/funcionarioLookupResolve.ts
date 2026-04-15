/**
 * Resolve empresa/unidade do portal a partir dos códigos TOTVS do funcionário
 * (CdnEmpresa, CdnEstab) quando o vínculo direto (FK) não veio preenchido.
 */

export interface LookupCodeRow {
    id: string;
    name: string;
    code?: string;
}

export function normLookupKey(s: string | null | undefined): string {
    return (s ?? "").trim().toUpperCase();
}

export function findEmpresaByCdn(empresas: LookupCodeRow[], cdnEmpresa: string | null): LookupCodeRow | null {
    const key = normLookupKey(cdnEmpresa);
    if (!key) return null;
    const direct = empresas.find((e) => normLookupKey(e.code) === key);
    if (direct) return direct;
    if (/^\d+$/.test(key)) {
        const n = parseInt(key, 10);
        return (
            empresas.find((e) => {
                const c = normLookupKey(e.code);
                return /^\d+$/.test(c) && parseInt(c, 10) === n;
            }) ?? null
        );
    }
    return null;
}

export function findUnitByEstabCode(unidades: LookupCodeRow[], cdnEstab: string | null): LookupCodeRow | null {
    const key = normLookupKey(cdnEstab);
    if (!key) return null;
    const direct = unidades.find((u) => normLookupKey(u.code) === key);
    if (direct) return direct;
    if (/^\d+$/.test(key)) {
        const n = parseInt(key, 10);
        return (
            unidades.find((u) => {
                const c = normLookupKey(u.code);
                return /^\d+$/.test(c) && parseInt(c, 10) === n;
            }) ?? null
        );
    }
    return null;
}
