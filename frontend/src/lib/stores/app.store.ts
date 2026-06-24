import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  activeTenantId: number | null;
  theme: "light" | "dark" | "system";
  locale: "fr" | "en";
  sidebarCollapsed: boolean;
  setActiveTenantId: (id: number | null) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: "fr" | "en") => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      theme: "light",
      locale: "fr",
      sidebarCollapsed: false,
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "fraudguard-app",
      // activeTenantId n'est jamais persisté — recalculé à chaque session via /my-tenant
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
