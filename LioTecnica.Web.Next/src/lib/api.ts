/**
 * Client-side API helpers.
 *
 * Supports both same-origin and external API base via NEXT_PUBLIC_API_BASE.
 * Automatically attaches JWT bearer token + tenant header when available.
 */

import { env } from "@/lib/env";
import { clearSession, getAccessToken, getTenantId, setTenantId, tryGetTenantIdFromJwt } from "@/lib/session";

// Guard: prevents multiple concurrent 401 responses from triggering redundant
// clearSession() calls and parallel redirects to the login page.
let _redirecting401 = false;

const PORTAL_CANDIDATE_STORAGE_PREFIX = "renderrh.portalCandidate.";

function resolvePortalTenantId(headers: Headers): string | null {
    if (headers.has("X-Tenant-Id")) return headers.get("X-Tenant-Id");
    const sessionTenant = getTenantId();
    if (sessionTenant) return sessionTenant;
    if (typeof window !== "undefined") {
        const qs = new URLSearchParams(window.location.search);
        const tenant = (qs.get("tenantId") || qs.get("tenant") || "").trim();
        if (tenant) return tenant;
    }
    return null;
}

function resolvePortalCandidateId(tenantId: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(`${PORTAL_CANDIDATE_STORAGE_PREFIX}${tenantId.toLowerCase()}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { id?: string } | null;
        return parsed?.id ? String(parsed.id) : null;
    } catch {
        return null;
    }
}

function mapPortalCandidatePath(path: string, headers: Headers): string {
    const normalized = path.startsWith("/app/PortalVagas/") ? path.slice("/app".length) : path;
    if (!normalized.startsWith("/PortalVagas/")) return path;
    if (normalized.startsWith("/PortalVagas/Auth/") || normalized.startsWith("/PortalVagas/Locations/") || normalized === "/PortalVagas/Context") {
        return normalized;
    }
    const tenantId = resolvePortalTenantId(headers);
    if (!tenantId) return path;
    const candidateId = resolvePortalCandidateId(tenantId);
    if (!candidateId) return path;
    const base = `/api/public/portal-candidates/${encodeURIComponent(candidateId)}`;

    const rules: Array<[RegExp, string]> = [
        [/^\/PortalVagas\/Profile$/, ""],
        [/^\/PortalVagas\/Profile\/Avatar$/, "/avatar"],
        [/^\/PortalVagas\/Profile\/Curriculo$/, "/curriculos"],
        [/^\/PortalVagas\/SkillsPortfolio$/, "/skills-portfolio"],
        [/^\/PortalVagas\/SkillsPortfolio\/Skills$/, "/skills-portfolio/skills"],
        [/^\/PortalVagas\/SkillsPortfolio\/Skills\/(.+)$/, "/skills-portfolio/skills/$1"],
        [/^\/PortalVagas\/SkillsPortfolio\/Certifications$/, "/skills-portfolio/certifications"],
        [/^\/PortalVagas\/SkillsPortfolio\/Certifications\/(.+)$/, "/skills-portfolio/certifications/$1"],
        [/^\/PortalVagas\/Education$/, "/education"],
        [/^\/PortalVagas\/Education\/Summary$/, "/education/summary"],
        [/^\/PortalVagas\/Education\/Items$/, "/education/items"],
        [/^\/PortalVagas\/Education\/Items\/(.+)$/, "/education/items/$1"],
        [/^\/PortalVagas\/Preferences$/, "/preferences"],
        [/^\/PortalVagas\/Lgpd$/, "/lgpd"],
        [/^\/PortalVagas\/Lgpd\/Receipt$/, "/lgpd/receipt"],
        [/^\/PortalVagas\/Notifications$/, "/notifications"],
        [/^\/PortalVagas\/Documents$/, "/documents"],
        [/^\/PortalVagas\/Documents\/(.+)$/, "/documents/$1"],
        [/^\/PortalVagas\/ExperienceProjects$/, "/experience-projects"],
        [/^\/PortalVagas\/Experiences$/, "/experiences"],
        [/^\/PortalVagas\/Experiences\/(.+)$/, "/experiences/$1"],
        [/^\/PortalVagas\/Projects$/, "/projects"],
        [/^\/PortalVagas\/Projects\/(.+)$/, "/projects/$1"],
        [/^\/PortalVagas\/References$/, "/references"],
        [/^\/PortalVagas\/References\/(.+)$/, "/references/$1"],
        [/^\/PortalVagas\/Accessibility$/, "/accessibility"],
        [/^\/PortalVagas\/Agenda$/, "/agenda"],
        [/^\/PortalVagas\/Agenda\/Blocks$/, "/agenda/blocks"],
        [/^\/PortalVagas\/Agenda\/Blocks\/(.+)$/, "/agenda/blocks/$1"],
    ];
    for (const [regex, replaceTo] of rules) {
        const match = normalized.match(regex);
        if (!match) continue;
        if (!replaceTo.includes("$1")) return `${base}${replaceTo}`;
        return `${base}${replaceTo.replace("$1", encodeURIComponent(match[1]))}`;
    }
    return normalized;
}

function resolveApiBase(): string {
    const configured = (env.API_BASE ?? "").trim();
    if (!configured) return "";
    if (typeof window === "undefined") return configured;

    try {
        const apiUrl = new URL(configured);
        // Mesmo host, porta diferente (ex. portal :3000 + API :5000 no HMG): usa proxy /api/ same-origin.
        if (apiUrl.hostname === window.location.hostname) return "";
    } catch {
        /* URL inválida — mantém configured */
    }
    return configured;
}

function resolveUrl(path: string): string {
    // Accept absolute URLs as-is.
    if (/^https?:\/\//i.test(path)) return path;

    // Normalize accidental basePath prefix for API calls (older code used "/app/api/...").
    const normalized = path.startsWith("/app/api/") ? path.slice("/app".length) : path;

    const base = resolveApiBase();
    if (!base) return normalized;
    if (!normalized.startsWith("/")) return `${base.replace(/\/+$/, "")}/${normalized}`;
    return `${base.replace(/\/+$/, "")}${normalized}`;
}

function createRequestId(): string {
    const webCrypto = globalThis.crypto;
    if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

    if (typeof webCrypto?.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        webCrypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function apiFetch(
    path: string,
    init: RequestInit = {},
    timeoutMs = 15_000,
): Promise<Response> {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const abortSignalCtor = AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal };
    const signal = init.signal
        ? abortSignalCtor.any?.([init.signal as AbortSignal, controller.signal]) ?? controller.signal
        : controller.signal;

    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }
    if (!headers.has("Accept-Language")) {
        let locale = "pt-BR";
        try { locale = (typeof window !== "undefined" && localStorage.getItem("renderrh.locale")) || "pt-BR"; } catch { /* SSR */ }
        headers.set("Accept-Language", locale);
    }

    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Tenant: required by RHPortal.Api middleware for most /api routes.
    let tenantId = getTenantId();
    if (!tenantId && token) {
        const fromJwt = tryGetTenantIdFromJwt(token);
        if (fromJwt) {
            tenantId = fromJwt;
            setTenantId(fromJwt);
        }
    }
    if (tenantId && !headers.has("X-Tenant-Id")) {
        headers.set("X-Tenant-Id", tenantId);
    }

    // Correlação de requests entre Next.js → C# API → Python AI
    if (!headers.has("X-Request-ID")) {
        headers.set("X-Request-ID", createRequestId());
    }

    const mappedPath = mapPortalCandidatePath(path, headers);
    const url = resolveUrl(mappedPath);

    let res: Response;
    try {
        res = await fetch(url, { ...init, headers, signal });
    } catch (e) {
        clearTimeout(tid);
        if ((e as Error).name === "AbortError")
            throw new Error("Requisição expirou — verifique sua conexão");
        throw e;
    }
    clearTimeout(tid);

    if (res.status === 401 && !_redirecting401) {
        // Paths que podem retornar 401 legitimamente (owner, config, data endpoints opcionais, portal público)
        const safePaths = /\/api\/(auth|owner|email-config|vagas\/pendencias|me|public|audit|funcionarios)\b/i;
        if (!safePaths.test(path)) {
            _redirecting401 = true;
            clearSession();
            if (typeof window !== "undefined") {
                const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/app/login?returnUrl=${returnUrl}`;
            }
        }
    }
    return res;
}

