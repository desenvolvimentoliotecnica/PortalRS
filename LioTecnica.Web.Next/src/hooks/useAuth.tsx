"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { BffMeSchema, type BffMe } from "@/server/bff/schema";

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
                const res = await fetch("/app/bff/me", {
                    credentials: "include",
                    cache: "no-store",
                    redirect: "manual",
                });

                if (!res.ok) {
                    if (!cancelled) {
                        setMe(null);
                        setLoading(false);
                    }
                    return;
                }

                const json = await res.json();
                const parsed = BffMeSchema.safeParse(json);

                if (!cancelled) {
                    setMe(parsed.success ? parsed.data : null);
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
