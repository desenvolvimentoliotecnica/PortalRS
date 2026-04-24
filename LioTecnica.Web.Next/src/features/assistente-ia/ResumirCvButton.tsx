"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistenteIaApi } from "./assistente-ia-api";

/**
 * Botão compacto que dispara resumo de CV via IA no card do candidato no kanban.
 * Após sucesso, chama <c>onResumido</c> com o texto gerado; o caller atualiza
 * o estado local (o backend persiste em Candidato.ResumoProfissional).
 */
export interface ResumirCvButtonProps {
    candidatoId: string;
    onResumido?: (resumo: string) => void;
    variant?: "default" | "ghost" | "outline";
    size?: "default" | "sm" | "icon";
}

export function ResumirCvButton({ candidatoId, onResumido, variant = "ghost", size = "sm" }: ResumirCvButtonProps) {
    const [loading, setLoading] = useState(false);

    const resumir = async () => {
        setLoading(true);
        try {
            const r = await AssistenteIaApi.resumirCv(candidatoId, true);
            if (!r.isSuccess || !r.resumo) {
                toast.error(r.errorMessage || "Falha ao resumir CV.");
                return;
            }
            toast.success(r.usouCache ? "Resumo (cache)" : "Resumo gerado");
            onResumido?.(r.resumo);
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button type="button" variant={variant} size={size} onClick={resumir} disabled={loading} className="gap-1" title="Resumir CV com IA">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
            {size !== "icon" && "Resumir"}
        </Button>
    );
}
