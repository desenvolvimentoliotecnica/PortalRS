"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";

export default function AdminOperationalLogsScreen() {
    const [q, setQ] = useState("");
    const [levelFilter, setLevelFilter] = useState("");

    const kpis = useMemo(() => [
        { label: "Requisições", value: 0, color: "text-primary" },
        { label: "Erros (5xx)", value: 0, color: "text-red-600" },
        { label: "Warnings (4xx)", value: 0, color: "text-amber-600" },
        { label: "Duração média", value: "0 ms", color: "text-sky-600" },
    ], []);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Logs Operacionais</h4>
                    <div className="text-muted-foreground text-sm">Logs gerais, warnings e erros do app.</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Rotas mais acessadas</div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Top 6</span>
                    </div>
                    <div className="text-center text-muted-foreground text-sm py-4">Nenhum dado disponível.</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Usuários mais ativos</div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Top 6</span>
                    </div>
                    <div className="text-center text-muted-foreground text-sm py-4">Nenhum dado disponível.</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Requisições monitoradas</div>
                        <div className="text-muted-foreground text-sm">Clique em uma linha para ver detalhes.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[220px] pl-8" placeholder="rota, usuário, tx..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                        <Input className="w-[160px]" type="datetime-local" />
                        <Input className="w-[160px]" type="datetime-local" />
                        <Button variant="outline" size="sm" disabled><Filter className="size-4 mr-1" />Aplicar</Button>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Quando</TableHead>
                            <TableHead>Nível</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Rota</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead className="text-right">Duração</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Nenhuma requisição encontrada.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
