import type { FormEvent } from "react";
import styles from "./App.module.css";
import SpotlightBar from "./components/SpotlightBar";
import GraphActions from "./components/graph/GraphActions";
import GraphCanvas from "./components/graph/GraphCanvas";
import CreditBadge from "./components/graph/CreditBadge";
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

const PAUSED_SLOWDOWN = 1000;

function App() {
  const assetBaseUrl = import.meta.env.BASE_URL;
  const seed = useAppStore((state) => state.seed);
  const querySource = useAppStore((state) => state.querySource);
  const spotlightOpen = useAppStore((state) => state.spotlightOpen);
  const setSeed = useAppStore((state) => state.setSeed);
  const openSpotlight = useAppStore((state) => state.openSpotlight);
  const closeSpotlight = useAppStore((state) => state.closeSpotlight);
  const closeControls = useAppStore((state) => state.closeControls);
  const toggleControls = useAppStore((state) => state.toggleControls);
  const { showStatus, fadeStatus, clearStatus } = useStatusToast();
  const {
    containerRef,
    graphRef,
    isLoading,
    hasGraph,
    seedGraph,
    resetGraph,
    fitGraph,
  } = useGraphController({
    querySource,
    initialLayoutSettings: defaultLayoutSettings,
    onShowStatus: showStatus,
    onFadeStatus: fadeStatus,
    onClearStatus: clearStatus,
  });
  const { resetLayoutSettings, togglePause } = useLayoutSettings({
    graphRef,
    defaultSettings: defaultLayoutSettings,
    pausedSlowdown: PAUSED_SLOWDOWN,
  });
  const { controlsPanelRef } = useControlsOverlay();

  const handleResetGraph = () => {
    resetGraph();
    closeControls();
    openSpotlight();
  };

  useAppHotkeys({
    hasGraph,
    onFitGraph: fitGraph,
    onResetGraph: handleResetGraph,
    onTogglePause: togglePause,
  });

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
          open={!hasGraph || spotlightOpen}
          hasGraph={hasGraph}
          isLoading={isLoading}
          onSubmit={handleSubmit}
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
            <GraphInfo />
            <div className={styles.bottomInfoStack}>
              <StatusToast />
              <CreditBadge />
            </div>
          </>
        ) : null}
        {hasGraph && !spotlightOpen ? (
          <LayoutControlsPanel
            panelRef={controlsPanelRef}
            assetBaseUrl={assetBaseUrl}
            onToggleOpen={toggleControls}
            onTogglePause={togglePause}
            onReset={resetLayoutSettings}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
