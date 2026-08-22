import { useEffect, useState } from "react";

/**
 * Keeps a conditionally-rendered element mounted for `durationMs` after
 * `open` flips to false, so it can play an exit animation instead of
 * disappearing instantly.
 */
export function useUnmountDelay(open: boolean, durationMs: number): boolean {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const timer = setTimeout(() => setRendered(false), durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs]);

  return rendered;
}
