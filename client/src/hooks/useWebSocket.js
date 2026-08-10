import { useState, useEffect, useRef, useCallback } from 'react';

// Reconnect backoff (NFR-7): exponential 1s, 2s, 4s, ... capped at 30s,
// with jitter to avoid thundering-herd reconnects. Resets on a successful open.
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

// Frames are delivered to `onMessage` as they arrive rather than parked in a
// `lastMessage` state slot (issue #88). A single slot silently loses frames:
// the server sends `message`, `settings` and `screens` back-to-back on connect,
// the browser dispatches them in one task, and React 18 batches the three
// setState calls into one commit — so only the final frame is ever observed.
// The middle one, `settings`, is the mode the display boots into, which is why
// a board set to flip came up as the word clock.
function useWebSocket(url, onMessage) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const attemptRef = useRef(0);

  // Held in a ref so an inline callback (a new identity every render) does not
  // land in connect()'s dependencies and tear the socket down on each render.
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

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
          handlerRef.current?.(data);
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

  return { isConnected };
}

export default useWebSocket;
