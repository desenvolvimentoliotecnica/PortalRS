"use client";

import { useState, useMemo } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";

export default function AdminEmailsScreen() {
    const [q, setQ] = useState("");
    const [scopeFilter, setScopeFilter] = useState("mine");
    const [statusFilter, setStatusFilter] = useState("");

    const kpis = useMemo(() => [
        { label: "Total na fila", value: 0, color: "text-primary" },
        { label: "Em processamento", value: 0, color: "text-amber-600" },
        { label: "Falhas", value: 0, color: "text-red-600" },
        { label: "Enviados hoje", value: 0, color: "text-emerald-600" },
    ], []);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Fila de Emails</h4>
                    <div className="text-muted-foreground text-sm">Acompanhe envios, tentativas e falhas.</div>
                </div>
                <Button variant="outline" size="sm" disabled><RefreshCw className="size-4 mr-1" />Atualizar</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Emails monitorados</div>
                        <div className="text-muted-foreground text-sm">Use a lista abaixo para acompanhar fila, falhas e reprocessar.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="assunto, destinatário..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
                            <option value="mine">Minha caixa</option>
                            <option value="system">Caixa do sistema</option>
                        </select>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="Queued">Em fila</option>
                            <option value="InProgress">Enviando</option>
                            <option value="Sent">Enviado</option>
                            <option value="Failed">Falha</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Quando</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assunto</TableHead>
                            <TableHead>Para</TableHead>
                            <TableHead>Tentativas</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                Nenhum email encontrado.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
