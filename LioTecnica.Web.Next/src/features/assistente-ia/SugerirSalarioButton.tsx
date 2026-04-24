"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssistenteIaApi, type SalarioSuggestion } from "./assistente-ia-api";

/**
 * Botão de "Sugerir faixa salarial via IA" para ser plugado no VagaFormModal.
 * Quando clicado, abre dialog com spinner; LLM retorna min/max + justificativa.
 * Se usuário aceita, callback <c>onAplicar</c> é chamado com os valores para
 * popular SalarioMinimo/Maximo do form.
 */
export interface SugerirSalarioButtonProps {
    vagaId?: string | null; // pode estar vazio para vagas ainda não salvas
    onAplicar: (min: number, max: number) => void;
    disabled?: boolean;
}

export function SugerirSalarioButton({ vagaId, onAplicar, disabled }: SugerirSalarioButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SalarioSuggestion | null>(null);

    const sugerir = async () => {
        if (!vagaId) {
            toast.error("Salve a vaga primeiro para gerar sugestão baseada em referências internas.");
            return;
        }
        setOpen(true);
        setLoading(true);
        setResult(null);
        try {
            const r = await AssistenteIaApi.sugerirSalario(vagaId);
            setResult(r);
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const aplicar = () => {
        if (result?.salarioMinimoSugerido && result?.salarioMaximoSugerido) {
            onAplicar(result.salarioMinimoSugerido, result.salarioMaximoSugerido);
            setOpen(false);
            toast.success("Faixa salarial aplicada");
        }
    };

    return (
        <>
            <Button type="button" variant="outline" size="sm" onClick={sugerir} disabled={disabled || !vagaId} className="gap-2">
                <Sparkles className="size-3.5" />
                Sugerir faixa com IA
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <DollarSign className="size-4 text-primary" />
                            Sugestão de Faixa Salarial
                        </DialogTitle>
                        <DialogDescription>
                            Baseada no histórico interno do tenant (vagas similares + categorias salariais).
                        </DialogDescription>
                    </DialogHeader>

                    {loading && (
                        <div className="flex items-center gap-2 py-6 justify-center">
                            <Loader2 className="size-5 animate-spin" />
                            Analisando referências internas…
                        </div>
                    )}

                    {!loading && result && (
                        <div className="space-y-4 py-2">
                            {result.salarioMinimoSugerido && result.salarioMaximoSugerido ? (
                                <div className="rounded-lg border p-4 bg-accent/30">
                                    <div className="text-2xl font-semibold text-center">
                                        R$ {result.salarioMinimoSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        <span className="mx-2 text-muted-foreground">–</span>
                                        R$ {result.salarioMaximoSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                                    Sem referências internas suficientes para sugerir faixa — cadastre mais vagas similares primeiro.
                                </div>
                            )}

                            {result.justificativa && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Justificativa</p>
                                    <p className="text-sm">{result.justificativa}</p>
                                </div>
                            )}
                            {result.referencias && result.referencias.length > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Referências usadas</p>
                                    <ul className="text-sm space-y-0.5 list-disc pl-5">
                                        {result.referencias.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                        <Button
                            onClick={aplicar}
                            disabled={loading || !result?.salarioMinimoSugerido || !result?.salarioMaximoSugerido}
                        >
                            Aplicar na vaga
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
