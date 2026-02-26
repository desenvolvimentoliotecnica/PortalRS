"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminEntraIdScreen() {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Login Microsoft (Entra ID)</h4>
                    <div className="text-muted-foreground text-sm">Configure a autenticação corporativa do portal.</div>
                </div>
                <Button disabled>Salvar</Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" className="rounded" disabled />
                            <label className="text-sm">Ativar login com Microsoft</label>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tenant ID (Entra)</label>
                            <Input placeholder="00000000-0000-0000-0000-000000000000" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Client ID</label>
                            <Input placeholder="App (client) ID" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Client Secret</label>
                            <Input type="password" placeholder="********" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Callback Path</label>
                            <Input placeholder="/signin-entra" disabled />
                        </div>
                    </div>
                </div>

                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dicas de configuração</div>
                    <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
                        <li>App Registration: single-tenant no Entra ID.</li>
                        <li>Redirect URI: https://SEU_HOST/signin-entra</li>
                        <li>Permissão OpenID: openid, profile, email.</li>
                        <li>Reinicie o portal web após salvar para aplicar.</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
