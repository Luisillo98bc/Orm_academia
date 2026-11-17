"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
}

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: "class" | `data-${string}`;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  enableColorScheme?: boolean;
  storageKey?: string;
  disableTransitionOnChange?: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(
  theme: Theme,
  attribute: ThemeProviderProps["attribute"],
  enableSystem: boolean,
  enableColorScheme: boolean,
) {
  const root = document.documentElement;
  const resolvedTheme = theme === "system" && enableSystem ? getSystemTheme() : theme === "dark" ? "dark" : "light";

  if (attribute === "class") {
    root.classList.toggle("dark", resolvedTheme === "dark");
  } else {
    root.setAttribute(attribute || "class", resolvedTheme);
  }

  if (enableColorScheme) root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  enableColorScheme = true,
  storageKey = "theme",
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const storedTheme = window.localStorage.getItem(storageKey);
    return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : defaultTheme;
  });
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : getSystemTheme(),
  );

  const resolvedTheme: ResolvedTheme = theme === "system" && enableSystem ? systemTheme : theme === "dark" ? "dark" : "light";

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      window.localStorage.setItem(storageKey, nextTheme);
    },
    [storageKey],
  );

  React.useEffect(() => {
    if (!enableSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [enableSystem, storageKey]);

  React.useEffect(() => {
    const transitionStyle = disableTransitionOnChange ? document.createElement("style") : null;
    if (transitionStyle) {
      transitionStyle.textContent = "*, *::before, *::after { transition: none !important; }";
      document.head.appendChild(transitionStyle);
    }
    applyTheme(theme, attribute, enableSystem, enableColorScheme);
    if (transitionStyle) {
      void window.getComputedStyle(document.body).color;
      const frame = window.requestAnimationFrame(() => transitionStyle.remove());
      return () => { window.cancelAnimationFrame(frame); transitionStyle.remove(); };
    }
  }, [attribute, disableTransitionOnChange, enableColorScheme, enableSystem, theme, systemTheme]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const nextTheme = event.newValue;
      if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "system") setThemeState(nextTheme);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, systemTheme, setTheme, themes: ["light", "dark", "system"] as Theme[] }),
    [resolvedTheme, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe utilizarse dentro de ThemeProvider");
  return context;
}
