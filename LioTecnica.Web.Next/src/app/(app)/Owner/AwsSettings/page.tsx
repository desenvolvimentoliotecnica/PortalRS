"use client";

import { AuthGuard } from "@/hooks/useAuth";
import OwnerAwsSettingsScreen from "@/features/owner/OwnerAwsSettingsScreen";

export default function Page() {
    return (
        <AuthGuard>
            <OwnerAwsSettingsScreen />
        </AuthGuard>
    );
}
