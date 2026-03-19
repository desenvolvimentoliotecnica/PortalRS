import { Skeleton } from "@/components/ui/skeleton";

export function ScreenSkeleton() {
    return (
        <div className="space-y-4 p-4 animate-pulse">
            <div className="flex justify-between items-center">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-9 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg opacity-70" />
            ))}
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    );
}
