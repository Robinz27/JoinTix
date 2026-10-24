export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: Theme = "light";

/**
 * Runs in <head> before the page paints (app/layout.tsx), so a light-theme visitor never sees a dark
 * flash. Read on the client instead of the server so pages stay static under Cache Components.
 */
export const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:"${DEFAULT_THEME}";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Switch theme with a cross-fade so the change isn't jarring. */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.toggle("dark", theme === "dark");
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    apply();
    return;
  }

  if (document.startViewTransition) {
    // The theme still applies if the fade is skipped, so the aborted animation's rejection is safe to ignore
    document.startViewTransition(apply).ready.catch(() => {});
    return;
  }

  root.classList.add("theme-fade");
  apply();
  window.setTimeout(() => root.classList.remove("theme-fade"), 500);
}

export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
