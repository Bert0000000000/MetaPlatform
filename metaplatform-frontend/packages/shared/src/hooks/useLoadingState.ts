import { useState, useCallback } from 'react';

interface UseLoadingStateResult {
  loading: boolean;
  error: Error | null;
  start: () => void;
  stop: () => void;
  setError: (error: Error | null) => void;
  wrap: <T>(promise: Promise<T>) => Promise<T>;
}

export function useLoadingState(): UseLoadingStateResult {
  const [loading, setLoading] = useState(false);
  const [error, setErrorState] = useState<Error | null>(null);

  const start = useCallback(() => {
    setLoading(true);
    setErrorState(null);
  }, []);

  const stop = useCallback(() => setLoading(false), []);

  const setError = useCallback((e: Error | null) => setErrorState(e), []);

  const wrap = useCallback(
    async <T,>(promise: Promise<T>): Promise<T> => {
      start();
      try {
        const result = await promise;
        return result;
      } catch (e) {
        setErrorState(e instanceof Error ? e : new Error(String(e)));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [start],
  );

  return { loading, error, start, stop, setError, wrap };
}

export default useLoadingState;
