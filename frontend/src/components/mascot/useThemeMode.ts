import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

function read(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  const declared = document.documentElement.dataset.theme;
  if (declared === "light" || declared === "dark") return declared;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Watches the `data-theme` attribute the store writes to <html>.
 *
 * Observing the attribute rather than reading the store matters: React runs
 * child effects before parent effects, so a child reacting to a store change
 * sees the DOM from *before* StoreProvider wrote the new theme, and ends up
 * one switch behind. The observer fires after the attribute actually changes.
 */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(read);

  useEffect(() => {
    const update = () => setMode(read());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    media.addEventListener("change", update);
    update();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return mode;
}
