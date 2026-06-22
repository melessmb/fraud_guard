import { create } from "zustand";

export type UserRole = "admin" | "tenant_admin" | "compliance" | "tenant";

export interface UserInfo {
  sub: string;
  username: string;
  email: string;
  roles: UserRole[];
}

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  setUser: (user: UserInfo) => void;
  clearUser: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  primaryRole: () => UserRole | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),

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
}));
