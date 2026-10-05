"use client";

import * as React from "react";

/** SSR-safe media query hook (always starts `false` on the server). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", listener);
    return () => list.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — used to switch drawer layouts. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}