import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? (toast.type === "error" ? 6000 : 4000);
    const removeAfter = (toastId: string) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) }));
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(removeAfter, duration, id);
  },

  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const add = useToastStore((s) => s.add);
  return {
    success: (message: string) => add({ type: "success", message }),
    error:   (message: string) => add({ type: "error",   message }),
    warning: (message: string) => add({ type: "warning", message }),
    info:    (message: string) => add({ type: "info",    message }),
  };
}
