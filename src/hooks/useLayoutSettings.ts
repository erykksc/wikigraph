import { useCallback, useEffect, useRef } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import type { GraphController } from "../graph";
import { useAppStore } from "../store/useAppStore";

type UseLayoutSettingsParams = {
  graphRef: React.RefObject<GraphController | null>;
  defaultSettings: ForceAtlas2Settings;
  pausedSlowdown: number;
};

export function useLayoutSettings({
  graphRef,
  defaultSettings,
  pausedSlowdown,
}: UseLayoutSettingsParams) {
  const hasAppliedInitialLayoutRef = useRef(false);
  const slowdownBeforePauseRef = useRef(defaultSettings.slowDown ?? 0.1);
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
    slowdownBeforePauseRef.current = defaultSettings.slowDown ?? 0.1;
    resetStoredLayoutSettings();
  }, [defaultSettings.slowDown, resetStoredLayoutSettings]);

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

  return {
    layoutSettings,
    isPaused,
    setLayoutBoolean,
    setLayoutNumber,
    resetLayoutSettings,
    togglePause,
  };
}
