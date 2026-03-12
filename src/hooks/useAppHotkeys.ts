import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

type UseAppHotkeysParams = {
  hasGraph: boolean;
  onFitGraph: () => void;
  onResetGraph: () => void;
  onToggleAudioMuted: () => void;
  onTogglePause: () => void;
};

export function useAppHotkeys({
  hasGraph,
  onFitGraph,
  onResetGraph,
  onToggleAudioMuted,
  onTogglePause,
}: UseAppHotkeysParams) {
  const spotlightOpen = useAppStore((state) => state.spotlightOpen);
  const controlsOpen = useAppStore((state) => state.controlsOpen);
  const openSpotlight = useAppStore((state) => state.openSpotlight);
  const openControls = useAppStore((state) => state.openControls);
  const closeControls = useAppStore((state) => state.closeControls);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (isEditable) {
        return;
      }

      if (event.key === "Escape" && controlsOpen) {
        event.preventDefault();
        closeControls();
        return;
      }

      const isSpacebar =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";

      if (isSpacebar) {
        event.preventDefault();
        onTogglePause();
        return;
      }

      const isSlash =
        event.key === "/" && !event.altKey && !event.metaKey && !event.ctrlKey;
      const isCommandK =
        event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

      if (isSlash || isCommandK) {
        event.preventDefault();
        openSpotlight();
        return;
      }

      if (
        event.key.toLowerCase() === "f" &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        if (hasGraph) {
          onFitGraph();
        }
        return;
      }

      if (
        event.key.toLowerCase() === "r" &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        if (hasGraph) {
          onResetGraph();
        }
        return;
      }

      if (
        event.key === "," &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        if (hasGraph && !spotlightOpen) {
          openControls();
        }
      }

      if (
        event.key.toLowerCase() === "m" &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        onToggleAudioMuted();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeControls,
    controlsOpen,
    hasGraph,
    onFitGraph,
    onResetGraph,
    onToggleAudioMuted,
    onTogglePause,
    openControls,
    openSpotlight,
    spotlightOpen,
  ]);
}
