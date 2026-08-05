"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchApi, logoutSession } from "@/lib/api";

interface User {
  id: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);
    window.addEventListener("auth:expired", handleExpiredSession);

    const timeoutId = window.setTimeout(() => {
      fetchApi("/users/me")
        .then((userData) => setUser(userData))
        .catch(() => setUser(null))
        .finally(() => setIsLoading(false));
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
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
