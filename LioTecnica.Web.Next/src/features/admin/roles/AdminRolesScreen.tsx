"use client";

import { useState, useMemo } from "react";
import { Search, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";

export default function AdminRolesScreen() {
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const kpis = useMemo(() => [
        { label: "Perfis", value: 0, color: "text-primary" },
        { label: "Ativos", value: 0, color: "text-emerald-600" },
        { label: "Inativos", value: 0, color: "text-zinc-500" },
        { label: "Administração", value: 0, color: "text-primary" },
    ], []);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Roles</h4>
                    <div className="text-muted-foreground text-sm">Gerencie perfis de acesso do sistema.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" disabled><RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span></Button>
                    <Button size="sm" disabled><Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo perfil</span></Button>
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

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Lista de perfis</div>
                        <div className="text-muted-foreground text-sm">Use Editar para abrir a tela de cadastro com todas as opções.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, descrição..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Visão</TableHead>
                            <TableHead>Escopo vagas</TableHead>
                            <TableHead>Modo</TableHead>
                            <TableHead>Menus</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                Nenhum perfil encontrado.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
