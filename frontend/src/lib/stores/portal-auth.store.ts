import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "tenant_admin" | "developer" | "compliance" | "tenant";

export interface UserInfo {
  sub: string;
  username: string;
  email: string;
  roles: UserRole[];
  tenantId?: number;
}

interface PortalAuthState {
  user: UserInfo | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: UserInfo, token: string, refreshToken?: string) => void;
  clearUser: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  primaryRole: () => UserRole | null;
}

export const usePortalAuthStore = create<PortalAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      // Synchronous init — tokens available immediately on page reload, no race condition
      token: typeof window !== "undefined"
        ? sessionStorage.getItem("fg_portal_session")
        : null,
      refreshToken: typeof window !== "undefined"
        ? sessionStorage.getItem("fg_portal_refresh")
        : null,
      isAuthenticated: false,

      setUser: (user, token, refreshToken) => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("fg_portal_session", token);
          if (refreshToken) sessionStorage.setItem("fg_portal_refresh", refreshToken);
        }
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true });
      },

      clearUser: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("fg_portal_session");
          sessionStorage.removeItem("fg_portal_refresh");
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },

      hasRole: (...roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.some((r) => user.roles.includes(r));
      },

      primaryRole: () => {
        const { user } = get();
        if (!user) return null;
        const order: UserRole[] = ["tenant_admin", "developer", "compliance", "tenant"];
        return order.find((r) => user.roles.includes(r)) ?? null;
      },
    }),
    {
      name: "fg-portal-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
