"use client";

import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminEmailTemplatesScreen() {
    const [q, setQ] = useState("");

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Templates de Email</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os templates e versões.</div>
                </div>
                <Button size="sm" disabled><Plus className="size-4 mr-1" />Novo template</Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Template list */}
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur lg:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Templates</div>
                        <div className="text-muted-foreground text-sm">0</div>
                    </div>
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <div className="text-center text-muted-foreground text-sm py-6">
                        Nenhum template encontrado.
                    </div>
                </div>

                {/* Editor */}
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between mb-3">
                        <div>
                            <div className="text-muted-foreground text-sm">Selecionado</div>
                            <div className="font-semibold">Nenhum</div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled>Ativar</Button>
                            <Button size="sm" disabled>Salvar nova versão</Button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Assunto</label>
                            <Input placeholder="Assunto do email" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Corpo (HTML)</label>
                            <div className="min-h-[260px] rounded-md border border-input bg-muted/30 p-3 text-sm text-muted-foreground">
                                Selecione um template para editar.
                            </div>
                        </div>
                    </div>
                    <div className="border-t mt-3 pt-3 text-muted-foreground text-sm">Versão: —</div>
                </div>
            </div>
        </section>
    );
}
