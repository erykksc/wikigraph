import { useEffect, useRef, useState } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import { expandTitle, type WikipediaLanguage } from "./api";
import { GraphController } from "./graph";
import { layoutControls, defaultLayoutSettings } from "./layout-config";
import SpotlightBar from "./components/SpotlightBar";

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphController | null>(null);
  const hasAppliedInitialLayoutRef = useRef(false);
  const [seed, setSeed] = useState("");
  const [status, setStatus] = useState("Awaiting seed");
  const [querySource, setQuerySource] = useState<WikipediaLanguage>("en");
  const [layoutSettings, setLayoutSettings] = useState<ForceAtlas2Settings>(
    defaultLayoutSettings,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(true);
  const querySourceRef = useRef<WikipediaLanguage>(querySource);
  const initialLayoutSettingsRef = useRef(layoutSettings);
  const prevHasGraphRef = useRef(false);

  const hasGraph = nodeCount > 0;

  useEffect(() => {
    querySourceRef.current = querySource;
  }, [querySource]);

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
    if (!containerRef.current) return;
    graphRef.current = new GraphController({
      container: containerRef.current,
      initialLayoutSettings: initialLayoutSettingsRef.current,
      onExpand: async (title) => {
        setIsLoading(true);
        setError(null);
        setStatus(`Expanding ${title}`);
        try {
          const source = querySourceRef.current;
          const payload = await expandTitle(title, source);
          setStatus(`Expanded ${title}`);
          return payload;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Expansion failed";
          setError(message);
          setStatus("Expansion failed");
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load seed";
      setError(message);
    }
  };

  const handleReset = () => {
    graphRef.current?.reset();
    setStatus("Awaiting seed");
    setError(null);
    setNodeCount(0);
    setEdgeCount(0);
    setSpotlightOpen(true);
  };

  const graphActions = [
    {
      key: "fit",
      label: "Fit View",
      ariaLabel: "Fit graph to view",
      onClick: () => graphRef.current?.fitToGraph(),
      disabled: !hasGraph,
    },
    {
      key: "reset",
      label: "Reset",
      ariaLabel: "Reset graph",
      onClick: handleReset,
      disabled: !hasGraph,
    },
  ];

  return (
    <div className="app">
      <main className="canvas">
        <div className="graph-container" ref={containerRef} />
        <SpotlightBar
          open={spotlightOpen}
          hasGraph={hasGraph}
          seed={seed}
          querySource={querySource}
          isLoading={isLoading}
          onSeedChange={setSeed}
          onQuerySourceChange={setQuerySource}
          onSubmit={handleSubmit}
          onRequestClose={() => setSpotlightOpen(false)}
        />
        <div className="graph-actions">
          <button
            type="button"
            className="graph-actions__button graph-actions__button--icon"
            onClick={() => setSpotlightOpen(true)}
            aria-label="Open search"
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
          </button>
          {graphActions.map((action) => (
            <button
              key={action.key}
              type="button"
              className="graph-actions__button"
              onClick={action.onClick}
              aria-label={action.ariaLabel}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="status">
          <strong>Status</strong> · {status}
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
        <aside className="controls-panel">
          <div className="controls-panel__title">Layout Controls</div>
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
                  <span className="slider__value">{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
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
        </aside>
        {error ? <div className="error-banner">{error}</div> : null}
      </main>
    </div>
  );
}

export default App;
