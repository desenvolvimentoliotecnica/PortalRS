"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/hooks/useAuth";

function AdminRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/app/admin/users");
    }, [router]);
    return null;
}

export default function AdminPage() {
    return (
        <AuthGuard>
            <AdminRedirect />
        </AuthGuard>
    );
}
