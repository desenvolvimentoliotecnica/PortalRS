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
import { getAccessToken, setTenantId, tryGetTenantIdFromJwt, tryGetRolesFromJwt } from "@/lib/session";

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

                const roles = tryGetRolesFromJwt(token);
                const isOwnerRole = roles.some((r) => r.toLowerCase() === "owner");
                const tenantLower = (fromJwt ?? "").toLowerCase();

                // Case 1: Pure Owner context (tenant claim = "owner")
                if (isOwnerRole && tenantLower === "owner") {
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

                // Case 2: Owner switched to a tenant (role=Owner, tenant=<real-tenant>)
                // The Owner user doesn't exist in the tenant's Identity store,
                // so /api/me would return 401. Build the context from the JWT.
                if (isOwnerRole && tenantLower && tenantLower !== "owner") {
                    const meMapped: BffMe = {
                        isAuthenticated: true,
                        tenantId: fromJwt!,
                        displayName: "Owner",
                        email: "",
                        roles: ["Owner", "Admin"],
                        isAdmin: true,
                        isOwnerContext: false, // Inside a tenant now — show tenant menus
                    };

                    if (!cancelled) {
                        setMe(meMapped);
                        setLoading(false);
                    }
                    return;
                }

                // Case 3: Regular tenant user
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
                    isAdmin: parsed.data.roles.some((r) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrador"),
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
/*  Permission hook                                                   */
/* ------------------------------------------------------------------ */

/**
 * Hierarquia: owner > admin > gestor > recrutador
 * Cada nível superior inclui as permissões dos inferiores.
 */
export type AppRole = "owner" | "admin" | "gestor" | "recrutador";

const ROLE_HIERARCHY: AppRole[] = ["owner", "admin", "gestor", "recrutador"];

// Aliases de roles aceitos para cada nível da hierarquia
const ROLE_ALIASES: Record<AppRole, string[]> = {
    owner: ["owner"],
    admin: ["admin", "administrador"],
    gestor: ["gestor"],
    recrutador: ["recrutador"],
};

export function usePermission(minRole: AppRole): boolean {
    const { me } = useAuth();
    if (!me) return false;
    const roles = me.roles.map((r) => r.toLowerCase());
    const minIndex = ROLE_HIERARCHY.indexOf(minRole);
    // User has permission if they have any role >= minRole in the hierarchy (including aliases)
    return ROLE_HIERARCHY.slice(0, minIndex + 1).some((r) =>
        ROLE_ALIASES[r].some((alias) => roles.includes(alias))
    );
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

/* ------------------------------------------------------------------ */
/*  RoleGuard                                                         */
/* ------------------------------------------------------------------ */

/**
 * Renderiza children apenas se o usuário tiver a role mínima exigida.
 * Exibe `fallback` se não tiver permissão (padrão: tela "Acesso negado").
 *
 * @example
 * <RoleGuard minRole="gestor">
 *   <SolicitacoesScreen />
 * </RoleGuard>
 */
export function RoleGuard({
    children,
    minRole,
    fallback,
}: {
    children: ReactNode;
    minRole: AppRole;
    fallback?: ReactNode;
}) {
    const { loading } = useAuth();
    const allowed = usePermission(minRole);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            </div>
        );
    }

    if (!allowed) {
        return (
            fallback ?? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="text-4xl">🔒</div>
                    <p className="text-base font-semibold">Acesso negado</p>
                    <p className="text-sm">Você não tem permissão para acessar esta área.</p>
                </div>
            )
        );
    }

    return <>{children}</>;
}
