import { useEffect } from 'react';
import { notification } from 'antd';

/**
 * Subscribes to window-level `unhandledrejection` and `error` events.
 * Surfaces them as a non-blocking notification so they are never silently
 * swallowed, while still letting the browser's default logging happen.
 *
 * Place once near the app root (inside ConfigProvider / AntApp) so any
 * Promise.reject without a `.catch` becomes visible to the user.
 *
 * @example
 * function App() {
 *   useAsyncError();
 *   return <Routes>...</Routes>;
 * }
 */
export function useAsyncError(): void {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : '未处理的 Promise 异常';
      // eslint-disable-next-line no-console
      console.error('[useAsyncError] unhandled rejection:', reason);
      notification.error({
        message: '请求异常',
        description: message,
        placement: 'topRight',
        duration: 6,
      });
    };

    const handleError = (event: ErrorEvent) => {
      // Skip resource-loading errors (handled by element-specific handlers).
      if (!event.message && event.target) return;
      // eslint-disable-next-line no-console
      console.error('[useAsyncError] uncaught error:', event.error ?? event.message);
      notification.error({
        message: '脚本异常',
        description: event.message || '未知错误',
        placement: 'topRight',
        duration: 6,
      });
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
}
