import { useCallback, useEffect, useRef, useState } from 'react';

// Generic countdown timer with pause/resume semantics.
export function useTimer(initialTimeMs: number, onTimeout: () => void): {
  timeMs: number;
  isRunning: boolean;
  start: (nextInitialMs?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: (nextInitialMs?: number) => void;
} {
  const [timeMs, setTimeMs] = useState(initialTimeMs);
  const [isRunning, setIsRunning] = useState(false);
  const timeoutCalledRef = useRef(false);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const id = window.setInterval(() => {
      setTimeMs((prev) => {
        const next = Math.max(0, prev - 100);
        if (next === 0 && !timeoutCalledRef.current) {
          timeoutCalledRef.current = true;
          onTimeout();
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(id);
  }, [isRunning, onTimeout]);

  const start = useCallback((nextInitialMs?: number) => {
    timeoutCalledRef.current = false;
    if (typeof nextInitialMs === 'number') {
      setTimeMs(nextInitialMs);
    }
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (timeMs <= 0) {
      return;
    }
    setIsRunning(true);
  }, [timeMs]);

  const reset = useCallback((nextInitialMs?: number) => {
    timeoutCalledRef.current = false;
    setIsRunning(false);
    setTimeMs(typeof nextInitialMs === 'number' ? nextInitialMs : initialTimeMs);
  }, [initialTimeMs]);

  return {
    timeMs,
    isRunning,
    start,
    pause,
    resume,
    reset,
  };
}
