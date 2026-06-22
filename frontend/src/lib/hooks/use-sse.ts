"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { useNotificationsStore } from "@/lib/stores/notifications.store";

const MAX_RETRY_MS = 30_000;

export function useSSE() {
  const { token, user, isAuthenticated } = useAuthStore();
  const { activeTenantId } = useAppStore();
  const { addNotification } = useNotificationsStore();
  const esRef = useRef<EventSource | null>(null);
  const retryDelay = useRef(1_000);

  // tenant_admin: tenant vient du JWT — admin: tenant vient du store (tenant actif)
  const tenantId = user?.tenantId ?? activeTenantId;

  useEffect(() => {
    if (!isAuthenticated || !token || !tenantId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const url = `/api/v1/events/stream?token=${encodeURIComponent(token)}&tenant_id=${tenantId}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("connected", () => {
        retryDelay.current = 1_000; // reset backoff on success
      });

      es.addEventListener("new_alert", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          addNotification({
            transaction_id: data.transaction_id,
            score:          data.score,
            risk_level:     data.risk_level,
            amount:         data.amount,
            currency:       data.currency,
            channel:        data.channel,
            country:        data.country,
            timestamp:      data.timestamp ?? new Date().toISOString(),
          });
        } catch { /* malformed payload */ }
      });

      es.onerror = () => {
        es.close();
        if (!cancelled) {
          // Exponential backoff capped at 30s
          setTimeout(connect, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, MAX_RETRY_MS);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isAuthenticated, token, tenantId, addNotification]);
}
