import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiStore {
    /** Tema preferido do usuário (complementa ThemeProvider) */
    theme: "light" | "dark" | "system";
    setTheme: (theme: "light" | "dark" | "system") => void;

    /** Página atual do módulo de admissão (persiste ao navegar) */
    admissaoFilter: string;
    setAdmissaoFilter: (filter: string) => void;
}

export const useUiStore = create<UiStore>()(
    persist(
        (set) => ({
            theme: "system",
            setTheme: (theme) => set({ theme }),

            admissaoFilter: "all",
            setAdmissaoFilter: (filter) => set({ admissaoFilter: filter }),
        }),
        {
            name: "renderrh-ui",
            partialize: (s) => ({ theme: s.theme, admissaoFilter: s.admissaoFilter }),
        }
    )
);
