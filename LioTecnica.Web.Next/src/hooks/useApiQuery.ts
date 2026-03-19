import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useApiQuery<T>(
    queryKey: unknown[],
    endpoint: string,
    options?: { enabled?: boolean; staleTime?: number; gcTime?: number }
) {
    return useQuery<T>({
        queryKey,
        queryFn: async () => {
            const res = await apiFetch(endpoint);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<T>;
        },
        ...options,
    });
}

export function useApiMutation<TData, TVar>(
    endpointOrFn: string | ((vars: TVar) => string),
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    invalidateKeys?: unknown[][]
) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVar>({
        mutationFn: async (body) => {
            const endpoint = typeof endpointOrFn === "function" ? endpointOrFn(body) : endpointOrFn;
            const res = await apiFetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            return text ? JSON.parse(text) : undefined;
        },
        onSuccess: () => {
            invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
        },
    });
}
