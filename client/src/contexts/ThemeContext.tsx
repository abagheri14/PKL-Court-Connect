import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type FontSize = "small" | "default" | "large";
type AccentColor = "gold" | "rose" | "teal" | "orange" | "blue";

const accentPresets: Record<AccentColor, { secondary: string; label: string; swatch: string }> = {
  gold:   { secondary: "oklch(0.85 0.20 95)",  label: "Gold",   swatch: "#FFD700" },
  rose:   { secondary: "oklch(0.70 0.18 10)",   label: "Rose",   swatch: "#F43F5E" },
  teal:   { secondary: "oklch(0.75 0.15 180)",  label: "Teal",   swatch: "#14B8A6" },
  orange: { secondary: "oklch(0.78 0.18 55)",   label: "Orange", swatch: "#F97316" },
  blue:   { secondary: "oklch(0.72 0.15 240)",  label: "Blue",   swatch: "#3B82F6" },
};

const fontSizeScale: Record<FontSize, string> = {
  small: "93.75%",   // 15px base
  default: "100%",   // 16px base
  large: "112.5%",   // 18px base
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  accentPresets: typeof accentPresets;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return stored === "light" || stored === "dark" ? stored : defaultTheme;
    }
    return defaultTheme;
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try { const v = localStorage.getItem("pkl_fontSize"); return v === "small" || v === "default" || v === "large" ? v : "default"; } catch { return "default"; }
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    try { const v = localStorage.getItem("pkl_accentColor"); return v && v in accentPresets ? v as AccentColor : "gold"; } catch { return "gold"; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  // Apply font size to root
  useEffect(() => {
    document.documentElement.style.fontSize = fontSizeScale[fontSize];
    try { localStorage.setItem("pkl_fontSize", fontSize); } catch { /* noop */ }
  }, [fontSize]);

  // Apply accent color
  useEffect(() => {
    const preset = accentPresets[accentColor];
    document.documentElement.style.setProperty("--color-secondary", preset.secondary);
    try { localStorage.setItem("pkl_accentColor", accentColor); } catch { /* noop */ }
  }, [accentColor]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  const setFontSize = (size: FontSize) => setFontSizeState(size);
  const setAccentColor = (color: AccentColor) => setAccentColorState(color);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable, fontSize, setFontSize, accentColor, setAccentColor, accentPresets }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
