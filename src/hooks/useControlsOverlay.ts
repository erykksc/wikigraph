import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_MEDIA_QUERY = "(min-width: 801px) and (max-width: 1120px)";

type UseControlsOverlayParams = {
  mediaQuery?: string;
};

export function useControlsOverlay({
  mediaQuery = DEFAULT_MEDIA_QUERY,
}: UseControlsOverlayParams = {}) {
  const controlsPanelRef = useRef<HTMLElement | null>(null);
  const controlsOpen = useAppStore((state) => state.controlsOpen);
  const closeControls = useAppStore((state) => state.closeControls);
  const [isCenteredControlsLayout, setIsCenteredControlsLayout] =
    useState(false);

  useEffect(() => {
    const currentMediaQuery = window.matchMedia(mediaQuery);
    const updateCenteredControlsLayout = (
      event: MediaQueryList | MediaQueryListEvent,
    ) => {
      setIsCenteredControlsLayout(event.matches);
    };

    updateCenteredControlsLayout(currentMediaQuery);
    currentMediaQuery.addEventListener("change", updateCenteredControlsLayout);

    return () => {
      currentMediaQuery.removeEventListener(
        "change",
        updateCenteredControlsLayout,
      );
    };
  }, [mediaQuery]);

  useEffect(() => {
    if (!controlsOpen || !isCenteredControlsLayout) {
      return;
    }

    const handlePointerDown = (
      event: MouseEvent | PointerEvent | TouchEvent,
    ) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (controlsPanelRef.current?.contains(target)) {
        return;
      }

      closeControls();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeControls, controlsOpen, isCenteredControlsLayout]);

  return {
    controlsPanelRef,
    isCenteredControlsLayout,
  };
}
