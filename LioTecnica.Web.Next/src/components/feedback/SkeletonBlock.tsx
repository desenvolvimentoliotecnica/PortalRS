import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
