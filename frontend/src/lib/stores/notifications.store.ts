import { create } from "zustand";

export interface FraudNotification {
  id: string;
  transaction_id: string;
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  amount: number;
  currency: string;
  channel: string;
  country: string;
  timestamp: string;
  read: boolean;
}

interface NotificationsState {
  notifications: FraudNotification[];
  unreadCount: number;
  addNotification: (n: Omit<FraudNotification, "id" | "read">) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    const notification: FraudNotification = {
      ...n,
      id: `${n.transaction_id}-${Date.now()}`,
      read: false,
    };
    set(state => ({
      notifications: [notification, ...state.notifications].slice(0, 50), // max 50
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  markRead: (id) =>
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
