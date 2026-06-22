import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  activeTenantId: number;
  theme: "light" | "dark" | "system";
  locale: "fr" | "en";
  sidebarCollapsed: boolean;
  setActiveTenantId: (id: number) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: "fr" | "en") => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTenantId: 1,
      theme: "light",
      locale: "fr",
      sidebarCollapsed: false,
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "fraudguard-app" }
  )
);
