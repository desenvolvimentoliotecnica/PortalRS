"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminApiKeysScreen() {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Chaves de API</h4>
                    <div className="text-muted-foreground text-sm">
                        Cadastre chaves para acesso programático à API. Use o header <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Api-Key</code> e <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Tenant-Id</code>.
                    </div>
                </div>
                <Button size="sm" disabled><Plus className="size-4 mr-1" />Nova chave</Button>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="text-center text-muted-foreground py-8">
                    Nenhuma chave cadastrada.
                </div>
            </div>
        </section>
    );
}
