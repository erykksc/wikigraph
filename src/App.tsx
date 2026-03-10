import { useEffect, useRef, useState } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import { expandTitle, type WikipediaLanguage } from "./api";
import { GraphController } from "./graph";
import { layoutControls, defaultLayoutSettings } from "./layout-config";
import SpotlightBar from "./components/SpotlightBar";
import CircularButton from "./components/CircularButton";

const PAUSED_SLOWDOWN = 1000;
const STATUS_FADE_DURATION_MS = 3000;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphController | null>(null);
  const hasAppliedInitialLayoutRef = useRef(false);
  const [seed, setSeed] = useState("");
  const [status, setStatus] = useState("");
  const [querySource, setQuerySource] = useState<WikipediaLanguage>("en");
  const [layoutSettings, setLayoutSettings] = useState<ForceAtlas2Settings>(
    defaultLayoutSettings,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusFading, setStatusFading] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const querySourceRef = useRef<WikipediaLanguage>(querySource);
  const initialLayoutSettingsRef = useRef(layoutSettings);
  const prevHasGraphRef = useRef(false);
  const slowdownBeforePauseRef = useRef(defaultLayoutSettings.slowDown);
  const statusTimeoutRef = useRef<number | null>(null);

  const hasGraph = nodeCount > 0;

  const showStatus = (message: string, nextError: string | null = null) => {
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus(message);
    setError(nextError);
    setStatusFading(false);
    setStatusVisible(true);
  };

  const fadeStatus = () => {
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    setStatusFading(true);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusVisible(false);
      setStatusFading(false);
      setStatus("");
      setError(null);
      statusTimeoutRef.current = null;
    }, STATUS_FADE_DURATION_MS);
  };

  useEffect(() => {
    querySourceRef.current = querySource;
  }, [querySource]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasGraph && !prevHasGraphRef.current) {
      setSpotlightOpen(false);
    }
    if (!hasGraph && prevHasGraphRef.current) {
      setSpotlightOpen(true);
    }
    prevHasGraphRef.current = hasGraph;
  }, [hasGraph]);

  useEffect(() => {
    if (!hasGraph) {
      setControlsOpen(false);
    }
  }, [hasGraph]);

  useEffect(() => {
    if (!containerRef.current) return;
    graphRef.current = new GraphController({
      container: containerRef.current,
      initialLayoutSettings: initialLayoutSettingsRef.current,
      onExpand: async (title) => {
        setIsLoading(true);
        showStatus(`Expanding ${title}`);
        try {
          const source = querySourceRef.current;
          const payload = await expandTitle(title, source);
          showStatus(`Expanded ${title}`);
          fadeStatus();
          return payload;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Expansion failed";
          showStatus(message, message);
          fadeStatus();
          throw err;
        } finally {
          setIsLoading(false);
        }
      },
      resolveArticleUrl: (title) => {
        const language = querySourceRef.current;
        return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      },
      onNodeCountChange: setNodeCount,
      onEdgeCountChange: setEdgeCount,
    });

    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (isEditable) return;

      const isSpacebar =
        event.key === " " || event.key === "Spacebar" || event.code === "Space";

      if (isSpacebar) {
        event.preventDefault();
        setIsPaused((prev) => {
          if (prev) {
            setLayoutSettings((current) => ({
              ...current,
              slowDown: slowdownBeforePauseRef.current,
            }));
            return false;
          }

          slowdownBeforePauseRef.current = layoutSettings.slowDown;
          setLayoutSettings((current) => ({
            ...current,
            slowDown: PAUSED_SLOWDOWN,
          }));
          return true;
        });
        return;
      }

      const isSlash =
        event.key === "/" && !event.altKey && !event.metaKey && !event.ctrlKey;
      const isCommandK =
        event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

      if (isSlash || isCommandK) {
        event.preventDefault();
        setSpotlightOpen(true);
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "f" && !event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        if (hasGraph) {
          graphRef.current?.fitToGraph();
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
          setControlsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasGraph, isPaused, layoutSettings.slowDown, spotlightOpen]);

  useEffect(() => {
    if (!graphRef.current) return;
    if (!hasAppliedInitialLayoutRef.current) {
      hasAppliedInitialLayoutRef.current = true;
      return;
    }
    graphRef.current.updateLayoutSettings(layoutSettings);
  }, [layoutSettings]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!graphRef.current || !seed.trim()) return;
    setError(null);
    try {
      await graphRef.current.seed(seed.trim());
      setSpotlightOpen(false);
      setSeed("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load seed";
      setError(message);
    }
  };

  const handleReset = () => {
    graphRef.current?.reset();
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus("");
    setError(null);
    setStatusVisible(false);
    setStatusFading(false);
    setNodeCount(0);
    setEdgeCount(0);
    setSpotlightOpen(true);
  };

  const handleResetLayoutSettings = () => {
    setLayoutSettings({ ...defaultLayoutSettings });
  };

  const handlePauseToggle = () => {
    setIsPaused((prev) => {
      if (prev) {
        setLayoutSettings((current) => ({
          ...current,
          slowDown: slowdownBeforePauseRef.current,
        }));
        return false;
      }

      slowdownBeforePauseRef.current = layoutSettings.slowDown;
      setLayoutSettings((current) => ({
        ...current,
        slowDown: PAUSED_SLOWDOWN,
      }));
      return true;
    });
  };

  return (
    <div className="app">
      <main className="canvas">
        <div className="graph-container" ref={containerRef} />
        <SpotlightBar
          open={!hasGraph || spotlightOpen}
          hasGraph={hasGraph}
          seed={seed}
          querySource={querySource}
          isLoading={isLoading}
          onSeedChange={setSeed}
          onQuerySourceChange={setQuerySource}
          onSubmit={handleSubmit}
          onRequestClose={() => {
            if (hasGraph) {
              setSpotlightOpen(false);
            }
          }}
        />
        {hasGraph ? (
          <>
            <div className="graph-actions">
              <CircularButton
                text="Search"
                className="graph-actions__button--icon"
                onClick={() => setSpotlightOpen(true)}
                ariaLabel="Open search"
                title={
                  "Open the article search panel\n\nshortcut: / or cmd/ctrl+k"
                }
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15.7 15.7L20 20M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </CircularButton>
              <CircularButton
                text="Fit View"
                onClick={() => graphRef.current?.fitToGraph()}
                ariaLabel="Fit graph to view"
                title={
                  "Center and zoom the graph to fit the viewport\n\nshortcut: f"
                }
                disabled={!hasGraph}
              />
              <CircularButton
                text="Reset"
                onClick={handleReset}
                ariaLabel="Reset graph"
                title="Clear the current graph and return to the search view"
                disabled={!hasGraph}
              />
            </div>
            <div
              className={`status${error ? " status--error" : ""}${
                statusVisible ? " status--visible" : ""
              }${statusFading ? " status--fading" : ""}`}
              aria-hidden={!statusVisible}
            >
              <strong>{error ? "Error" : "Status"}</strong> · {error ?? status}
            </div>
            <div className="info-stack">
              <div className="node-count">
                <div>Nodes: {nodeCount}</div>
                <div>Edges: {edgeCount}</div>
              </div>
              <div className="credit">
                <a
                  href="https://github.com/erykksc"
                  target="_blank"
                  rel="noreferrer"
                >
                  Created by Eryk Kściuczyk
                </a>
              </div>
            </div>
          </>
        ) : null}
        {hasGraph && !spotlightOpen ? (
          <aside
            className={`controls-panel${
              controlsOpen ? "" : " controls-panel--collapsed"
            }`}
          >
            <div className="controls-panel__header">
              {controlsOpen ? (
                <div className="controls-panel__title">
                  Graph Layout Settings
                </div>
              ) : null}
              <button
                type="button"
                className="controls-panel__toggle controls-panel__toggle--pause"
                onClick={handlePauseToggle}
                title={
                  isPaused
                    ? "Resume the graph layout simulation\n\nshortcut: space"
                    : "Pause the graph layout simulation\n\nshortcut: space"
                }
                aria-label={
                  isPaused ? "Resume graph layout" : "Pause graph layout"
                }
                aria-pressed={isPaused}
              >
                <img
                  src={isPaused ? "/play.svg" : "/pause.svg"}
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="controls-panel__toggle controls-panel__toggle--settings"
                onClick={() => setControlsOpen((prev) => !prev)}
                title={
                  controlsOpen
                    ? "Hide the graph layout controls\n\nshortcut: ,"
                    : "Show the graph layout controls\n\nshortcut: ,"
                }
                aria-label={
                  controlsOpen
                    ? "Close graph layout settings"
                    : "Open graph layout settings"
                }
                aria-expanded={controlsOpen}
              >
                <img src="/cog.svg" alt="" aria-hidden="true" />
              </button>
            </div>
            {controlsOpen ? (
              <div
                className={`controls-panel__content${
                  isPaused ? " controls-panel__content--disabled" : ""
                }`}
              >
                {isPaused ? (
                  <div className="controls-panel__hint" role="status">
                    Resume layout to edit settings.
                  </div>
                ) : null}
                {layoutControls.map((control) => {
                  if (control.type === "boolean") {
                    const checked = Boolean(layoutSettings[control.key]);
                    return (
                      <label
                        className="toggle"
                        key={control.key}
                        title={control.description}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPaused}
                          onChange={(event) =>
                            setLayoutSettings((prev) => ({
                              ...prev,
                              [control.key]: event.target.checked,
                            }))
                          }
                        />
                        <span>{control.label}</span>
                      </label>
                    );
                  }

                  const value = Number(layoutSettings[control.key] ?? 0);
                  return (
                    <label
                      className="slider"
                      key={control.key}
                      title={control.description}
                    >
                      <div>
                        <span>{control.label}</span>
                        <span className="slider__value">
                          {value.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={value}
                        disabled={isPaused}
                        onChange={(event) =>
                          setLayoutSettings((prev) => ({
                            ...prev,
                            [control.key]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  );
                })}
                <button
                  type="button"
                  className="controls-panel__reset"
                  onClick={handleResetLayoutSettings}
                  aria-label="Reset layout settings to default"
                  title="Restore the layout controls to their default values"
                  disabled={isPaused}
                >
                  <span>Reset to default</span>
                  <img src="/reset.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </main>
    </div>
  );
}

export default App;
