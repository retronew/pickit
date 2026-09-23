import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "dark" | "light";
export type ThemeMode = Theme | "system";

// A new key: the old "pickit-theme" was written on every visit, so it can't
// tell an explicit choice apart from the old dark default.
const STORAGE_KEY = "pickit-theme-mode";
const MODES: ThemeMode[] = ["system", "light", "dark"];
const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage blocked: fall back to the system theme.
  }
  return "system";
}

function systemTheme(): Theme {
  return systemQuery().matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): Theme {
  return mode === "system" ? systemTheme() : mode;
}

/**
 * Flips the `dark` class with every CSS transition paused. Otherwise elements
 * with `transition-colors` (e.g. every item card) animate from the old colors
 * while the view transition reveals the new theme, which looks like a flicker.
 */
function applyTheme(theme: Theme, origin?: { x: number; y: number }, update?: () => void) {
  const root = document.documentElement;
  if (root.classList.contains("dark") === (theme === "dark")) {
    update?.();
    return;
  }
  const flip = () => {
    root.classList.toggle("dark", theme === "dark");
    update?.();
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("theme-switching");
  const done = () => root.classList.remove("theme-switching");

  if (!origin || !("startViewTransition" in document) || reduceMotion) {
    flip();
    // Two frames so the new colors are painted before transitions come back.
    requestAnimationFrame(() => requestAnimationFrame(done));
    return;
  }
  root.style.setProperty("--theme-x", `${origin.x}px`);
  root.style.setProperty("--theme-y", `${origin.y}px`);
  document.startViewTransition(() => flushSync(flip)).finished.finally(done);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readMode);
  const [theme, setTheme] = useState<Theme>(() => resolve(mode));

  // Follow OS changes while in system mode.
  useEffect(() => {
    if (mode !== "system") return;
    const query = systemQuery();
    const onChange = () => {
      const next = systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  /** Cycles system → light → dark. */
  function cycle(origin?: { x: number; y: number }) {
    const nextMode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    const nextTheme = resolve(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Not persisted; the choice still applies to this page.
    }
    applyTheme(nextTheme, origin, () => {
      setMode(nextMode);
      setTheme(nextTheme);
    });
  }

  const nextMode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  return { mode, theme, nextMode, cycle };
}
