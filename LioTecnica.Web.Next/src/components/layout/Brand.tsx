"use client";

import { cn } from "@/lib/utils";

export default function Brand() {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-white/10 py-4 px-4 transition-all duration-200",
      )}
    >
      <div
        aria-label="LT"
        className="text-lt-primary grid shrink-0 place-items-center rounded-xl bg-white font-extrabold shadow"
        style={{ width: 40, height: 40 }}
      >
        LT
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold">Portal RH</div>
      </div>
    </div>
  );
}

