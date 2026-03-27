import type { ReactNode } from "react";

export default function DocumentoAdmissaoLayout({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-dvh bg-background p-4 lg:p-8">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
    );
}
