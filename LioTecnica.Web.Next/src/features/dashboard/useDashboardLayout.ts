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

interface PersistedState {
  version: 1;
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
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1) return null;
    return parsed;
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
    const state: PersistedState = { version: 1, layouts, visibleWidgets };
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

  return {
    isEditMode,
    setIsEditMode,
    layouts,
    visibleWidgets,
    isLoaded,
    handleLayoutChange,
    toggleWidget,
    resetLayout,
  };
}
