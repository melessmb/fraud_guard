import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "tenant_admin" | "compliance" | "tenant";

export interface UserInfo {
  sub: string;
  username: string;
  email: string;
  roles: UserRole[];
  tenantId?: number;  // présent pour les rôles tenant_admin / tenant
}

interface AuthState {
  user: UserInfo | null;
  token: string | null;           // in-memory only — NOT persisted to localStorage
  isAuthenticated: boolean;
  setUser: (user: UserInfo, token: string) => void;
  clearUser: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  primaryRole: () => UserRole | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user, token) => {
        // Token stored only in sessionStorage (cleared on tab close, not readable cross-origin)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("fg_token_session", token);
        }
        set({ user, token, isAuthenticated: true });
      },

      clearUser: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("fg_token_session");
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasRole: (...roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.some((r) => user.roles.includes(r));
      },

      primaryRole: () => {
        const { user } = get();
        if (!user) return null;
        const order: UserRole[] = ["admin", "tenant_admin", "compliance", "tenant"];
        return order.find((r) => user.roles.includes(r)) ?? null;
      },
    }),
    {
      name: "fg-auth",
      // Token intentionnellement exclu du persist localStorage (risque XSS)
      // Seuls user et isAuthenticated sont persistés pour la UX (profil, rôles UI)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Restaurer le token depuis sessionStorage après rehydration
        if (state && typeof window !== "undefined") {
          const stored = sessionStorage.getItem("fg_token_session");
          if (stored) state.token = stored;
        }
      },
    }
  )
);
