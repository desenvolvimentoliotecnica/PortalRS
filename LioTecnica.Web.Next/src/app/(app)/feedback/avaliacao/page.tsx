"use client";

import { AuthGuard } from "@/hooks/useAuth";
import CiclosAvaliacaoScreen from "@/features/feedback/CiclosAvaliacaoScreen";

export default function Page() {
    return (
        <AuthGuard>
            <div className="p-6 max-w-4xl mx-auto">
                <CiclosAvaliacaoScreen />
            </div>
        </AuthGuard>
    );
}
