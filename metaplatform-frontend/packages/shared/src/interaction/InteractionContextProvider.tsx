import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';

/**
 * InteractionContext（P4.1.1）。
 *
 * <p>前端任何页面在调用 SuperAI 时，必须携带：</p>
 * <ul>
 *   <li>appCode / pageCode / pageUrl — 页面身份</li>
 *   <li>subject — 当前业务对象（conceptCode + objectId）</li>
 *   <li>viewState — 当前页签 / 筛选 / 选中行</li>
 * </ul>
 *
 * <p>DeerFlow / Agent 拿到 InteractionContext 才能自动理解用户所处业务上下文。</p>
 */

export interface InteractionSubject {
  conceptCode: string;
  objectId: string;
}

export interface InteractionContextValue {
  appCode: string;
  pageCode: string;
  pageUrl?: string;
  subject?: InteractionSubject;
  viewState?: Record<string, unknown>;
  setSubject: (s?: InteractionSubject) => void;
  setViewState: (s: Record<string, unknown>) => void;
}

const Ctx = createContext<InteractionContextValue | null>(null);

export interface InteractionProviderProps {
  appCode: string;
  pageCode: string;
  pageUrl?: string;
  initialSubject?: InteractionSubject;
  children: ReactNode;
}

export function InteractionProvider(props: InteractionProviderProps) {
  const [subject, setSubject] = useState<InteractionSubject | undefined>(props.initialSubject);
  const [viewState, setViewState] = useState<Record<string, unknown>>({});

  const value = useMemo<InteractionContextValue>(() => ({
    appCode: props.appCode,
    pageCode: props.pageCode,
    pageUrl: props.pageUrl,
    subject,
    viewState,
    setSubject,
    setViewState,
  }), [props.appCode, props.pageCode, props.pageUrl, subject, viewState]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useInteractionContext(): InteractionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useInteractionContext must be used within InteractionProvider');
  return v;
}

/**
 * 把 InteractionContext 转成发给后端的 InteractionContext JSON。
 */
export function toInteractionContextJson(v: InteractionContextValue, message: string) {
  return {
    message,
    interaction: {
      appCode: v.appCode,
      pageCode: v.pageCode,
      pageUrl: v.pageUrl,
    },
    subject: v.subject,
    viewState: v.viewState,
  };
}
