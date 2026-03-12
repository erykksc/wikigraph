import { useCallback, useEffect, useRef, type FormEvent } from "react";
import styles from "./App.module.css";
import SpotlightBar from "./components/SpotlightBar";
import GraphActions from "./components/graph/GraphActions";
import GraphCanvas from "./components/graph/GraphCanvas";
import CreditBadge from "./components/graph/CreditBadge";
import ExpandButton from "./components/graph/ExpandButton";
import GraphInfo from "./components/graph/GraphInfo";
import LayoutControlsPanel from "./components/graph/LayoutControlsPanel";
import StatusToast from "./components/graph/StatusToast";
import { useAppHotkeys } from "./hooks/useAppHotkeys";
import { useControlsOverlay } from "./hooks/useControlsOverlay";
import { useGraphController } from "./hooks/useGraphController";
import { useLayoutSettings } from "./hooks/useLayoutSettings";
import { useStatusToast } from "./hooks/useStatusToast";
import { defaultLayoutSettings } from "./layout-config";
import { useAppStore } from "./store/useAppStore";

const PAUSED_SLOWDOWN = 999999;
const BACKGROUND_MUSIC_VOLUME = 0.3;

function App() {
  const assetBaseUrl = import.meta.env.BASE_URL;
  const seed = useAppStore((state) => state.seed);
  const querySource = useAppStore((state) => state.querySource);
  const spotlightOpen = useAppStore((state) => state.spotlightOpen);
  const isAudioMuted = useAppStore((state) => state.isAudioMuted);
  const selectedNode = useAppStore((state) => state.selectedNode);
  const setSeed = useAppStore((state) => state.setSeed);
  const openSpotlight = useAppStore((state) => state.openSpotlight);
  const closeSpotlight = useAppStore((state) => state.closeSpotlight);
  const closeControls = useAppStore((state) => state.closeControls);
  const toggleControls = useAppStore((state) => state.toggleControls);
  const toggleAudioMuted = useAppStore((state) => state.toggleAudioMuted);
  const { showStatus, fadeStatus, clearStatus } = useStatusToast();
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedAudioRef = useRef(false);

  const unlockAudio = useCallback(async () => {
    if (hasUnlockedAudioRef.current) {
      return true;
    }

    const backgroundAudio = backgroundAudioRef.current;
    if (!backgroundAudio) {
      return false;
    }

    try {
      await backgroundAudio.play();
      hasUnlockedAudioRef.current = true;
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Audio playback was blocked";
      showStatus("Interact again to enable audio", message);
      fadeStatus();
      return false;
    }
  }, [fadeStatus, showStatus]);

  const playExpansionSound = useCallback(() => {
    const clickAudio = clickAudioRef.current;
    if (!clickAudio) {
      return;
    }

    void unlockAudio().then((didUnlock) => {
      if (!didUnlock) {
        return;
      }

      clickAudio.currentTime = 0;
      void clickAudio.play().catch(() => {
        // Ignore transient sound effect playback failures.
      });
    });
  }, [unlockAudio]);

  const openSelectedArticle = useCallback(() => {
    if (!selectedNode) {
      return;
    }

    const url = `https://${querySource}.wikipedia.org/wiki/${encodeURIComponent(selectedNode.title)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [querySource, selectedNode]);

  const {
    containerRef,
    graphRef,
    isLoading,
    hasGraph,
    seedGraph,
    resetGraph,
    fitGraph,
    expandSelectedNode,
  } = useGraphController({
    querySource,
    initialLayoutSettings: defaultLayoutSettings,
    onShowStatus: showStatus,
    onFadeStatus: fadeStatus,
    onClearStatus: clearStatus,
    onExpansionTriggered: playExpansionSound,
  });
  const { resetLayoutSettings, togglePause } = useLayoutSettings({
    graphRef,
    defaultSettings: defaultLayoutSettings,
    pausedSlowdown: PAUSED_SLOWDOWN,
  });
  const { controlsPanelRef } = useControlsOverlay();

  useEffect(() => {
    const backgroundAudio = new Audio(`${assetBaseUrl}background-music.mp3`);
    backgroundAudio.loop = true;
    backgroundAudio.preload = "auto";
    backgroundAudio.volume = BACKGROUND_MUSIC_VOLUME;
    backgroundAudioRef.current = backgroundAudio;

    const clickAudio = new Audio(`${assetBaseUrl}sound_effect-click.wav`);
    clickAudio.preload = "auto";
    clickAudioRef.current = clickAudio;

    return () => {
      backgroundAudio.pause();
      backgroundAudioRef.current = null;
      clickAudioRef.current = null;
      hasUnlockedAudioRef.current = false;
    };
  }, [assetBaseUrl]);

  useEffect(() => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.muted = isAudioMuted;
    }

    if (clickAudioRef.current) {
      clickAudioRef.current.muted = isAudioMuted;
    }
  }, [isAudioMuted]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      void unlockAudio().then((didUnlock) => {
        if (!didUnlock) {
          return;
        }

        window.removeEventListener("pointerdown", handleFirstInteraction);
        window.removeEventListener("keydown", handleFirstInteraction);
      });
    };

    window.addEventListener("pointerdown", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [unlockAudio]);

  const handleResetGraph = () => {
    resetGraph();
    closeControls();
    openSpotlight();
  };

  useAppHotkeys({
    hasGraph,
    onExpandSelectedNode: () => {
      void expandSelectedNode();
    },
    onFitGraph: fitGraph,
    onOpenSelectedArticle: openSelectedArticle,
    onResetGraph: handleResetGraph,
    onToggleAudioMuted: toggleAudioMuted,
    onTogglePause: togglePause,
  });

  const shouldShowExpandButton = !!selectedNode && !isLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSeed = seed.trim();

    if (!nextSeed) {
      return;
    }

    clearStatus();

    try {
      await seedGraph(nextSeed);
      closeSpotlight();
      setSeed("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load seed";
      showStatus(message, message);
    }
  };

  return (
    <div className={styles.app}>
      <main className={styles.canvas}>
        <GraphCanvas containerRef={containerRef} />
        <SpotlightBar
          assetBaseUrl={assetBaseUrl}
          open={!hasGraph || spotlightOpen}
          hasGraph={hasGraph}
          isLoading={isLoading}
          isAudioMuted={isAudioMuted}
          onSubmit={handleSubmit}
          onToggleAudioMuted={toggleAudioMuted}
          onRequestClose={() => {
            if (hasGraph) {
              closeSpotlight();
            }
          }}
        />
        {hasGraph ? (
          <>
            <GraphActions
              onOpenSpotlight={openSpotlight}
              onFitGraph={fitGraph}
              onResetGraph={handleResetGraph}
            />
            <div className={styles.bottomCenterStack}>
              <StatusToast />
              {shouldShowExpandButton ? (
                <ExpandButton
                  selectedTitle={selectedNode.title}
                  isExpanded={selectedNode.expanded}
                  onOpenArticle={openSelectedArticle}
                  onExpand={() => {
                    void expandSelectedNode();
                  }}
                />
              ) : null}
            </div>
            <GraphInfo />
            <div className={styles.bottomInfoStack}>
              <CreditBadge />
            </div>
          </>
        ) : null}
        {hasGraph && !spotlightOpen ? (
          <LayoutControlsPanel
            panelRef={controlsPanelRef}
            assetBaseUrl={assetBaseUrl}
            isAudioMuted={isAudioMuted}
            onToggleOpen={toggleControls}
            onToggleAudioMuted={toggleAudioMuted}
            onTogglePause={togglePause}
            onReset={resetLayoutSettings}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
