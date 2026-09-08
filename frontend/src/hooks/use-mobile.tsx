import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const COMPACT_NAV_BREAKPOINT = 1024;

function useMediaMaxWidth(maxWidth: number) {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => {
      setMatches(window.innerWidth <= maxWidth);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [maxWidth]);

  return !!matches;
}

export function useIsMobile() {
  return useMediaMaxWidth(MOBILE_BREAKPOINT - 1);
}

/** Mobile + tablet: menu drawer instead of persistent sidebar rail. */
export function useIsCompactNav() {
  return useMediaMaxWidth(COMPACT_NAV_BREAKPOINT - 1);
}
