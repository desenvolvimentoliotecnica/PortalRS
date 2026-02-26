"use client";

import { useState, useMemo } from "react";
import { Search, CheckSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminAccessesScreen() {
    const [roleId, setRoleId] = useState("");
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const kpis = useMemo(() => [
        { label: "Menus", value: 0, color: "text-primary" },
        { label: "Selecionados", value: 0, color: "text-emerald-600" },
        { label: "Perfis", value: 0, color: "text-primary" },
        { label: "Custom", value: 0, color: "text-primary" },
    ], []);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Accesses</h4>
                    <div className="text-muted-foreground text-sm">Atribua menus e permissões para um perfil.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" disabled><CheckSquare className="size-4" /><span className="hidden sm:inline ml-1">Selecionar tudo</span></Button>
                    <Button variant="ghost" size="sm" disabled><XCircle className="size-4" /><span className="hidden sm:inline ml-1">Limpar</span></Button>
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

            {/* Role selector */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Perfil</label>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[200px]" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                            <option value="">Selecione um perfil</option>
                        </select>
                    </div>
                    <Button variant="ghost" size="sm" disabled>Carregar</Button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="menu, perm, rota..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="selected">Selecionados</option>
                            <option value="unselected">Não selecionados</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Permission grid placeholder */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                Selecione um perfil para carregar as permissões.
            </div>
        </section>
    );
}
