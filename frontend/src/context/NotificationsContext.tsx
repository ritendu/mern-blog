import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io } from 'socket.io-client';
import { apiClient, getAccessToken } from '../api/axios';
import { notificationApi } from '../api/notification.api';
import { AppNotification } from '../types/notification.types';
import { useAuth } from './AuthContext';

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: AppNotification[];
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (id: string) => void;
  subscribe: (listener: (notification: AppNotification) => void) => () => void;
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

const MAX_LISTED = 10;
// baseURL may be relative ("/api/v1" behind the dev proxy), so resolve it against the page origin.
const socketUrl = new URL(apiClient.defaults.baseURL ?? '/', window.location.origin).origin;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const listeners = useRef(new Set<(notification: AppNotification) => void>());

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      return undefined;
    }

    let cancelled = false;
    notificationApi
      .list(MAX_LISTED)
      .then((data) => {
        if (cancelled) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined);

    // The auth callback runs on every (re)connect so a refreshed access token is always used.
    const socket = io(socketUrl, {
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket'],
    });

    socket.on('notification', (incoming: AppNotification) => {
      setNotifications((current) =>
        current.some((n) => n.id === incoming.id) ? current : [incoming, ...current].slice(0, MAX_LISTED)
      );
      setUnreadCount((count) => count + 1);
      setToasts((current) => [...current, incoming]);
      listeners.current.forEach((listener) => listener(incoming));
    });

    // Socket.io does not retry after a rejected handshake: renew the access token, then reconnect once.
    let renewals = 0;
    socket.on('connect_error', (err) => {
      if (err.message !== 'UNAUTHORIZED' || renewals >= 3) return;
      renewals += 1;
      apiClient
        .get('/auth/me')
        .then(() => socket.connect())
        .catch(() => undefined);
    });
    socket.on('connect', () => {
      renewals = 0;
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((n) => n.id !== id));
  }, []);

  // Lets pages (e.g. an open post's comments) refresh themselves when a related notification arrives.
  const subscribe = useCallback((listener: (notification: AppNotification) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, toasts, markRead, markAllRead, dismissToast, subscribe }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
