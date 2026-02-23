import { useEffect, useRef } from 'react';

/**
 * useSSE — manages an EventSource connection with typed event handlers.
 *
 * @param {string|null} url      - SSE endpoint URL; pass null to disable
 * @param {object}      handlers - { eventType: (data) => void, ... }
 * @param {object}      options  - { retries: number, retryDelay: number }
 */
export function useSSE(url, handlers, options = {}) {
  const { retries = 3, retryDelay = 2000 } = options;
  const handlersRef  = useRef(handlers);
  const retriesLeft  = useRef(retries);
  const esRef        = useRef(null);

  // Keep handlers ref up-to-date without re-connecting
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!url) return;

    function connect() {
      if (esRef.current) esRef.current.close();
      console.log(`[SSE] Connecting to ${url}`);
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Connected');
        retriesLeft.current = retries;
      };

      es.onerror = (e) => {
        console.warn('[SSE] Error', e);
        es.close();
        if (retriesLeft.current > 0) {
          retriesLeft.current--;
          console.log(`[SSE] Retrying in ${retryDelay}ms (${retriesLeft.current} left)`);
          setTimeout(connect, retryDelay);
        } else {
          handlersRef.current?.error?.({ code: 'CONNECTION_ERROR', message: 'SSE connection failed' });
        }
      };

      // Listen for all typed events
      const EVENTS = ['progress', 'text_chunk', 'structure', 'postcard', 'audio', 'stats', 'what_if', 'complete', 'error'];
      EVENTS.forEach((eventType) => {
        es.addEventListener(eventType, (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log(`[SSE] ${eventType}:`, data);
            handlersRef.current?.[eventType]?.(data);
          } catch {
            console.warn(`[SSE] Bad JSON for event ${eventType}:`, e.data);
          }
        });
      });
    }

    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [url]);
}
