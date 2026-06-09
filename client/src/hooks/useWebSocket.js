import { useState, useEffect, useRef, useCallback } from 'react';

// Reconnect backoff (NFR-7): exponential 1s, 2s, 4s, ... capped at 30s,
// with jitter to avoid thundering-herd reconnects. Resets on a successful open.
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

function useWebSocket(url) {
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const attemptRef = useRef(0);

  const scheduleReconnect = useCallback((connectFn) => {
    const attempt = attemptRef.current;
    const backoff = Math.min(
      BASE_RECONNECT_MS * 2 ** attempt,
      MAX_RECONNECT_MS
    );
    const jitter = Math.random() * 0.3 * backoff; // up to +30%
    const delay = backoff + jitter;
    attemptRef.current = attempt + 1;
    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${attempt + 1})`);
    reconnectTimeoutRef.current = setTimeout(connectFn, delay);
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        attemptRef.current = 0; // reset backoff on success
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        scheduleReconnect(connect);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // onclose follows onerror and handles the reconnect.
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      scheduleReconnect(connect);
    }
  }, [url, scheduleReconnect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { lastMessage, isConnected };
}

export default useWebSocket;
