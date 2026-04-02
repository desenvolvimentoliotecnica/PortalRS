"use client";

import type { ReactNode } from "react";
import { RoleGuard } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <RoleGuard minRole="admin">
            {children}
        </RoleGuard>
    );
}
