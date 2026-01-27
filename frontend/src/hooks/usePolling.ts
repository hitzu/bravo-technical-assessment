import { useEffect, useRef } from 'react';

export interface UsePollingOptions {
  enabled: boolean;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Runs `cb` immediately when enabled turns true, then polls every `intervalMs`.
 * If a call is already in-flight, the next tick is skipped (no overlaps).
 */
export function usePolling(
  cb: () => void | Promise<void>,
  options: UsePollingOptions,
) {
  const { enabled, intervalMs = DEFAULT_INTERVAL_MS } = options;

  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await cbRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();

    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);
}

