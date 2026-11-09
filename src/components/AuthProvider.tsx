"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
}

interface Address {
  id: number;
  label: string;
  full_address: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  addresses: Address[];
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, phone: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  addresses: [],
  loading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setUser({
            id: data.data.id,
            name: data.data.name,
            phone: data.data.phone,
            email: data.data.email,
            role: data.data.role,
          });
          setAddresses(data.data.addresses || []);
        }
      }
    } catch (err) {
      console.error("Refresh profile error:", err);
    }
  }, [token]);

  // Initialize from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lh_token");
    if (saved) {
      setToken(saved);
    }
    setLoading(false);
  }, []);

  // Fetch profile when token changes
  useEffect(() => {
    if (token) {
      refreshProfile();
    }
  }, [token, refreshProfile]);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem("lh_token", data.data.token);
        return { ok: true };
      }
      return { ok: false, error: data.error || "Login gagal." };
    } catch {
      return { ok: false, error: "Koneksi ke server gagal." };
    }
  };

  const register = async (name: string, phone: string, email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email: email || undefined, password }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem("lh_token", data.data.token);
        return { ok: true };
      }
      return { ok: false, error: data.error || "Registrasi gagal." };
    } catch {
      return { ok: false, error: "Koneksi ke server gagal." };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAddresses([]);
    localStorage.removeItem("lh_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, addresses, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Re-export a typed fetch helper for use in other components
export function useApiFetch() {
  const { token } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(url, { ...options, headers });
      return res;
    },
    [token]
  );
}
