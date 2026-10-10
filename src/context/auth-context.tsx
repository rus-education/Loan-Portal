"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthExpired } from "@/lib/api-client";
import type { UserRole, UserSession } from "@/types";

interface AuthContextType {
  user: UserSession | null;
  role: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserSession | null>;
  setUser: React.Dispatch<React.SetStateAction<UserSession | null>>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: UserSession | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<UserSession | null>(initialUser);
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialUser);

  const fetchSession = React.useCallback(async (): Promise<UserSession | null> => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      if (data?.success && data.user) {
        setUser(data.user);
        return data.user as UserSession;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    if (!initialUser) {
      fetchSession();
    } else {
      setIsLoading(false);
    }
  }, [initialUser, fetchSession]);

  // Subscribe to 401 session expiration from apiFetch
  React.useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      setUser(null);
    });
    return unsubscribe;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Ignored
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      role: user?.role || "SUPERADMIN",
      isLoading,
      isAuthenticated: !!user,
      logout,
      refreshSession: fetchSession,
      setUser,
    }),
    [user, isLoading, logout, fetchSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
