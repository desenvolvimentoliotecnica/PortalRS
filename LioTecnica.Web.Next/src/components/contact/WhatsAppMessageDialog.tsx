"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppEmpresaNome } from "@/components/contact/useWhatsAppEmpresaNome";
import {
    buildDefaultWhatsAppMessage,
    buildWhatsAppUrl,
    formatPhoneForDisplay,
} from "@/components/contact/whatsapp-utils";

export type WhatsAppMessageDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    phoneE164: string;
    celular?: string | null;
    fone?: string | null;
    candidatoNome?: string | null;
    empresaNome?: string | null;
    defaultMessage?: string | null;
};

export function WhatsAppMessageDialog({
    open,
    onOpenChange,
    phoneE164,
    celular,
    fone,
    candidatoNome,
    empresaNome,
    defaultMessage,
}: WhatsAppMessageDialogProps) {
    const { me } = useAuth();
    const resolvedEmpresaNome = useWhatsAppEmpresaNome(empresaNome);
    const [message, setMessage] = useState("");

    const initialMessage = useMemo(() => {
        if (defaultMessage != null && defaultMessage !== "") {
            return defaultMessage;
        }
        return buildDefaultWhatsAppMessage({
            candidatoNome,
            userDisplayName: me?.displayName,
            empresaNome: resolvedEmpresaNome,
        });
    }, [candidatoNome, defaultMessage, me?.displayName, resolvedEmpresaNome]);

    useEffect(() => {
        if (open) {
            setMessage(initialMessage);
        }
    }, [open, initialMessage]);

    function handleConfirm() {
        const url = buildWhatsAppUrl(phoneE164, message);
        window.open(url, "_blank", "noopener,noreferrer");
        onOpenChange(false);
    }

    const destinoNome = candidatoNome?.trim() || "Candidato";
    const destinoTelefone = formatPhoneForDisplay(celular, fone);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="z-[60] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Mensagem para WhatsApp</DialogTitle>
                    <DialogDescription>
                        Escreva ou ajuste a mensagem antes de abrir o WhatsApp Web para{" "}
                        <strong>{destinoNome}</strong> ({destinoTelefone}).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Label htmlFor="whatsapp-message">Mensagem</Label>
                    <Textarea
                        id="whatsapp-message"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Digite a mensagem que será pré-preenchida no WhatsApp…"
                        className="resize-y"
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        className="gap-1.5 bg-green-700 text-white hover:bg-green-800"
                        onClick={handleConfirm}
                    >
                        <MessageCircle className="size-4 shrink-0" />
                        Abrir WhatsApp Web
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
