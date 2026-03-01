import { useEffect, useRef, useState } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import {
  WIKIPEDIA_LANGUAGES,
  expandTitle,
  type WikipediaLanguage,
} from "./api";
import { GraphController } from "./graph";
import { layoutControls, defaultLayoutSettings } from "./layout-config";

type QuerySource = "server" | WikipediaLanguage;

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphController | null>(null);
  const hasAppliedInitialLayoutRef = useRef(false);
  const [seed, setSeed] = useState("Graph theory");
  const [status, setStatus] = useState("Awaiting seed");
  const [querySource, setQuerySource] = useState<QuerySource>("server");
  const [layoutSettings, setLayoutSettings] = useState<ForceAtlas2Settings>(
    defaultLayoutSettings,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const querySourceRef = useRef<QuerySource>(querySource);

  const hasGraph = nodeCount > 0;

  useEffect(() => {
    querySourceRef.current = querySource;
  }, [querySource]);

  useEffect(() => {
    if (!containerRef.current) return;
    graphRef.current = new GraphController({
      container: containerRef.current,
      initialLayoutSettings: layoutSettings,
      onExpand: async (title) => {
        setIsLoading(true);
        setError(null);
        setStatus(`Expanding ${title}`);
        try {
          const source = querySourceRef.current;
          const payload = await expandTitle(title, {
            backend: source === "server" ? "server" : "wikipedia",
            language: source === "server" ? "en" : source,
          });
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
        const source = querySourceRef.current;
        const language = source === "server" ? "en" : source;
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
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Wikipedia Graph Explorer</h1>
          <span>Expand nodes to reveal the knowledge web</span>
        </div>
        <form className="controls" onSubmit={handleSubmit}>
          <input
            type="text"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder="Seed article title"
          />
          <select
            value={querySource}
            onChange={(event) =>
              setQuerySource(event.target.value as QuerySource)
            }
            aria-label="Query source"
          >
            <option value="server">English (cached en.wikipedia.org)</option>
            {WIKIPEDIA_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label} ({language.code}.wikipedia.org)
              </option>
            ))}
          </select>
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Grow Graph"}
          </button>
          <button
            type="button"
            onClick={() => graphRef.current?.fitToGraph()}
            disabled={!hasGraph}
          >
            Fit View
          </button>
          <button type="button" onClick={handleReset} disabled={!hasGraph}>
            Reset
          </button>
        </form>
      </header>
      <main className="canvas">
        <div className="graph-container" ref={containerRef} />
        <div className="status">
          <strong>Status</strong> · {status}
        </div>
        <div className="node-count">
          <div>Nodes: {nodeCount}</div>
          <div>Edges: {edgeCount}</div>
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
