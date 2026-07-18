import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  setData: (data: T | null) => void;
}

/**
 * Hook for async data fetching with loading/error states.
 * Automatically cancels stale updates when the component unmounts or deps change.
 *
 * @param fetcher  Async function returning the data.
 * @param deps     Dependency array; refetch when these change (like useEffect deps).
 *                 Pass `[]` to fetch once on mount, or omit to fetch on every render (usually not wanted).
 *
 * @example
 * const { data, loading, error, reload } = useAsync(() => getNotifications(filter), [filter]);
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  // Keep the latest fetcher in a ref so reload() always uses the latest closure.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (!cancelledRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}
