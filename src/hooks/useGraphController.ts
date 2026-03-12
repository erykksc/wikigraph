import { useCallback, useEffect, useRef } from "react";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import { expandTitle, type WikipediaLanguage } from "../api";
import { GraphController } from "../graph";
import { useAppStore } from "../store/useAppStore";

type UseGraphControllerParams = {
  querySource: WikipediaLanguage;
  initialLayoutSettings: ForceAtlas2Settings;
  onShowStatus: (message: string, nextError?: string | null) => void;
  onFadeStatus: () => void;
  onClearStatus: () => void;
  onExpansionTriggered?: () => void;
};

export function useGraphController({
  querySource,
  initialLayoutSettings,
  onShowStatus,
  onFadeStatus,
  onClearStatus,
  onExpansionTriggered,
}: UseGraphControllerParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphController | null>(null);
  const querySourceRef = useRef<WikipediaLanguage>(querySource);
  const initialLayoutSettingsRef = useRef(initialLayoutSettings);
  const showStatusRef = useRef(onShowStatus);
  const fadeStatusRef = useRef(onFadeStatus);
  const clearStatusRef = useRef(onClearStatus);
  const expansionTriggeredRef = useRef(onExpansionTriggered);
  const isLoading = useAppStore((state) => state.isLoading);
  const nodeCount = useAppStore((state) => state.nodeCount);
  const edgeCount = useAppStore((state) => state.edgeCount);
  const setIsLoading = useAppStore((state) => state.setIsLoading);
  const setNodeCount = useAppStore((state) => state.setNodeCount);
  const setEdgeCount = useAppStore((state) => state.setEdgeCount);

  useEffect(() => {
    querySourceRef.current = querySource;
  }, [querySource]);

  useEffect(() => {
    showStatusRef.current = onShowStatus;
  }, [onShowStatus]);

  useEffect(() => {
    fadeStatusRef.current = onFadeStatus;
  }, [onFadeStatus]);

  useEffect(() => {
    clearStatusRef.current = onClearStatus;
  }, [onClearStatus]);

  useEffect(() => {
    expansionTriggeredRef.current = onExpansionTriggered;
  }, [onExpansionTriggered]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    graphRef.current = new GraphController({
      container: containerRef.current,
      initialLayoutSettings: initialLayoutSettingsRef.current,
      onExpand: async (title) => {
        expansionTriggeredRef.current?.();
        setIsLoading(true);
        showStatusRef.current(`Expanding ${title}`);

        try {
          const payload = await expandTitle(title, querySourceRef.current);
          showStatusRef.current(`Expanded ${title}`);
          fadeStatusRef.current();
          return payload;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Expansion failed";
          showStatusRef.current(message, message);
          fadeStatusRef.current();
          throw error;
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
  }, [setEdgeCount, setIsLoading, setNodeCount]);

  const seedGraph = useCallback(async (title: string) => {
    if (!graphRef.current) {
      return;
    }

    await graphRef.current.seed(title);
  }, []);

  const resetGraph = useCallback(() => {
    graphRef.current?.reset();
    clearStatusRef.current();
    setNodeCount(0);
    setEdgeCount(0);
  }, [setEdgeCount, setNodeCount]);

  const fitGraph = useCallback(() => {
    graphRef.current?.fitToGraph();
  }, []);

  return {
    containerRef,
    graphRef,
    isLoading,
    nodeCount,
    edgeCount,
    hasGraph: nodeCount > 0,
    seedGraph,
    resetGraph,
    fitGraph,
  };
}
