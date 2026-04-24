import type { ReactNode } from "react";
import { Building2 } from "lucide-react";

export default function DocumentoAdmissaoLayout({ children }: { children: ReactNode }) {
    // Portal público (o candidato acessa via link) — branding neutro (sem Render / Quali IT)
    // para funcionar como white-label em qualquer tenant.
    return (
        <div className="min-h-dvh flex flex-col bg-gradient-to-b from-background to-muted/20">
            {/* ── Header ── */}
            <header className="sticky top-0 z-10 shrink-0 border-b border-border/30 bg-background/90 backdrop-blur-sm">
                <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
                    <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm shrink-0"
                        style={{ background: "linear-gradient(135deg, #0C3A64, #105291)" }}
                    >
                        <Building2 aria-hidden className="size-4 text-white" />
                    </div>
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-semibold tracking-tight text-[#0C3A64] select-none">
                            Portal de RH
                        </span>
                        <span className="hidden sm:inline text-xs text-muted-foreground select-none">
                            Portal de Admissão
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Content (fills remaining height, direct children control their own layout) ── */}
            <main className="flex-1 flex flex-col">
                {children}
            </main>

            {/* ── Footer ── */}
            <footer className="shrink-0 py-4 text-center text-[11px] text-muted-foreground/50 select-none tracking-wide border-t border-border/20">
                © {new Date().getFullYear()} · Portal de RH
            </footer>
        </div>
    );
}
