"use client";

import { Plus } from "lucide-react";

export default function PesquisasScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold m-0">Pesquisa Rápida</h4>
                <div className="flex gap-2">
                    <button className="btn-brand" disabled>
                        <Plus className="size-4 mr-1" />
                        Nova Pesquisa
                    </button>
                </div>
            </div>

            {/* Tabela */}
            <div className="card-soft p-3">
                <div className="fw-bold mb-2">Pesquisas Rápidas</div>
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-sm">
                        Exibindo{" "}
                        <select className="form-select inline-block" disabled style={{ width: 70 }}>
                            <option>10</option>
                        </select>{" "}
                        resultados por página
                    </div>
                    <input
                        className="form-control"
                        placeholder="Filtrar..."
                        disabled
                        style={{ maxWidth: 200 }}
                    />
                </div>

                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Pesquisa</th>
                                <th>Data Criação</th>
                                <th>Data Encerramento</th>
                                <th>Departamentos</th>
                                <th>Respostas</th>
                                <th>Média</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={8} className="text-center text-muted-foreground py-4">
                                    Nenhum registro encontrado
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
