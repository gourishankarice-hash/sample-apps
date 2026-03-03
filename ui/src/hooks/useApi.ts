import { useState, useEffect, useCallback } from "react";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Fetches data from a URL and optionally polls it on an interval.
 * @param fetcher  async function that returns the data
 * @param interval polling interval in ms (omit to fetch once)
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  interval?: number,
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    fetcher()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => {
    run();
    if (!interval) return;
    const id = setInterval(run, interval);
    return () => clearInterval(id);
  }, [run, interval]);

  return { data, error, loading, refetch: run };
}
