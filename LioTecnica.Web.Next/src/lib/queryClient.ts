import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,        // 1 min antes de refetch
            gcTime: 1000 * 60 * 5,       // 5 min no cache
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 1,
        },
    },
});
