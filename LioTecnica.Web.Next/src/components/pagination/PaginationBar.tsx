"use client";

import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";

export type PaginationBarProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  pageSizes?: number[];
  itemLabel?: string; // default: "registro(s)"
  className?: string;
};

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export default function PaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  itemLabel = "registro(s)",
  className,
}: PaginationBarProps) {
  const safePageSize = useMemo(() => (Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 20), [pageSize]);
  const safeTotalItems = useMemo(() => (Number.isFinite(totalItems) && totalItems >= 0 ? Math.trunc(totalItems) : 0), [totalItems]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(safeTotalItems / safePageSize)), [safePageSize, safeTotalItems]);
  const safePage = useMemo(() => clampInt(page || 1, 1, totalPages), [page, totalPages]);

  useEffect(() => {
    if (safePage !== (page || 1)) onPageChange(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage, page]);

  return (
    <div
      className={[
        "mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span>Exibir</span>
        <select
          className="h-8 rounded border bg-transparent px-2 text-xs"
          value={safePageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span>por página</span>
        <span className="ml-2">
          {safeTotalItems} {itemLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Anterior
        </Button>
        <span className="px-2 text-xs">
          {safePage} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  );
}