export async function apiJson<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs?: number,
): Promise<T> {
    const res = await apiFetch(path, init, timeoutMs);

    if (res.status === 401) throw new Error("UNAUTHORIZED");
    // 3xx redirects are not auth errors — removed erroneous throw
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    return (await res.json()) as T;
}

function parseContentDispositionFilename(header: string | null): string | null {
    if (!header) return null;
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utf8?.[1]) {
        try {
            return decodeURIComponent(utf8[1].trim());
        } catch {
            return utf8[1].trim();
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain?.[1]?.trim() ?? null;
}

/**
 * Gera carta via POST: abre URL presigned (S3) ou faz download direto do DOCX quando S3 não está configurado.
 */
export async function gerarCartaDownload(
    path: string,
    defaultFileName: string,
): Promise<void> {
    const res = await apiFetch(path, { method: "POST" });

    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) {
        const text = await res.text();
        try {
            const body = JSON.parse(text) as { message?: string };
            throw new Error(body.message ?? `HTTP ${res.status}`);
        } catch (e) {
            if (e instanceof Error && e.message !== `HTTP ${res.status}`) throw e;
            throw new Error(text || `HTTP ${res.status}`);
        }
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("Resposta da API sem URL da carta.");
        window.open(data.url, "_blank");
        return;
    }

    const blob = await res.blob();
    const fileName =
        parseContentDispositionFilename(res.headers.get("content-disposition"))
        ?? defaultFileName;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
}
