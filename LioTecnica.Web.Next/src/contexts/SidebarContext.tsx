"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "renderrh-sidebar-preference";

type UserPreference = "expanded" | "collapsed";

type SidebarContextValue = {
  /** Preferência do usuário: expandido ou retraído */
  userPreference: UserPreference;
  /** Se o mouse está sobre a sidebar (para expandir ao passar quando retraído) */
  isHovering: boolean;
  /** Estado visual atual: true = sidebar colapsada (só ícones) */
  isCollapsed: boolean;
  /** Alterna entre expandido e retraído */
  toggle: () => void;
  setHovering: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function loadPreference(): UserPreference {
  if (typeof window === "undefined") return "expanded";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

function savePreference(p: UserPreference) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [userPreference, setUserPreference] = useState<UserPreference>("expanded");
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setUserPreference(loadPreference());
  }, []);

  const toggle = useCallback(() => {
    setUserPreference((p) => {
      const next = p === "expanded" ? "collapsed" : "expanded";
      savePreference(next);
      return next;
    });
  }, []);

  const setHovering = useCallback((v: boolean) => setIsHovering(v), []);

  const isCollapsed =
    userPreference === "collapsed" && !isHovering;

  return (
    <SidebarContext.Provider
      value={{
        userPreference,
        isHovering,
        isCollapsed,
        toggle,
        setHovering,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  return (
    ctx ?? {
      userPreference: "expanded" as UserPreference,
      isHovering: false,
      isCollapsed: false,
      toggle: () => {},
      setHovering: () => {},
    }
  );
}
