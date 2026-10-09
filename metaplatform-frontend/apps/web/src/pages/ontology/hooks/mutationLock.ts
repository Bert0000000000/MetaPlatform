import { useCallback, useRef, useState } from 'react';

export interface MutationLock {
  pending: boolean;
  locked: () => boolean;
  acquire: () => (() => void) | undefined;
}

/** Synchronous command ownership; only the acquiring promise may release it. */
export function useMutationLock(): MutationLock {
  const owner = useRef<symbol | null>(null);
  const [pending, setPending] = useState(false);
  const locked = useCallback(() => owner.current !== null, []);
  const acquire = useCallback(() => {
    if (owner.current) return;
    const token = Symbol();
    owner.current = token;
    setPending(true);
    return () => {
      if (owner.current !== token) return;
      owner.current = null;
      setPending(false);
    };
  }, []);
  return { pending, locked, acquire };
}
