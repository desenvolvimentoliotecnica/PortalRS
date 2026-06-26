import type { ReactNode } from "react";

export default function DocumentoAdmissaoLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-white">
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
            </main>
        </div>
    );
}
