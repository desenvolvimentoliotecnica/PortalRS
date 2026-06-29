"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { sendAtendimento, type AdmissaoPortalSession } from "../publicApi";

export const ATENDIMENTO_ASSUNTOS = [
    "Dúvida sobre documentos",
    "Problema ao enviar arquivo",
    "Dúvida sobre dados pessoais",
    "Dúvida sobre informações bancárias",
    "Dificuldade de acesso ao portal",
    "Outro assunto",
] as const;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    session: AdmissaoPortalSession | null;
}

export default function AdmissaoHelpModal({ open, onOpenChange, session }: Props) {
    const [assunto, setAssunto] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [sending, setSending] = useState(false);

    const resetForm = () => {
        setAssunto("");
        setMensagem("");
    };

    const handleClose = (next: boolean) => {
        if (!next) resetForm();
        onOpenChange(next);
    };

    const handleSubmit = async () => {
        if (!session) {
            toast.error("Sessão expirada. Faça login novamente.");
            return;
        }
        if (!assunto) {
            toast.error("Selecione um assunto.");
            return;
        }
        if (!mensagem.trim()) {
            toast.error("Digite sua mensagem.");
            return;
        }

        setSending(true);
        try {
            await sendAtendimento(session, assunto, mensagem.trim());
            toast.success("Mensagem enviada! Nossa equipe de RH entrará em contato em breve.");
            handleClose(false);
        } catch {
            toast.error("Não foi possível enviar a mensagem. Tente novamente.");
        } finally {
            setSending(false);
        }
    };

    const selectCls =
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Fale com o RH</DialogTitle>
                    <DialogDescription>
                        Envie sua dúvida ou solicitação. Nossa equipe de RH responsável pela sua vaga receberá sua mensagem por e-mail.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="atendimento-assunto">Assunto</Label>
                        <select
                            id="atendimento-assunto"
                            className={selectCls}
                            value={assunto}
                            onChange={(e) => setAssunto(e.target.value)}
                            disabled={sending}
                        >
                            <option value="">Selecione um assunto</option>
                            {ATENDIMENTO_ASSUNTOS.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="atendimento-mensagem">Mensagem</Label>
                        <Textarea
                            id="atendimento-mensagem"
                            placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível..."
                            rows={5}
                            value={mensagem}
                            onChange={(e) => setMensagem(e.target.value)}
                            disabled={sending}
                            maxLength={4000}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={sending}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={sending} className="bg-[#0047BB] hover:bg-[#003a99]">
                        {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                        Enviar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
