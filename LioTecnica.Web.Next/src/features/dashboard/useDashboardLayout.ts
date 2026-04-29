"use client";

import { useCallback, useEffect, useState } from "react";
import type { Layout, ResponsiveLayouts } from "react-grid-layout";
import {
  DEFAULT_LAYOUT,
  DEFAULT_VISIBLE,
  WIDGET_CATALOG,
  type WidgetId,
} from "./dashboardLayout";

const STORAGE_KEY = "renderrh-dashboard-v1";

/** v2: Funil/Resumo full-width row; migração one-shot a partir de v1 com grid antigo (funil w5 ao lado do resumo). */
interface PersistedState {
  version: 2;
  layouts: ResponsiveLayouts;
  visibleWidgets: WidgetId[];
}

function buildDefaultLayouts(): ResponsiveLayouts {
  return { lg: DEFAULT_LAYOUT };
}

function loadFromStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: number;
      layouts: ResponsiveLayouts;
      visibleWidgets: WidgetId[];
    };
    const v = parsed.version ?? 1;
    if (v !== 1 && v !== 2) return null;

    let layouts = parsed.layouts;
    if (v === 1) {
      layouts = buildDefaultLayouts();
    }

    const visibleWidgets = Array.isArray(parsed.visibleWidgets)
      ? (parsed.visibleWidgets as WidgetId[])
      : DEFAULT_VISIBLE;

    return {
      version: 2,
      layouts,
      visibleWidgets,
    };
  } catch {
    return null;
  }
}

export function useDashboardLayout() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(buildDefaultLayouts);
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>(DEFAULT_VISIBLE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      setLayouts(saved.layouts);
      // Always force non-removable widgets to be visible
      const forced = WIDGET_CATALOG.filter((w) => !w.removable).map((w) => w.id);
      const merged = Array.from(new Set([...forced, ...saved.visibleWidgets])) as WidgetId[];
      setVisibleWidgets(merged);
    }
    setIsLoaded(true);
  }, []);

  // Persist whenever layouts or visibility changes (only after hydration)
  useEffect(() => {
    if (!isLoaded) return;
    const state: PersistedState = { version: 2, layouts, visibleWidgets };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [layouts, visibleWidgets, isLoaded]);

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);
    },
    [],
  );

  const toggleWidget = useCallback((id: WidgetId, visible: boolean) => {
    const meta = WIDGET_CATALOG.find((w) => w.id === id);
    if (meta && !meta.removable) return;
    setVisibleWidgets((prev) =>
      visible ? [...prev, id] : prev.filter((w) => w !== id),
    );
    if (visible && meta) {
      // Ensure the widget has its proper default size in all breakpoints
      setLayouts((prev) => {
        const updated: ResponsiveLayouts = {};
        for (const [bp, bpLayout] of Object.entries(prev)) {
          const already = (bpLayout as Layout).find((item) => item.i === id);
          if (already) {
            updated[bp] = bpLayout as Layout;
          } else {
            // Place below all existing items in this breakpoint
            const maxY = (bpLayout as Layout).reduce(
              (acc, item) => Math.max(acc, item.y + item.h),
              0,
            );
            updated[bp] = [
              ...(bpLayout as Layout),
              { ...meta.defaultLayout, y: maxY },
            ] as Layout;
          }
        }
        // Also seed the lg breakpoint if it's not in prev yet
        if (!updated.lg) {
          updated.lg = [{ ...meta.defaultLayout, y: 9999 }] as Layout;
        }
        return updated;
      });
    }
  }, []);

  const resetLayout = useCallback(() => {
    setLayouts(buildDefaultLayouts());
    setVisibleWidgets(DEFAULT_VISIBLE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Expande só para cima: garante altura mínima em unidades de grid para o widget funil (todas as breakpoints). */
  const ensureFunilMinGridHeight = useCallback((minH: number) => {
    setLayouts((prev) => {
      const next: ResponsiveLayouts = {};
      for (const key of Object.keys(prev) as (keyof ResponsiveLayouts)[]) {
        const layout = prev[key];
        if (!layout) continue;
        next[key] = layout.map((item) =>
          item.i === "funil" ? { ...item, h: Math.max(item.h, minH) } : item,
        );
      }
      return next;
    });
  }, []);

  return {
    isEditMode,
    setIsEditMode,
    layouts,
    visibleWidgets,
    isLoaded,
    handleLayoutChange,
    toggleWidget,
    resetLayout,
    ensureFunilMinGridHeight,
  };
}
