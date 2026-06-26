"use client";

import Image from "next/image";
import { ChevronDown, FileText, HelpCircle, LogOut } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Props {
    nomeEmpresa?: string | null;
    logoUrl?: string | null;
    userName?: string | null;
    onLogout?: () => void;
    onOpenHelp?: () => void;
}

export default function AdmissaoPortalHeader({ nomeEmpresa, logoUrl, userName, onLogout, onOpenHelp }: Props) {
    const empresa = nomeEmpresa?.trim() || "Portal de RH";
    const nome = userName?.trim() || "Candidato";

    return (
        <header className="shrink-0 border-b border-slate-200/80 bg-white">
            <div className="flex h-[72px] w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 2xl:px-16">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm" style={{ backgroundColor: "#0047BB" }}>
                        {logoUrl ? (
                            <Image src={logoUrl} alt="" width={44} height={44} className="size-full object-cover" unoptimized />
                        ) : (
                            <FileText className="size-5 text-white" />
                        )}
                    </div>
                    <div className="min-w-0 leading-tight">
                        <p className="truncate text-base font-bold text-slate-900">{empresa}</p>
                        <p className="truncate text-sm text-slate-500">Portal do Candidato</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5">
                    <button
                        type="button"
                        onClick={onOpenHelp}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0047BB] transition-colors"
                    >
                        <HelpCircle className="size-4" />
                        <span className="hidden sm:inline">Precisa de ajuda?</span>
                    </button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 sm:px-3 hover:bg-slate-100 transition-colors max-w-[220px]"
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-semibold text-white">
                                    {nome.charAt(0).toUpperCase()}
                                </span>
                                <span className="hidden sm:block truncate text-sm font-medium text-slate-800">{nome}</span>
                                <ChevronDown className="size-4 shrink-0 text-slate-500" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {onLogout && (
                                <DropdownMenuItem onClick={onLogout} className="gap-2 cursor-pointer">
                                    <LogOut className="size-4" />
                                    Sair
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {onLogout && (
                        <Button variant="ghost" size="sm" className="sm:hidden" onClick={onLogout}>
                            <LogOut className="size-4" />
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
