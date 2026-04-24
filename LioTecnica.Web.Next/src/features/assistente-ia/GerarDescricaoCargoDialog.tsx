"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AssistenteIaApi } from "./assistente-ia-api";

/**
 * Dialog que dispara geração de template DNALIO por IA. O usuário digita título +
 * contexto opcional → LLM retorna JSON completo com 8 categorias populadas. Aqui
 * apenas disparamos e notificamos; a consumidora (tela de DescricaoCargo) recebe
 * o <c>request</c> pronto via callback e popula o form pra o usuário editar.
 */
export interface GerarDescricaoCargoDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    /**
     * Chamado quando a geração termina com sucesso — passa o request completo
     * (já no formato DescricaoCargoCreateRequest, pronto pra POST ou pra popular o form).
     */
    onGerado?: (request: Record<string, unknown>) => void;
}

export function GerarDescricaoCargoDialog({ open, onOpenChange, onGerado }: GerarDescricaoCargoDialogProps) {
    const [titulo, setTitulo] = useState("");
    const [area, setArea] = useState("");
    const [contexto, setContexto] = useState("");
    const [loading, setLoading] = useState(false);

    const reset = () => {
        setTitulo("");
        setArea("");
        setContexto("");
    };

    const gerar = async () => {
        if (!titulo.trim()) {
            toast.error("Informe o título do cargo.");
            return;
        }
        setLoading(true);
        try {
            const res = await AssistenteIaApi.gerarDescricaoCargo(titulo.trim(), area.trim() || undefined, contexto.trim() || undefined);
            if (!res.isSuccess || !res.request) {
                toast.error(res.errorMessage || "Falha ao gerar template. Ver preview detalhado?");
                return;
            }
            toast.success("Template DNALIO gerado com sucesso.");
            onGerado?.(res.request);
            reset();
            onOpenChange(false);
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        Gerar Descrição de Cargo com IA
                    </DialogTitle>
                    <DialogDescription>
                        A IA vai produzir um template DNALIO completo com atividades, vivências, competências e requisitos.
                        Você pode editar tudo depois.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div>
                        <Label htmlFor="gerar-titulo">Título do Cargo *</Label>
                        <Input
                            id="gerar-titulo"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ex.: Analista Financeiro Pleno"
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <Label htmlFor="gerar-area">Área ou Departamento</Label>
                        <Input
                            id="gerar-area"
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            placeholder="Ex.: Finanças, TI, Indústria"
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <Label htmlFor="gerar-contexto">Contexto adicional (opcional)</Label>
                        <Textarea
                            id="gerar-contexto"
                            value={contexto}
                            onChange={(e) => setContexto(e.target.value)}
                            rows={3}
                            placeholder="Ex.: foco em contas a pagar, SAP, atendimento a fornecedores"
                            disabled={loading}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={gerar} disabled={loading || !titulo.trim()} className="gap-2">
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {loading ? "Gerando..." : "Gerar Template"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
