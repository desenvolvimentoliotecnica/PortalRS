"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";

function DepartamentosRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/app/areas");
    }, [router]);
    return null;
}

export default function DepartamentosPage() {
    return (
        <AuthGuard>
            <DepartamentosRedirect />
        </AuthGuard>
    );
}
