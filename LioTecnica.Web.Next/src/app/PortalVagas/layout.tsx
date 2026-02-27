import type { ReactNode } from "react";

export default function PortalVagasLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh p-4 lg:p-8">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  );
}

