"use client";
import { useEffect } from "react";
import { usePrefs } from "./store";

/** Applies theme (light/dark/system) and document language. */
export function ThemeSync() {
  const theme = usePrefs((s) => s.theme);
  const language = usePrefs((s) => s.language);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0e0f11" : "#f6f5f1");
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}

/** Inline script that sets the theme class before first paint (no flash). */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('finax.prefs')||'{}').state||{};var t=s.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');if(s.language)document.documentElement.lang=s.language;}catch(e){}})();`;
