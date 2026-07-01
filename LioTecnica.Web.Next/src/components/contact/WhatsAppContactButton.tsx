"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export function normalizeBrazilWhatsAppE164(celular?: string | null, fone?: string | null): string | null {
    const raw = (celular?.trim() || fone?.trim() || "");
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

export type WhatsAppContactButtonProps = {
    celular?: string | null;
    fone?: string | null;
    size?: ButtonSize;
    variant?: ButtonVariant;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
};

const DISABLED_TOOLTIP = "Sem telefone cadastrado";

export function WhatsAppContactButton({
    celular,
    fone,
    size = "sm",
    variant = "outline",
    className,
    onClick,
}: WhatsAppContactButtonProps) {
    const phone = normalizeBrazilWhatsAppE164(celular, fone);
    const label = "Conversar com WhatsApp Web";

    if (!phone) {
        return (
            <span title={DISABLED_TOOLTIP} className="inline-flex">
                <Button
                    type="button"
                    size={size}
                    variant={variant}
                    className={cn("gap-1.5 text-green-700/40", className)}
                    disabled
                    aria-label={DISABLED_TOOLTIP}
                >
                    <MessageCircle className="size-4 shrink-0" />
                    {label}
                </Button>
            </span>
        );
    }

    return (
        <Button
            asChild
            size={size}
            variant={variant}
            className={cn("gap-1.5 text-green-700 hover:text-green-800 hover:bg-green-50", className)}
        >
            <a
                href={`https://wa.me/${phone}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClick}
            >
                <MessageCircle className="size-4 shrink-0" />
                {label}
            </a>
        </Button>
    );
}
