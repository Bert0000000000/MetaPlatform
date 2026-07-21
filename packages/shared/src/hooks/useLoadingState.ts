import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';

interface UseLoadingStateResult<TArgs extends unknown[] = unknown[], TResult = unknown> {
  loading: boolean;
  error: Error | null;
  /** Run the wrapped async function. Returns the result or `undefined` on failure. */
  run: (...args: TArgs) => Promise<TResult | undefined>;
  /** Manually reset loading/error state. */
  reset: () => void;
}

/**
 * Wraps an async action (form submit, button click, mutation) with consistent
 * loading/error handling:
 *  - Tracks `loading` so callers can bind it to `Button.loading` / Modal `confirmLoading`.
 *  - On failure, surfaces a `message.error` toast AND stores the Error so the
 *    caller can render inline UI if desired.
 *  - Suppresses the toast when the error is already handled at a deeper layer
 *    (set `silent: true` in options).
 *
 * @example
 * const submit = useLoadingState(async (values) => {
 *   await createEmployee(values);
 *   message.success('创建成功');
 * });
 * <Button loading={submit.loading} onClick={() => submit.run(formValues)} />
 */
export function useLoadingState<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    /** Custom error message override; receives the caught error. */
    errorMessage?: (err: Error) => string;
    /** Skip the automatic `message.error` toast (caller handles UI). */
    silent?: boolean;
    /** Success message to show after the action completes. */
    successMessage?: string | ((result: TResult) => string);
  } = {},
): UseLoadingStateResult<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Keep the latest fn so callers can pass inline closures without re-creating run().
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optsRef = useRef(options);
  optsRef.current = options;

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fnRef.current(...args);
        const success = optsRef.current.successMessage;
        if (success) {
          message.success(typeof success === 'function' ? success(result) : success);
        }
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        if (!optsRef.current.silent) {
          const custom = optsRef.current.errorMessage?.(errorObj);
          message.error(custom ?? errorObj.message ?? '操作失败');
        }
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, run, reset };
}
