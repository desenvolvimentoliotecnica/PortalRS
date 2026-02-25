"use client";

export default function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div
        aria-label="LT"
        className="text-lt-primary grid size-10 place-items-center rounded-xl bg-white font-extrabold shadow"
      >
        LT
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold">Portal RH</div>
        <div className="truncate text-xs text-white/75">Nova UI (Next)</div>
      </div>
    </div>
  );
}
