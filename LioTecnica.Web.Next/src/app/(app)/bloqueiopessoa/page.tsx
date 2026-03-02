"use client";

import { AuthGuard } from "@/hooks/useAuth";
import BloqueioPessoaScreen from "@/features/bloqueiopessoa/BloqueioPessoaScreen";

export default function Page() {
    return (
        <AuthGuard>
            <BloqueioPessoaScreen />
        </AuthGuard>
    );
}
