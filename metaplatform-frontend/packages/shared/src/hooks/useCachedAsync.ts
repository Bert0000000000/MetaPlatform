/**
 * Lightweight in-process data cache hook for the unified @mate/web SPA.
 *
 * Use this when a page is read-heavy and re-uses the same API call across
 * other pages. It is intentionally minimal compared to TanStack Query:
 * one shared in-memory `Map`, TTL-based invalidation, and a manual
 * `invalidate(key)` escape hatch. Cross-tab invalidation is not handled.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

type Listener = () => void;

interface CacheEntry<T> {
  value: T;
  promise?: Promise<T>;
  updatedAt: number;
  error?: unknown;
}

const store = new Map<string, CacheEntry<unknown>>();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getEntry<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

function setEntry<T>(key: string, entry: CacheEntry<T>) {
  store.set(key, entry as CacheEntry<unknown>);
  emit();
}

export interface UseCachedAsyncOptions<T> {
  /** Stale time in ms. Default 30s. */
  ttlMs?: number;
  /** Force refresh on mount even if cache is fresh. */
  refetchOnMount?: boolean;
  /** External invalidate trigger. */
  onChange?: unknown;
  /** Disable network. */
  enabled?: boolean;
}

export interface UseCachedAsyncResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  /** Drop the cached value for this key. */
  invalidate: () => void;
}

export function useCachedAsync<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedAsyncOptions<T> = {},
): UseCachedAsyncResult<T> {
  const { ttlMs = 30_000, refetchOnMount = false, onChange, enabled = true } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [tick, setTick] = useState(0);

  const subscribe$ = useCallback(
    (listener: Listener) => subscribe(listener),
    [],
  );
  useSyncExternalStore(subscribe$, () => tick, () => tick);

  // Resolve current value for key.
  const entry = getEntry<T>(key);
  const isFresh = entry && Date.now() - entry.updatedAt < ttlMs;
  const [loading, setLoading] = useState(!entry);

  const run = useCallback(
    (force = false) => {
      if (!enabled) return;
      const current = getEntry<T>(key);
      if (force || !current || Date.now() - current.updatedAt >= ttlMs) {
        const promise = fetcherRef.current();
        setEntry<T>(key, {
          value: (current?.value as T) ?? (undefined as unknown as T),
          promise,
          updatedAt: Date.now(),
          error: undefined,
        });
        setLoading(true);
        promise.then(
          (value) => {
            setEntry<T>(key, { value, updatedAt: Date.now() });
            setLoading(false);
            setTick((t) => t + 1);
          },
          (error) => {
            setEntry<T>(key, {
              value: (current?.value as T) ?? (undefined as unknown as T),
              updatedAt: Date.now(),
              error,
            });
            setLoading(false);
            setTick((t) => t + 1);
          },
        );
      }
    },
    [key, ttlMs, enabled],
  );

  useEffect(() => {
    run(refetchOnMount);
  }, [run, refetchOnMount, onChange]);

  const reload = useCallback(() => run(true), [run]);
  const invalidate = useCallback(() => {
    store.delete(key);
    emit();
  }, [key]);

  return {
    data: entry?.value,
    error: entry?.error,
    loading,
    reload,
    invalidate,
  };
}

/** Test-only helper to clear the entire cache. Not for production use. */
export function __resetCacheForTests() {
  store.clear();
  emit();
}
