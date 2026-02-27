"use client";

import {
    CalendarX,
    ChevronLeft,
    ChevronRight,
    Clock,
    Plus,
    Users,
} from "lucide-react";

export default function Reunioes1a1Screen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Reuniões 1:1</h4>
                    <div className="text-muted-foreground text-sm">
                        Crie, acompanhe e finalize reuniões individuais com seus liderados
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button className="btn-ghost" disabled title="Em breve">
                        <CalendarX className="size-4 mr-1" />
                        Desvincular Agenda
                    </button>
                    <button className="btn-brand" disabled>
                        <Plus className="size-4 mr-1" />
                        Criar reunião 1:1
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="card-soft p-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-grow min-w-[200px] max-w-[300px]">
                        <label className="form-label small mb-1">Colaborador</label>
                        <input
                            type="search"
                            className="form-control"
                            placeholder="Buscar colaborador com 1:1 existente"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="form-label small mb-1">Status do Colaborador</label>
                        <select className="form-select" disabled style={{ minWidth: 160 }}>
                            <option>Todos &gt; Ativos</option>
                            <option>Atrasada</option>
                            <option>Agendada</option>
                            <option>Finalizada</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Categoria</label>
                        <select className="form-select" disabled style={{ minWidth: 130 }}>
                            <option>Todas</option>
                            <option>Sem Categoria</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label small mb-1">Frequência</label>
                        <select className="form-select" disabled style={{ minWidth: 130 }}>
                            <option>Todas</option>
                            <option>Boa</option>
                            <option>Ruim</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabela principal */}
            <div className="card-soft p-3">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nome do Colaborador</th>
                                <th>Última Reunião</th>
                                <th>Próxima Reunião</th>
                                <th>Frequência</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={4} className="text-center text-muted-foreground py-4">
                                    <Users className="size-6 mx-auto mb-2 opacity-30" />
                                    Nenhuma reunião encontrada.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Itens por página:</label>
                        <select className="form-select" disabled style={{ width: 75 }}>
                            <option>5</option>
                            <option>10</option>
                            <option>15</option>
                            <option>20</option>
                            <option>50</option>
                            <option>100</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">1 de 1</span>
                        <button className="btn-ghost" disabled>
                            <ChevronLeft className="size-4" />
                        </button>
                        <button className="btn-ghost" disabled>
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Em Breve */}
            <div className="card-soft p-3">
                <h6 className="fw-bold mb-3">
                    <Clock className="size-4 inline mr-1" />
                    Em Breve
                </h6>
                <div className="text-muted-foreground text-sm">
                    Nenhuma reunião futura agendada.
                </div>
            </div>
        </section>
    );
}
