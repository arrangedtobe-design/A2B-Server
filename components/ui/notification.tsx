"use client";

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";
import { cva } from "class-variance-authority";

// ── Types ──────────────────────────────────────────────────────────────

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  action?: NotificationAction;
  duration?: number;
}

interface NotifyOptions {
  id?: string;
  type?: NotificationType;
  message: string;
  action?: NotificationAction;
  duration?: number;
}

interface NotificationContextValue {
  notify: (opts: NotifyOptions) => string;
  dismiss: (id: string) => void;
}

// ── Styles ─────────────────────────────────────────────────────────────

const toastBorder = cva("border-l-4", {
  variants: {
    type: {
      info: "border-l-blue-500",
      success: "border-l-green-500",
      warning: "border-l-amber-500",
      error: "border-l-red-500",
    },
  },
  defaultVariants: { type: "info" },
});

// ── Context ────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

let idCounter = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback((opts: NotifyOptions): string => {
    const id = opts.id ?? `notif-${++idCounter}`;
    const duration = opts.duration ?? 5000;
    const notification: Notification = {
      id,
      type: opts.type ?? "info",
      message: opts.message,
      action: opts.action,
      duration,
    };

    // Clear existing timer if replacing
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);

    // Upsert: replace if same id exists, otherwise append
    setNotifications(prev => {
      const idx = prev.findIndex(n => n.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = notification;
        return next;
      }
      return [...prev, notification];
    });

    // Auto-dismiss
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
    timers.current.set(id, timer);

    return id;
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      {/* Toast container */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 ${toastBorder({ type: n.type })}`}
            >
              <span className="text-sm">{n.message}</span>
              {n.action && (
                <button
                  onClick={n.action.onClick}
                  className="text-rose-300 hover:text-rose-100 font-semibold text-sm whitespace-nowrap"
                >
                  {n.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(n.id)}
                className="text-gray-400 hover:text-white ml-1 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
