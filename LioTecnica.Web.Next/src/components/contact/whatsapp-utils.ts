export function normalizeBrazilWhatsAppE164(celular?: string | null, fone?: string | null): string | null {
    const raw = celular?.trim() || fone?.trim() || "";
    if (!raw) return null;

    let digits = raw.replace(/\D/g, "");
    if (!digits) return null;

    if (digits.startsWith("0")) {
        digits = digits.replace(/^0+/, "");
    }
    if (!digits.startsWith("55")) {
        digits = `55${digits}`;
    }

    return digits.length >= 12 ? digits : null;
}

export function firstName(displayName?: string | null): string {
    return displayName?.trim().split(/\s+/)[0] ?? "";
}

export const WHATSAPP_EMPRESA_FALLBACK = "Liotécnica";

export function buildWhatsAppUrl(phoneE164: string, message?: string | null): string {
    const base = `https://wa.me/${phoneE164}`;
    const text = message?.trim();
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function buildDefaultWhatsAppMessage(opts: {
    candidatoNome?: string | null;
    userDisplayName?: string | null;
    empresaNome?: string | null;
}): string {
    const empresa = opts.empresaNome?.trim() || WHATSAPP_EMPRESA_FALLBACK;
    const usuario = firstName(opts.userDisplayName) || "analista";
    const candidato = firstName(opts.candidatoNome);

    if (candidato) {
        return `Olá ${candidato}, sou ${usuario} do RH da ${empresa},\n\n`;
    }

    return `Olá, sou ${usuario} do RH da ${empresa},\n\n`;
}

export function formatPhoneForDisplay(celular?: string | null, fone?: string | null): string {
    return celular?.trim() || fone?.trim() || "—";
}
