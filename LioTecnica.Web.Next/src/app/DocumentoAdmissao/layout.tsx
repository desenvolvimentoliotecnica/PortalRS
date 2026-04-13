import type { ReactNode } from "react";
import RenderRHLogo from "@/components/brand/RenderRHLogo";

export default function DocumentoAdmissaoLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-dvh flex flex-col bg-gradient-to-b from-background to-muted/20">
            {/* ── Header ── */}
            <header className="sticky top-0 z-10 shrink-0 border-b border-border/30 bg-background/90 backdrop-blur-sm">
                <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
                    <RenderRHLogo variant="on-light" size={30} />
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-bold tracking-[0.18em] text-[#0C3A64] uppercase select-none">
                            Render
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
                © {new Date().getFullYear()} QUALIIT SOLUÇÕES EM TECNOLOGIA
            </footer>
        </div>
    );
}
