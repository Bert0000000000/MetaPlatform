import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';

/**
 * InteractionContext — 对齐 ERR-1 + OpenAPI §BuildEnvelopeRequest。
 *
 * <p>前端任何页面在调用 SuperAI 时必须携带：</p>
 * <ul>
 *   <li>appCode / pageCode / pageUrl — 页面身份</li>
 *   <li>selectedText — 框选片段（ERR-1 §服务端二次校验第 3 条：≤8192 字符）</li>
 *   <li>subject — 当前业务对象（conceptCode + objectId）</li>
 *   <li>viewState — 当前页签 / 筛选 / 选中行</li>
 *   <li>clientHints.supportsStreaming / supportsArtifacts — 路由辅助</li>
 *   <li>clientHints.uiLocale — i18n 提示</li>
 * </ul>
 */

export interface InteractionSubject {
  conceptCode: string;
  objectId: string;
}

export interface InteractionViewState {
  activeTab?: string;
  filters?: Record<string, unknown>;
  selectedMetrics?: string[];
}

export interface ClientHints {
  supportsStreaming: boolean;
  supportsArtifacts: boolean;
  uiLocale?: string;
}

export interface InteractionContextValue {
  appCode: string;
  pageCode: string;
  pageUrl?: string;
  selectedText?: string | null;
  tenantId?: string;
  subject?: InteractionSubject;
  viewState?: InteractionViewState;
  clientHints?: ClientHints;
  setSelectedText: (t?: string | null) => void;
  setSubject: (s?: InteractionSubject) => void;
  setViewState: (s: InteractionViewState) => void;
  setClientHints: (h: ClientHints) => void;
}

const Ctx = createContext<InteractionContextValue | null>(null);

export interface InteractionProviderProps {
  appCode: string;
  pageCode: string;
  pageUrl?: string;
  initialSelectedText?: string | null;
  initialTenantId?: string;
  initialSubject?: InteractionSubject;
  initialClientHints?: ClientHints;
  children: ReactNode;
}

export function InteractionProvider(props: InteractionProviderProps) {
  const [selectedText, setSelectedText] = useState<string | null | undefined>(props.initialSelectedText);
  const [subject, setSubject] = useState<InteractionSubject | undefined>(props.initialSubject);
  const [viewState, setViewState] = useState<InteractionViewState>({});
  const [clientHints, setClientHints] = useState<ClientHints | undefined>(props.initialClientHints);

  const value = useMemo<InteractionContextValue>(() => ({
    appCode: props.appCode,
    pageCode: props.pageCode,
    pageUrl: props.pageUrl,
    selectedText,
    tenantId: props.initialTenantId,
    subject,
    viewState,
    clientHints,
    setSelectedText,
    setSubject,
    setViewState,
    setClientHints,
  }), [props.appCode, props.pageCode, props.pageUrl, props.initialTenantId, selectedText, subject, viewState, clientHints]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useInteractionContext(): InteractionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useInteractionContext must be used within InteractionProvider');
  return v;
}

/**
 * 把 InteractionContext 转成发给后端的 InteractionContext JSON。
 *
 * <p>与 OpenAPI §BuildEnvelopeRequest 一一对应：
 * ERR-1 严格 schema + ERR-1 §服务端二次校验。</p>
 */
export function toInteractionContextJson(v: InteractionContextValue, message: string) {
  return {
    message,
    interaction: {
      appCode: v.appCode,
      pageCode: v.pageCode,
      pageUrl: v.pageUrl,
      selectedText: v.selectedText ?? null,
      tenantId: v.tenantId,
    },
    subject: v.subject ?? null,
    viewState: v.viewState,
    clientHints: v.clientHints,
  };
}