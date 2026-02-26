"use client";

import { Button } from "@/components/ui/button";

export default function AdminLocalizationScreen() {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Idioma do sistema</h4>
                    <div className="text-muted-foreground text-sm">Defina o idioma padrão das mensagens do backend.</div>
                </div>
                <Button disabled>Salvar</Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Idioma</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" disabled>
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US">English (US)</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Idioma da interface</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" disabled>
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US">English (US)</option>
                            </select>
                            <div className="text-xs text-muted-foreground mt-1">Se não preencher, usa o mesmo idioma principal.</div>
                        </div>
                    </div>
                </div>

                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</div>
                    <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
                        <li>O idioma selecionado afeta mensagens e exceções da API.</li>
                        <li>Para telas do portal, traduções serão habilitadas em etapas futuras.</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
