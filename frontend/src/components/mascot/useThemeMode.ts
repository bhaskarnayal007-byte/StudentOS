import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

function read(): ThemeMode {
  if (typeof document === "undefined") return "dark";
  // Every theme in theme.css declares its color-scheme, so this covers the
  // aesthetic themes as well as Auto/Light/Dark.
  return getComputedStyle(document.documentElement).colorScheme.trim() === "dark" ? "dark" : "light";
}

/**
 * Re-reads a computed style of <html> whenever the `data-theme` attribute the
 * store writes there changes.
 *
 * Observing the attribute rather than reading the store matters: React runs
 * child effects before parent effects, so a child reacting to a store change
 * sees the DOM from *before* StoreProvider wrote the new theme, and ends up
 * one switch behind. The observer fires after the attribute actually changes.
 */
function useRootStyle<T>(readValue: () => T): T {
  const [value, setValue] = useState<T>(readValue);

  useEffect(() => {
    const update = () => setValue(readValue());
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

  return value;
}

export const useThemeMode = (): ThemeMode => useRootStyle(read);

/** Octi's body colour: the active theme's --octi token in theme.css. */
export const useOctiColour = (): string =>
  useRootStyle(() =>
    typeof document === "undefined"
      ? "#f8faff"
      : getComputedStyle(document.documentElement).getPropertyValue("--octi").trim() || "#f8faff",
  );
