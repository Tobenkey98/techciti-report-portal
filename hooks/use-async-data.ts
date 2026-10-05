"use client";

import * as React from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Re-runs the fetcher. */
  refresh: () => Promise<void>;
  /** Replaces the cached value locally (after a mutation, before a refetch). */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Minimal data-fetching hook for client components.
 *
 * `deps` behaves like a `useEffect` dependency list: change the month and the
 * data reloads. Kept deliberately small — with a typed API layer in place
 * there is no need for a query library.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: { enabled?: boolean } = {},
): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<Error | null>(null);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = React.useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) setData(result);
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught : new Error("Something went wrong"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { data, loading, error, refresh: run, setData };
}