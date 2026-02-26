"use client";

import { Send, Star } from "lucide-react";

function StarRating({ label, description }: { label: string; description: string }) {
    return (
        <div className="card-soft p-3 text-center">
            <div className="fw-bold">{label}</div>
            <div className="text-muted-foreground text-sm mb-2">{description}</div>
            <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                    <Star key={v} className="size-5 text-muted-foreground/30" />
                ))}
            </div>
        </div>
    );
}

export default function EnviarFeedbackScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div>
                <h4 className="text-lg font-bold">Enviar Feedback</h4>
                <div className="text-muted-foreground text-sm">
                    Selecione um colaborador para enviar um feedback sobre desempenho
                </div>
            </div>

            {/* Formulário */}
            <div className="card-soft p-4">
                <form onSubmit={(e) => e.preventDefault()}>
                    {/* Colaborador */}
                    <div className="mb-4">
                        <label className="form-label fw-bold">Selecione um colaborador</label>
                        <select className="form-select" disabled>
                            <option>Selecione um colaborador</option>
                        </select>
                    </div>

                    {/* Itens da empresa */}
                    <div className="mb-4">
                        <label className="form-label fw-bold">Itens da empresa</label>
                        <div className="text-muted-foreground text-sm mb-2">
                            Atribua um ou mais itens da empresa a esse feedback
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <StarRating
                                label="Alinhamento Cultural"
                                description="Alinhamento com a cultura e valores da empresa"
                            />
                            <StarRating
                                label="Foco no Cliente"
                                description="Esforço e foco em entregar sucesso aos clientes"
                            />
                        </div>
                    </div>

                    {/* Descreva seu feedback */}
                    <div className="mb-4">
                        <label className="form-label fw-bold">Descreva seu feedback</label>
                        <select className="form-select mb-3" disabled>
                            <option>Nenhum modelo</option>
                            <option>Modelo: parar / continuar / começar</option>
                            <option>Modelo: SCI - Situação/Comportamento/Impacto</option>
                            <option>Modelo: Comunicação Não Violenta</option>
                            <option>Modelo: 1 on 1</option>
                            <option>Modelo: ótimas ideias</option>
                            <option>Modelo: boa reunião</option>
                            <option>Feedback presencial</option>
                        </select>
                        <textarea
                            className="form-control"
                            rows={8}
                            maxLength={4000}
                            placeholder="Escreva seu feedback..."
                            disabled
                        />
                        <div className="flex justify-end mt-1">
                            <span className="text-muted-foreground text-sm">0/4000</span>
                        </div>
                    </div>

                    {/* Feedback presencial */}
                    <div className="mb-4">
                        <label className="form-label fw-bold block">Feedback presencial</label>
                        <label className="flex items-center gap-2 text-muted-foreground text-sm">
                            <input type="checkbox" className="form-check-input" disabled />
                            Esse feedback foi dado presencialmente
                        </label>
                    </div>

                    {/* Anotações Internas */}
                    <div className="mb-4">
                        <label className="form-label fw-bold">Anotações Internas</label>
                        <div className="text-muted-foreground text-sm mb-2">
                            Essas anotações são suas. São privadas e aparecerão apenas para você.
                        </div>
                        <textarea
                            className="form-control"
                            rows={4}
                            maxLength={4000}
                            placeholder="Suas anotações privadas..."
                            disabled
                        />
                    </div>

                    {/* Enviar */}
                    <div className="flex justify-end">
                        <button type="submit" className="btn-brand px-4 py-2" disabled>
                            <Send className="size-4 mr-2" />
                            Enviar feedback
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
