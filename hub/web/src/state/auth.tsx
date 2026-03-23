import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../lib/api";
import type { SessionInfo } from "../types/auth";

type AuthContextValue = {
  session: SessionInfo;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultSession: SessionInfo = {
  authenticated: false,
  user: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo>(defaultSession);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const response = await apiRequest<SessionInfo>("/api/auth/me");
      setSession(response);
    } catch {
      setSession(defaultSession);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => null);
    setSession(defaultSession);
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, refreshSession, logout }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
