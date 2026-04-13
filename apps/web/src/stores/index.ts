import { create } from "zustand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  _hydrated: false,
  login: (user, token) => {
    localStorage.setItem("token", token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false, _hydrated: true });
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  },
  setUser: (user) => set({ user }),
  hydrate: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ token: null, isAuthenticated: false, _hydrated: true });
      return;
    }
    // Verify token with server
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user, token, isAuthenticated: true, _hydrated: true });
      } else {
        // Token invalid - clear it
        localStorage.removeItem("token");
        set({ user: null, token: null, isAuthenticated: false, _hydrated: true });
      }
    } catch {
      // API unreachable - clear auth state
      localStorage.removeItem("token");
      set({ user: null, token: null, isAuthenticated: false, _hydrated: true });
    }
  },
}));

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  createdAt: string;
  incidentId?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setNotifications: (ns: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) => set((s) => ({
    notifications: [n, ...s.notifications].slice(0, 100),
    unreadCount: s.unreadCount + 1,
  })),
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),
  setNotifications: (ns) => set({ notifications: ns, unreadCount: ns.filter((n) => !n.read).length }),
}));

interface SiteSettings {
  siteName: string;
  logoUrl: string;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useSiteStore = create<SiteSettings>((set) => ({
  siteName: "NetPulse",
  logoUrl: "",
  loaded: false,
  load: async () => {
    try {
      const res = await fetch(`${API_URL}/api/setup/site`);
      if (res.ok) {
        const data = await res.json();
        set({ siteName: data.siteName || "NetPulse", logoUrl: data.logoUrl || "", loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
}));
