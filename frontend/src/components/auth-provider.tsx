"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ensureTabSessionIsolated, fetchApi, logoutSession } from "@/lib/api";

interface User {
  id: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  dni?: string;
  phone?: string;
  address?: string;
  district?: string;
  province?: string;
  department?: string;
  profileComplete?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async (): Promise<User | null> => {
    try {
      const userData = await fetchApi("/users/me");
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);
    window.addEventListener("auth:expired", handleExpiredSession);

    const timeoutId = window.setTimeout(async () => {
      try {
        const sessionStatus = await fetchApi("/auth/session").catch(() => null);
        if (sessionStatus?.authenticated === false) {
          setUser(null);
          return;
        }
        const userData = await fetchApi("/users/me");
        setUser(userData);
        await ensureTabSessionIsolated();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("auth:expired", handleExpiredSession);
    };
  }, []);

  const login = (newUser: User) => setUser(newUser);

  const logout = async () => {
    await logoutSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
