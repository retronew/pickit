import { useCallback, useRef } from "react";

interface Handlers<R> {
  /** The result of the latest save; results of superseded saves are dropped. */
  onSuccess?: (result: R) => void;
  /** Only the latest save's failure is reported; a newer save replaces a failed older one. */
  onError?: (err: unknown) => void;
}

/**
 * Saves where only the last value counts. One request is in flight at a time;
 * values queued meanwhile collapse into the newest, sent once the current one
 * finishes. So the server always ends on the last value, and responses never
 * arrive out of order.
 */
export function useLatestSave<T, R>(send: (value: T) => Promise<R>, handlers: Handlers<R> = {}) {
  const latest = useRef({ send, handlers });
  latest.current = { send, handlers };
  const pending = useRef<{ value: T } | null>(null);
  const inFlight = useRef(false);

  return useCallback((value: T) => {
    pending.current = { value };
    if (inFlight.current) return;
    inFlight.current = true;
    void (async () => {
      while (pending.current) {
        const next = pending.current.value;
        pending.current = null;
        try {
          const result = await latest.current.send(next);
          if (!pending.current) latest.current.handlers.onSuccess?.(result);
        } catch (err) {
          if (!pending.current) latest.current.handlers.onError?.(err);
        }
      }
      inFlight.current = false;
    })();
  }, []);
}
