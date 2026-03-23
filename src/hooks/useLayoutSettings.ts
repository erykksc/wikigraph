import { useCallback, useEffect, useRef } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import type { GraphController } from "../graph";
import { useAppStore } from "../store/useAppStore";

type UseLayoutSettingsParams = {
  graphRef: React.RefObject<GraphController | null>;
  defaultSettings: ForceAtlas2Settings;
  pausedSlowdown: number;
  fastForwardSlowdown: number;
};

export function useLayoutSettings({
  graphRef,
  defaultSettings,
  pausedSlowdown,
  fastForwardSlowdown,
}: UseLayoutSettingsParams) {
  const hasAppliedInitialLayoutRef = useRef(false);
  const defaultSlowdown = defaultSettings.slowDown ?? 0.1;
  const slowdownBeforePauseRef = useRef(defaultSlowdown);
  const slowdownBeforeFastForwardRef = useRef(defaultSlowdown);
  const layoutSettings = useAppStore((state) => state.layoutSettings);
  const isPaused = useAppStore((state) => state.isPaused);
  const updateLayoutBoolean = useAppStore((state) => state.setLayoutBoolean);
  const updateLayoutNumber = useAppStore((state) => state.setLayoutNumber);
  const resetStoredLayoutSettings = useAppStore(
    (state) => state.resetLayoutSettings,
  );
  const setIsPaused = useAppStore((state) => state.setIsPaused);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }

    if (!hasAppliedInitialLayoutRef.current) {
      hasAppliedInitialLayoutRef.current = true;
      return;
    }

    graphRef.current.updateLayoutSettings(layoutSettings);
  }, [graphRef, layoutSettings]);

  useEffect(() => {
    if (!isPaused && layoutSettings.slowDown !== fastForwardSlowdown) {
      slowdownBeforeFastForwardRef.current =
        layoutSettings.slowDown ?? defaultSlowdown;
    }
  }, [defaultSlowdown, fastForwardSlowdown, isPaused, layoutSettings.slowDown]);

  const setLayoutBoolean = useCallback(
    (key: keyof ForceAtlas2Settings, value: boolean) => {
      updateLayoutBoolean(key, value);
    },
    [updateLayoutBoolean],
  );

  const setLayoutNumber = useCallback(
    (key: keyof ForceAtlas2Settings, value: number) => {
      updateLayoutNumber(key, value);
    },
    [updateLayoutNumber],
  );

  const resetLayoutSettings = useCallback(() => {
    slowdownBeforePauseRef.current = defaultSlowdown;
    slowdownBeforeFastForwardRef.current = defaultSlowdown;
    resetStoredLayoutSettings();
  }, [defaultSlowdown, resetStoredLayoutSettings]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      updateLayoutNumber("slowDown", slowdownBeforePauseRef.current);
      setIsPaused(false);
      return;
    }

    slowdownBeforePauseRef.current = layoutSettings.slowDown ?? 0.1;
    updateLayoutNumber("slowDown", pausedSlowdown);
    setIsPaused(true);
  }, [
    isPaused,
    layoutSettings.slowDown,
    pausedSlowdown,
    setIsPaused,
    updateLayoutNumber,
  ]);

  const toggleFastForward = useCallback(() => {
    const currentSlowdown = isPaused
      ? slowdownBeforePauseRef.current
      : (layoutSettings.slowDown ?? defaultSlowdown);

    if (currentSlowdown === fastForwardSlowdown) {
      const restoredSlowdown = slowdownBeforeFastForwardRef.current;

      if (isPaused) {
        slowdownBeforePauseRef.current = restoredSlowdown;
        return;
      }

      updateLayoutNumber("slowDown", restoredSlowdown);
      return;
    }

    slowdownBeforeFastForwardRef.current = currentSlowdown;

    if (isPaused) {
      slowdownBeforePauseRef.current = fastForwardSlowdown;
      return;
    }

    updateLayoutNumber("slowDown", fastForwardSlowdown);
  }, [
    defaultSlowdown,
    fastForwardSlowdown,
    isPaused,
    layoutSettings.slowDown,
    updateLayoutNumber,
  ]);

  const isFastForwarded =
    (isPaused ? slowdownBeforePauseRef.current : layoutSettings.slowDown) ===
    fastForwardSlowdown;

  return {
    layoutSettings,
    isPaused,
    isFastForwarded,
    setLayoutBoolean,
    setLayoutNumber,
    resetLayoutSettings,
    toggleFastForward,
    togglePause,
  };
}
