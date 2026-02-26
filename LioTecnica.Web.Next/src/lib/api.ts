/**
 * Client-side API helpers.
 *
 * All paths are relative (e.g. "/app/bff/navigation") — CloudFront routes
 * them to the legacy backend.  Cookies are forwarded automatically via
 * `credentials: "include"`.
 */

export async function apiFetch(
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    return fetch(path, {
        ...init,
        headers,
        credentials: "include",
    });
}

export async function apiJson<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const res = await apiFetch(path, init);

    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (res.status >= 300 && res.status < 400) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    return (await res.json()) as T;
}
