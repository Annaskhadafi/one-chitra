"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: string | string[];
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  enableSystem?: boolean;
  forcedTheme?: Theme;
  storageKey?: string;
  themes?: string[];
  value?: Record<string, string>;
}

interface ThemeContextValue {
  forcedTheme?: Theme;
  resolvedTheme?: "light" | "dark";
  setTheme: (theme: Theme | ((currentTheme: Theme) => Theme)) => void;
  systemTheme?: "light" | "dark";
  theme: Theme;
  themes: string[];
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const FALLBACK_CONTEXT: ThemeContextValue = {
  setTheme: () => undefined,
  theme: "light",
  themes: ["light", "dark"],
};

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
}

function applyThemeToDocument({
  attribute,
  enableColorScheme,
  resolvedTheme,
  value,
}: {
  attribute: string | string[];
  enableColorScheme: boolean;
  resolvedTheme: "light" | "dark";
  value?: Record<string, string>;
}) {
  const root = document.documentElement;
  const attributes = Array.isArray(attribute) ? attribute : [attribute];
  const mappedValue = value?.[resolvedTheme] ?? resolvedTheme;
  const knownValues = new Set(["light", "dark"]);

  if (value) {
    Object.values(value).forEach((themeValue) => {
      knownValues.add(themeValue);
    });
  }

  attributes.forEach((attr) => {
    if (attr === "class") {
      root.classList.remove(...knownValues);
      root.classList.add(mappedValue);
      return;
    }

    if (mappedValue) {
      root.setAttribute(attr, mappedValue);
    } else {
      root.removeAttribute(attr);
    }
  });

  if (enableColorScheme) {
    root.style.colorScheme = resolvedTheme;
  }
}

export function ThemeProvider({
  attribute = "class",
  children,
  defaultTheme = "system",
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  storageKey = "theme",
  themes = ["light", "dark"],
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  React.useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;

      if (storedTheme) {
        setThemeState(storedTheme);
        return;
      }
    } catch {
      // Ignore storage failures and keep the default theme.
    }

    setThemeState(defaultTheme);
  }, [defaultTheme, storageKey]);

  const resolvedTheme =
    forcedTheme && forcedTheme !== "system"
      ? forcedTheme
      : theme === "system"
        ? enableSystem
          ? systemTheme
          : "light"
        : theme;

  React.useEffect(() => {
    const restoreTransitions = disableTransitionOnChange
      ? disableTransitionsTemporarily()
      : undefined;

    applyThemeToDocument({
      attribute,
      enableColorScheme,
      resolvedTheme,
      value,
    });

    restoreTransitions?.();
  }, [
    attribute,
    disableTransitionOnChange,
    enableColorScheme,
    resolvedTheme,
    value,
  ]);

  const setTheme = React.useCallback(
    (nextTheme: Theme | ((currentTheme: Theme) => Theme)) => {
      setThemeState((currentTheme) => {
        const computedTheme =
          typeof nextTheme === "function" ? nextTheme(currentTheme) : nextTheme;

        try {
          window.localStorage.setItem(storageKey, computedTheme);
        } catch {
          // Ignore storage failures and still update in memory.
        }

        return computedTheme;
      });
    },
    [storageKey]
  );

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      theme: forcedTheme ?? theme,
      themes: enableSystem ? [...themes, "system"] : themes,
    }),
    [enableSystem, forcedTheme, resolvedTheme, setTheme, systemTheme, theme, themes]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext) ?? FALLBACK_CONTEXT;
}
