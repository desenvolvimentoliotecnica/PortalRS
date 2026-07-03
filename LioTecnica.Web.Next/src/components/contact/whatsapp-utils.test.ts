import { describe, expect, it } from "vitest";
import {
    buildDefaultWhatsAppMessage,
    buildWhatsAppUrl,
    firstName,
    normalizeBrazilWhatsAppE164,
} from "./whatsapp-utils";

describe("normalizeBrazilWhatsAppE164", () => {
    it("prioriza celular e normaliza para E.164 BR", () => {
        expect(normalizeBrazilWhatsAppE164("(11) 98765-4321", null)).toBe("5511987654321");
    });

    it("usa fone como fallback", () => {
        expect(normalizeBrazilWhatsAppE164(null, "11987654321")).toBe("5511987654321");
    });

    it("retorna null sem telefone", () => {
        expect(normalizeBrazilWhatsAppE164(null, null)).toBeNull();
    });
});

describe("buildWhatsAppUrl", () => {
    it("monta link com mensagem codificada", () => {
        expect(buildWhatsAppUrl("5511987654321", "Olá, tudo bem?")).toBe(
            "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F",
        );
    });

    it("omite query quando mensagem vazia", () => {
        expect(buildWhatsAppUrl("5511987654321", "   ")).toBe("https://wa.me/5511987654321");
    });
});

describe("buildDefaultWhatsAppMessage", () => {
    it("inclui primeiro nome do candidato e do usuário", () => {
        expect(
            buildDefaultWhatsAppMessage({
                candidatoNome: "Maria da Silva",
                userDisplayName: "Lucas Machado",
                empresaNome: "Liotécnica",
            }),
        ).toBe("Olá Maria, sou Lucas do RH da Liotécnica,\n\n");
    });

    it("funciona sem nome do candidato", () => {
        expect(
            buildDefaultWhatsAppMessage({
                userDisplayName: "Ana Paula",
                empresaNome: "Liotécnica",
            }),
        ).toBe("Olá, sou Ana do RH da Liotécnica,\n\n");
    });
});

describe("firstName", () => {
    it("extrai primeiro token", () => {
        expect(firstName("João Pedro Souza")).toBe("João");
    });
});
