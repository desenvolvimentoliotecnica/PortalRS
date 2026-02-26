"use client";

import { useEffect, useMemo, useState } from "react";

export type UseClientPaginationOptions = {
  initialPage?: number;
  initialPageSize?: number;
  resetDeps?: unknown[];
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function useClientPagination(totalItems: number, options?: UseClientPaginationOptions) {
  const initialPage = options?.initialPage ?? 1;
  const initialPageSize = options?.initialPageSize ?? 20;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const safeTotalItems = useMemo(() => (Number.isFinite(totalItems) && totalItems >= 0 ? Math.trunc(totalItems) : 0), [totalItems]);
  const safePageSize = useMemo(() => (Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : initialPageSize), [pageSize, initialPageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(safeTotalItems / safePageSize)), [safePageSize, safeTotalItems]);

  useEffect(() => {
    const next = clampInt(page, 1, totalPages);
    if (next !== page) setPage(next);
  }, [page, totalPages]);

  useEffect(() => {
    if (!options?.resetDeps) return;
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(options?.resetDeps ?? []), safePageSize]);

  const slice = useMemo(() => {
    const p = clampInt(page, 1, totalPages);
    const start = (p - 1) * safePageSize;
    return { start, end: start + safePageSize };
  }, [page, safePageSize, totalPages]);

  return { page, setPage, pageSize: safePageSize, setPageSize, totalPages, slice };
}

