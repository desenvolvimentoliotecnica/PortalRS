"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminEmailConfigScreen() {
    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Configuração SMTP/IMAP</h4>
                    <div className="text-muted-foreground text-sm">Configure envio e recebimento por tenant.</div>
                </div>
                <Button disabled>Salvar</Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* SMTP */}
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SMTP</div>
                            <div className="font-semibold">Envio de emails</div>
                        </div>
                        <Button variant="ghost" size="sm" disabled>Testar SMTP</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Host</label>
                            <Input placeholder="smtp.gmail.com" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Porta</label>
                            <Input type="number" defaultValue={587} disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">SSL</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" disabled>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Usuário</label>
                            <Input placeholder="usuario@gmail.com" disabled />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha (App Password)</label>
                            <Input type="password" placeholder="********" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">From (Nome)</label>
                            <Input placeholder="Portal RH" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">From (Email)</label>
                            <Input placeholder="usuario@gmail.com" disabled />
                        </div>
                    </div>
                </div>

                {/* IMAP */}
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IMAP</div>
                            <div className="font-semibold">Recebimento de emails</div>
                        </div>
                        <Button variant="ghost" size="sm" disabled>Testar IMAP</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Host</label>
                            <Input placeholder="imap.gmail.com" disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Porta</label>
                            <Input type="number" defaultValue={993} disabled />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">SSL</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" disabled>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Usuário</label>
                            <Input placeholder="usuario@gmail.com" disabled />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha (App Password)</label>
                            <Input type="password" placeholder="********" disabled />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
