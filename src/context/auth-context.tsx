"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthExpired } from "@/lib/api-client";
import type { UserRole, UserSession } from "@/types";

interface AuthContextType {
  user: UserSession | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isError: boolean;
  errorMessage: string | null;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserSession | null>;
  setUser: React.Dispatch<React.SetStateAction<UserSession | null>>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// In-flight promise deduplication to prevent concurrent duplicate session checks
let inFlightSessionPromise: Promise<UserSession | null> | null = null;

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
  const [isError, setIsError] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const userRef = React.useRef<UserSession | null>(initialUser);
  userRef.current = user;

  const fetchSession = React.useCallback(async (force = false): Promise<UserSession | null> => {
    if (inFlightSessionPromise && !force) {
      return inFlightSessionPromise;
    }

    inFlightSessionPromise = (async () => {
      try {
        setIsError(false);
        setErrorMessage(null);

        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" },
        });

        if (res.status === 401) {
          // Explicitly unauthenticated or expired
          setUser(null);
          return null;
        }

        if (!res.ok) {
          // Non-401 server error (500, 502, etc.)
          setIsError(true);
          setErrorMessage(`Server returned status ${res.status}`);
          return userRef.current; // Preserve existing session during temporary server errors
        }

        const data = await res.json();
        if (data?.success && data.user) {
          const verifiedUser: UserSession = data.user;
          setUser(verifiedUser);
          return verifiedUser;
        }

        setUser(null);
        return null;
      } catch (err: unknown) {
        // Network connectivity error (offline, flaky connection)
        setIsError(true);
        setErrorMessage(err instanceof Error ? err.message : "Network error");
        return userRef.current;
      } finally {
        setIsLoading(false);
        inFlightSessionPromise = null;
      }
    })();

    return inFlightSessionPromise;
  }, []);

  // Initial load
  React.useEffect(() => {
    if (!initialUser) {
      fetchSession();
    } else {
      setIsLoading(false);
    }
  }, [initialUser, fetchSession]);

  // Re-verify session on route change if user state is not yet hydrated
  React.useEffect(() => {
    if (!user && pathname && pathname !== "/login" && !pathname.startsWith("/api/")) {
      fetchSession();
    }
  }, [pathname, user, fetchSession]);

  // Subscribe to 401 session expiration from apiFetch
  React.useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      setUser(null);
      if (pathname && pathname !== "/login") {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    });
    return unsubscribe;
  }, [pathname, router]);

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
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
      role: user?.role || null,
      isLoading,
      isAuthenticated: !!user,
      isError,
      errorMessage,
      logout,
      refreshSession: () => fetchSession(true),
      setUser,
    }),
    [user, isLoading, isError, errorMessage, logout, fetchSession]
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
