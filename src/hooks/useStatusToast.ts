import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_FADE_DURATION_MS = 3000;

export function useStatusToast(fadeDurationMs = DEFAULT_FADE_DURATION_MS) {
  const timeoutRef = useRef<number | null>(null);
  const showToast = useAppStore((state) => state.showToast);
  const setToastFading = useAppStore((state) => state.setToastFading);
  const clearToast = useAppStore((state) => state.clearToast);

  const clearStatus = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    clearToast();
  }, [clearToast]);

  const showStatus = useCallback(
    (message: string, nextError: string | null = null) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      showToast(message, nextError);
    },
    [showToast],
  );

  const fadeStatus = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setToastFading(true);

    timeoutRef.current = window.setTimeout(() => {
      clearToast();
      timeoutRef.current = null;
    }, fadeDurationMs);
  }, [clearToast, fadeDurationMs, setToastFading]);

  useEffect(() => clearStatus, [clearStatus]);

  return {
    showStatus,
    fadeStatus,
    clearStatus,
  };
}
