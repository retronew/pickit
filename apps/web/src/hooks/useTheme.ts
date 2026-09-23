import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "dark" | "light";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pickit-theme", theme);
  }, [theme]);

  function toggle(origin?: { x: number; y: number }) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!("startViewTransition" in document) || reduceMotion) {
      setTheme(next);
      return;
    }

    if (origin) {
      document.documentElement.style.setProperty("--theme-x", `${origin.x}px`);
      document.documentElement.style.setProperty("--theme-y", `${origin.y}px`);
    }

    document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
  }

  return { theme, toggle };
}
