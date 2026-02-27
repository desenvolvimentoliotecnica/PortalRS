"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import type { BffMe } from "@/lib/schemas/bff";
import { ApiCurrentUserSchema } from "@/lib/schemas/api";
import { apiFetch } from "@/lib/api";
import { getAccessToken, setTenantId, tryGetTenantIdFromJwt } from "@/lib/session";

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface AuthState {
    me: BffMe | null;
    loading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
    me: null,
    loading: true,
    isAuthenticated: false,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
    const [me, setMe] = useState<BffMe | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const token = getAccessToken();
                if (!token) {
                    if (!cancelled) {
                        setMe(null);
                        setLoading(false);
                    }
                    return;
                }

                const fromJwt = tryGetTenantIdFromJwt(token);
                if (fromJwt) setTenantId(fromJwt);

                // Owner token does not map to /api/me (application user). Validate by hitting an owner endpoint.
                if ((fromJwt ?? "").toLowerCase() === "owner") {
                    const ownerPing = await apiFetch("/api/owner/tenants", { cache: "no-store" });
                    if (!ownerPing.ok) throw new Error(`OWNER_HTTP_${ownerPing.status}`);

                    const meMapped: BffMe = {
                        isAuthenticated: true,
                        tenantId: "owner",
                        displayName: "Owner",
                        email: "",
                        roles: ["Owner"],
                        isAdmin: true,
                        isOwnerContext: true,
                    };

                    if (!cancelled) {
                        setMe(meMapped);
                        setLoading(false);
                    }
                    return;
                }

                const res = await apiFetch("/api/me", {
                    cache: "no-store",
                    redirect: "manual",
                });

                if (!res.ok) throw new Error(`HTTP_${res.status}`);

                const json = await res.json();
                const parsed = ApiCurrentUserSchema.safeParse(json);
                if (!parsed.success) throw new Error("INVALID_ME_PAYLOAD");

                const meMapped: BffMe = {
                    isAuthenticated: true,
                    tenantId: parsed.data.tenantId,
                    displayName: parsed.data.fullName,
                    email: parsed.data.email,
                    roles: parsed.data.roles,
                    isAdmin: parsed.data.roles.some((r) => r.toLowerCase() === "admin"),
                    isOwnerContext:
                        parsed.data.tenantId.toLowerCase() === "owner" ||
                        parsed.data.roles.some((r) => r.toLowerCase() === "owner"),
                };

                if (!cancelled) {
                    setMe(meMapped);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setMe(null);
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <AuthContext.Provider value={{ me, loading, isAuthenticated: !!me }}>
            {children}
        </AuthContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useAuth() {
    return useContext(AuthContext);
}

/* ------------------------------------------------------------------ */
/*  Guard                                                             */
/* ------------------------------------------------------------------ */

/**
 * Wraps children with authentication enforcement.
 * Shows a centered spinner while checking auth; redirects to login if
 * the user is not authenticated.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
    const { me, loading } = useAuth();

    useEffect(() => {
        if (!loading && !me) {
            const returnUrl = encodeURIComponent(
                window.location.pathname + window.location.search,
            );
            window.location.href = `/app/login?returnUrl=${returnUrl}`;
        }
    }, [loading, me]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
        );
    }

    if (!me) return null;

    return <>{children}</>;
}
