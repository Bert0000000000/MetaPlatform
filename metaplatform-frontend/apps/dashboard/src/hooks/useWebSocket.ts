import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/utils/auth';

export interface WsMessage {
  type: string;
  title: string;
  content: string;
  timestamp?: string;
}

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (msg: WsMessage) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url,
    onMessage,
    reconnectInterval = 5000,
    maxRetries = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const wsUrl = url || (() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getToken();
    return `${proto}//${window.location.host}/api/v1/obs/ws${token ? `?token=${token}` : ''}`;
  })();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryCount.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          setMessages((prev) => [msg, ...prev].slice(0, 100));
          onMessageRef.current?.(msg);
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          retryTimer.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        retryTimer.current = setTimeout(connect, reconnectInterval);
      }
    }
  }, [wsUrl, reconnectInterval, maxRetries]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
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
