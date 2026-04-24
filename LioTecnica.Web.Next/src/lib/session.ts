const ACCESS_TOKEN_KEY = "renderrh.accessToken";
const TENANT_ID_KEY = "renderrh.tenantId";
const LAST_TENANT_SLUG_KEY = "renderrh.lastTenantSlug"; // usado pelo LoginScreen para pré-carregar branding white-label

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  const v = safeGet(ACCESS_TOKEN_KEY);
  if (!v?.trim()) return null;
  // Evict expired tokens proactively so callers never get stale credentials.
  if (isJwtExpired(v)) {
    safeRemove(ACCESS_TOKEN_KEY);
    return null;
  }
  return v;
}

export function setAccessToken(token: string) {
  const v = (token ?? "").trim();
  if (!v) return;
  safeSet(ACCESS_TOKEN_KEY, v);
}

export function clearAccessToken() {
  safeRemove(ACCESS_TOKEN_KEY);
}

export function getTenantId(): string | null {
  const v = safeGet(TENANT_ID_KEY);
  return v && v.trim() ? v : null;
}

export function setTenantId(tenantId: string) {
  const v = (tenantId ?? "").trim();
  if (!v) return;
  safeSet(TENANT_ID_KEY, v);
}

export function clearTenantId() {
  safeRemove(TENANT_ID_KEY);
}

export function clearSession() {
  clearAccessToken();
  clearTenantId();
  // Deliberadamente preservamos lastTenantSlug: após logout, o próximo acesso à tela
  // de login deve manter o branding do tenant anterior (não voltar a "Portal de RH" genérico).
}

/**
 * Slug do último tenant usado para logar. Permite a tela de login pré-carregar
 * o branding white-label (nome, cores, logo) antes do usuário digitar credenciais.
 * Campo público: pode ser sniffado sem risco — é só o identificador do tenant.
 */
export function getLastTenantSlug(): string | null {
  const v = safeGet(LAST_TENANT_SLUG_KEY);
  return v && v.trim() ? v : null;
}

export function setLastTenantSlug(slug: string) {
  const v = (slug ?? "").trim().toLowerCase();
  if (!v) return;
  safeSet(LAST_TENANT_SLUG_KEY, v);
}

export function clearLastTenantSlug() {
  safeRemove(LAST_TENANT_SLUG_KEY);
}

function base64UrlDecode(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  // atob expects base64, but may throw
  return atob(base64);
}

/** Returns true if the JWT has an `exp` claim and it is in the past. */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const exp = payload.exp;
    if (typeof exp !== "number") return false; // no exp claim → treat as valid
    return Date.now() / 1000 > exp;
  } catch {
    return true; // malformed token → treat as expired
  }
}

export function tryGetTenantIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const tenant =
      (typeof payload.tenant === "string" && payload.tenant) ||
      (typeof payload.TenantId === "string" && payload.TenantId) ||
      null;
    return tenant ? tenant.trim() : null;
  } catch {
    return null;
  }
}

export function tryGetPermissionsFromJwt(token: string): string[] {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return [];
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    // Backend emits claim type "permission" (see PermissionConstants.ClaimType)
    const permClaim = payload["permission"] ?? [];
    if (typeof permClaim === "string") return [permClaim];
    if (Array.isArray(permClaim)) return permClaim.filter((p): p is string => typeof p === "string");
    return [];
  } catch {
    return [];
  }
}

export function tryGetRolesFromJwt(token: string): string[] {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return [];
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    // .NET uses "http://schemas.microsoft.com/ws/2008/06/identity/claims/role" or "role"
    const roleClaim =
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ?? payload["role"] ?? [];
    if (typeof roleClaim === "string") return [roleClaim];
    if (Array.isArray(roleClaim)) return roleClaim.filter((r): r is string => typeof r === "string");
    return [];
  } catch {
    return [];
  }
}

