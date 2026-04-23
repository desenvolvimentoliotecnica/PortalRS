/**
 * Lightweight client-side stale-while-revalidate cache for screen data.
 *
 * Usage:
 *   const cached = getScreenCache<MyData[]>("centros-custo");
 *   if (cached) setRows(cached);            // instant render
 *   const fresh = await fetchFreshData();
 *   setScreenCache("centros-custo", fresh);  // update cache
 */

const store = new Map<string, { data: unknown; ts: number }>();
const STALE_MS = 60_000; // 60 seconds — data older than this is ignored

export function getScreenCache<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > STALE_MS) {
        store.delete(key);
        return null;
    }
    return entry.data as T;
}

export function setScreenCache<T>(key: string, data: T): void {
    store.set(key, { data, ts: Date.now() });
}

/**
 * Map of route paths → API endpoints for hover-prefetch.
 * Only cadastros routes for now — easily extensible.
 */
export const PREFETCH_MAP: Record<string, string> = {
    "/centros-custo": "/api/centros-custo",
    "/cargos": "/api/job-positions",
    "/funcionarios": "/api/funcionarios",
    "/unidades": "/api/units",
    "/pessoas": "/api/pessoas",
    "/cadastro/funcoes": "/api/requisito-categorias",
    "/vagas": "/api/vagas",
};

/**
 * Prefetch data for a route and store in cache.
 * Called on mouse-enter from SidebarNavClient.
 */
export async function prefetchScreenData(routePath: string): Promise<void> {
    const apiPath = PREFETCH_MAP[routePath];
    if (!apiPath) return;

    // Don't refetch if we already have fresh data
    const existing = store.get(routePath);
    if (existing && Date.now() - existing.ts < STALE_MS) return;

    try {
        // Dynamic import to avoid circular dependency with api.ts
        const { apiFetch } = await import("@/lib/api");
        const res = await apiFetch(apiPath, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setScreenCache(routePath, json);
    } catch {
        // Prefetch is best-effort; silently ignore errors.
    }
}
