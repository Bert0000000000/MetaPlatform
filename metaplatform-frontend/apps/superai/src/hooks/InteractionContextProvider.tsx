import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { InteractionContext } from './useAgentStream';

/**
 * InteractionContextProvider - P4 React provider for the
 * ontology-native InteractionContext (frontend -> backend envelope source).
 *
 * <p>Holds the current page-level subject (conceptCode + objectId), viewState
 * (filters, active tab, etc.) and message buffer. Pages mount with
 * <code>InteractionContextProvider</code> and descendants call
 * <code>useInteractionContext()</code> to read/merge context.</p>
 */

export interface InteractionContextValue {
  /** Current context (memoized) */
  context: InteractionContext;
  /** Update subject (conceptCode / objectId) */
  setSubject: (subject: { conceptCode: string; objectId: string } | undefined) => void;
  /** Update viewState (deep-merge) */
  setViewState: (next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;
  /** Update the message buffer */
  setMessage: (message: string) => void;
  /** Update appCode / pageCode / pageUrl */
  setInteraction: (interaction: { appCode: string; pageCode: string; pageUrl: string }) => void;
  /** Reset the entire context to defaults */
  reset: () => void;
}

const InteractionContextReactContext = createContext<InteractionContextValue | null>(null);

export interface InteractionContextProviderProps {
  appCode: string;
  pageCode: string;
  pageUrl: string;
  initialSubject?: { conceptCode: string; objectId: string };
  initialViewState?: Record<string, unknown>;
  children: React.ReactNode;
}

export function InteractionContextProvider(props: InteractionContextProviderProps) {
  const { appCode, pageCode, pageUrl, initialSubject, initialViewState, children } = props;

  const [subject, setSubjectState] = useState(initialSubject);
  const [viewState, setViewStateState] = useState<Record<string, unknown>>(initialViewState || {});
  const [message, setMessage] = useState('');
  const [interaction, setInteraction] = useState({ appCode, pageCode, pageUrl });

  const setSubject = useCallback((s: { conceptCode: string; objectId: string } | undefined) => {
    setSubjectState(s);
  }, []);

  const setViewState = useCallback(
    (next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
      setViewStateState((prev) => (typeof next === 'function' ? next(prev) : { ...prev, ...next }));
    },
    [],
  );

  const reset = useCallback(() => {
    setSubjectState(initialSubject);
    setViewStateState(initialViewState || {});
    setMessage('');
    setInteraction({ appCode, pageCode, pageUrl });
  }, [appCode, pageCode, pageUrl, initialSubject, initialViewState]);

  const context: InteractionContext = useMemo(
    () => ({
      message,
      interaction,
      subject,
      viewState,
      contractVersion: '1.0',
    }),
    [message, interaction, subject, viewState],
  );

  const value: InteractionContextValue = useMemo(
    () => ({
      context,
      setSubject,
      setViewState,
      setMessage,
      setInteraction,
      reset,
    }),
    [context, setSubject, setViewState, setMessage, reset],
  );

  return (
    <InteractionContextReactContext.Provider value={value}>
      {children}
    </InteractionContextReactContext.Provider>
  );
}

/** Hook to read/merge InteractionContext in any descendant component. */
export function useInteractionContext(): InteractionContextValue {
  const value = useContext(InteractionContextReactContext);
  if (!value) {
    throw new Error('useInteractionContext must be used inside <InteractionContextProvider>');
  }
  return value;
}
