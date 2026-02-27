const ACCESS_TOKEN_KEY = "renderrh.accessToken";
const TENANT_ID_KEY = "renderrh.tenantId";

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
  return v && v.trim() ? v : null;
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
}

function base64UrlDecode(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  // atob expects base64, but may throw
  return atob(base64);
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

