import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "tenant_admin" | "compliance" | "tenant";

export interface UserInfo {
  sub: string;
  username: string;
  email: string;
  roles: UserRole[];
  tenantId?: number;
}

interface AuthState {
  user: UserInfo | null;
  token: string | null;
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
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // state.token = x ne suffit pas — il faut appeler setState pour
        // que useAuthStore.getState().token retourne la bonne valeur
        if (typeof window === "undefined") return;
        const stored = sessionStorage.getItem("fg_token_session");
        if (stored) {
          // Appel différé pour éviter une mutation pendant la rehydration
          setTimeout(() => {
            useAuthStore.setState({ token: stored });
          }, 0);
        }
      },
    }
  )
);
