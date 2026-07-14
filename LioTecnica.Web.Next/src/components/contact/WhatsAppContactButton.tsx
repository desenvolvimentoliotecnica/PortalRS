"use client";

import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WhatsAppMessageDialog } from "@/components/contact/WhatsAppMessageDialog";
import { normalizeBrazilWhatsAppE164 } from "@/components/contact/whatsapp-utils";
import { useCanViewCandidatoContato } from "@/hooks/useAuth";

export { normalizeBrazilWhatsAppE164 } from "@/components/contact/whatsapp-utils";

type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export type WhatsAppContactButtonProps = {
    celular?: string | null;
    fone?: string | null;
    candidatoNome?: string | null;
    empresaNome?: string | null;
    defaultMessage?: string | null;
    size?: ButtonSize;
    variant?: ButtonVariant;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const DISABLED_TOOLTIP = "Sem telefone cadastrado";

export function WhatsAppContactButton({
    celular,
    fone,
    candidatoNome,
    empresaNome,
    defaultMessage,
    size = "sm",
    variant = "outline",
    className,
    onClick,
}: WhatsAppContactButtonProps) {
    const canViewContato = useCanViewCandidatoContato();
    const phone = normalizeBrazilWhatsAppE164(celular, fone);
    const label = "Conversar com WhatsApp Web";
    const [dialogOpen, setDialogOpen] = useState(false);

    if (!canViewContato) {
        return null;
    }

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

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
        onClick?.(e);
        if (e.defaultPrevented) return;
        setDialogOpen(true);
    }

    return (
        <>
            <Button
                type="button"
                size={size}
                variant={variant}
                className={cn("gap-1.5 text-green-700 hover:text-green-800 hover:bg-green-50", className)}
                onClick={handleClick}
            >
                <MessageCircle className="size-4 shrink-0" />
                {label}
            </Button>

            <WhatsAppMessageDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                phoneE164={phone}
                celular={celular}
                fone={fone}
                candidatoNome={candidatoNome}
                empresaNome={empresaNome}
                defaultMessage={defaultMessage}
            />
        </>
    );
}
