import { useEffect } from 'react';

export function useAsyncError() {
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error('Async error captured:', event.error);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
}
