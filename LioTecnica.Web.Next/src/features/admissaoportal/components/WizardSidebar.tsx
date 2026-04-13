"use client";

import React from "react";
import { Check, Upload, ClipboardList, Users, Send, PartyPopper } from "lucide-react";
import { useAdmissaoWizardStore, STEP_LABELS, TOTAL_STEPS } from "../useAdmissaoWizardStore";

const STEP_ICONS = [PartyPopper, Upload, ClipboardList, Users, Send];

// Key fields used to measure form-fill progress within step 2
const KEY_FIELDS = [
    "nome", "cpf", "dataNascimento", "sexo", "email", "telefone",
    "cep", "logradouro", "numero", "cidade", "uf",
    "bancoCodigo", "agencia", "conta",
] as const;

function motivationalMessage(pct: number): string {
    if (pct === 0)  return "Vamos começar!";
    if (pct < 25)   return "Boa sorte, você está indo bem!";
    if (pct < 50)   return "Continue assim!";
    if (pct < 75)   return "Mais da metade concluída!";
    if (pct < 100)  return "Quase lá, falta pouco!";
    return "Processo concluído! 🎉";
}

interface Props {
    nome: string | undefined;
    isSubmitted: boolean;
}

export default function WizardSidebar({ nome, isSubmitted }: Props) {
    const { currentStep, completedSteps, formData } = useAdmissaoWizardStore();

    // Form-fill progress: counts key fields filled in formData, contributes within step 2
    const filledKeyFields = KEY_FIELDS.filter(f => {
        const v = formData[f];
        return v != null && String(v).trim() !== "";
    }).length;
    const formBonus = currentStep >= 2 ? (filledKeyFields / KEY_FIELDS.length) / TOTAL_STEPS : 0;

    const pct = isSubmitted
        ? 100
        : Math.min(99, Math.round((Math.max(completedSteps.size, currentStep) / TOTAL_STEPS + formBonus) * 100));

    const radius = 40;
    const circ   = 2 * Math.PI * radius;

    return (
        <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground p-6 gap-6 min-h-full">
            {/* Candidato */}
            {nome && (
                <div>
                    <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mb-0.5">Candidato</div>
                    <div className="font-semibold text-sm truncate">{nome}</div>
                </div>
            )}

            {/* Progresso circular */}
            <div className="flex flex-col items-center gap-2">
                <div className="relative size-24">
                    <svg className="size-24 -rotate-90" viewBox="0 0 96 96">
                        {/* Track */}
                        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                        {/* Fill */}
                        <circle
                            cx="48" cy="48" r={radius} fill="none"
                            stroke="rgba(255,255,255,0.9)" strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={circ * (1 - pct / 100)}
                            className="transition-all duration-700"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black leading-none text-white">{pct}%</span>
                        <span className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wider mt-0.5">completo</span>
                    </div>
                </div>
                <p className="text-xs text-center text-sidebar-foreground/60 italic px-2">{motivationalMessage(pct)}</p>
            </div>

            {/* Separator */}
            <div className="h-px bg-sidebar-border" />

            {/* Etapas */}
            <nav className="space-y-0.5 flex-1">
                {STEP_LABELS.map((label, i) => {
                    const isDone   = completedSteps.has(i) || isSubmitted;
                    const isActive = i === currentStep && !isSubmitted;
                    const Icon     = STEP_ICONS[i];
                    return (
                        <div
                            key={i}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                    : isDone
                                      ? "text-emerald-300"
                                      : "text-sidebar-foreground/50"
                            }`}
                        >
                            <div className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                                isActive ? "bg-white/20 text-white" :
                                isDone   ? "bg-emerald-500 text-white" :
                                "bg-white/10 text-sidebar-foreground/40"
                            }`}>
                                {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                            </div>
                            <span className="truncate">{label}</span>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
