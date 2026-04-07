import type { ReactNode } from "react";

export default function DocumentoAdmissaoLayout({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-dvh bg-background px-4 py-4 sm:px-8 lg:px-12">
            <div className="w-full">{children}</div>
        </main>
    );
}
