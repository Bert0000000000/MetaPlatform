/**
 * V12-08 Phase 0: 從 APP-DASHBOARD 升到 @mate/shared。
 *
 * 包內可重入(每個調用方拿到自己的 WebSocket 連接與消息緩衝);
 * 401 重定向與 token 刷新交給 shared/api 的 createApiClient 攔截器統一處理,
 * WebSocket 層只負責把 token 作為 query string 注入(後端 ws 升級握手需要)。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../auth/token';

export interface WsMessage {
  type: string;
  title: string;
  content: string;
  timestamp?: string;
}

export interface UseWebSocketOptions {
  url?: string;
  onMessage?: (msg: WsMessage) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

export interface UseWebSocketResult {
  connected: boolean;
  messages: WsMessage[];
  sendMessage: (msg: WsMessage) => void;
  clearMessages: () => void;
}

const DEFAULT_RECONNECT_MS = 5000;
const DEFAULT_MAX_RETRIES = 10;
const MESSAGE_BUFFER_LIMIT = 100;

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    url,
    onMessage,
    reconnectInterval = DEFAULT_RECONNECT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WsMessage[]>([]);

  // Resolve ws URL lazily: caller-provided > default obs endpoint
  const wsUrl = useRef<string | null>(null);
  if (wsUrl.current === null) {
    if (url) {
      wsUrl.current = url;
    } else if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getToken();
      wsUrl.current = `${proto}//${window.location.host}/api/v1/obs/ws${token ? `?token=${token}` : ''}`;
    } else {
      wsUrl.current = '';
    }
  }

  const connect = useCallback(() => {
    const target = wsUrl.current;
    if (!target) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(target);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryCount.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          setMessages((prev) => [msg, ...prev].slice(0, MESSAGE_BUFFER_LIMIT));
          onMessageRef.current?.(msg);
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (retryCount.current < maxRetries) {
          retryCount.current += 1;
          retryTimer.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
      if (retryCount.current < maxRetries) {
        retryCount.current += 1;
        retryTimer.current = setTimeout(connect, reconnectInterval);
      }
    }
  }, [reconnectInterval, maxRetries]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { connected, messages, sendMessage, clearMessages };
}

export default useWebSocket;
