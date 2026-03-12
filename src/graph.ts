import Graph from "graphology";
import Sigma from "sigma";
import FA2 from "graphology-layout-forceatlas2/worker";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import type { ExpandEdge, ExpandResponse } from "./types";
import { defaultLayoutSettings } from "./layout-config";

const drawLabelWithBackground = (
  context: CanvasRenderingContext2D,
  data: {
    x: number;
    y: number;
    size: number;
    label?: string | null;
    labelColor?: string;
    labelBackground?: boolean;
    labelBackgroundColor?: string;
  },
  settings: {
    labelSize: number;
    labelFont: string;
    labelWeight: string;
    labelColor: { attribute?: string; color?: string } | { color: string };
  },
) => {
  if (!data.label) return;

  const { labelSize, labelFont, labelWeight } = settings;
  context.font = `${labelWeight} ${labelSize}px ${labelFont}`;

  const textWidth = context.measureText(data.label).width;
  const paddingX = 6;
  const paddingY = 3;
  const x = data.x + data.size + 3;
  const y = data.y - labelSize / 2 - paddingY;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = labelSize + paddingY * 2;

  if (data.labelBackground) {
    context.fillStyle =
      data.labelBackgroundColor ?? LABEL_BACKGROUND_HIGHLIGHTED_COLOR;
    context.beginPath();
    context.roundRect(x - paddingX, y, boxWidth, boxHeight, 6);
    context.fill();
  }

  const labelColor =
    "attribute" in settings.labelColor && settings.labelColor.attribute
      ? (() => {
          const value = (data as unknown as Record<string, unknown>)[
            settings.labelColor.attribute
          ];
          if (typeof value === "string") {
            return value;
          }
          return settings.labelColor.color ?? LABEL_COLOR_DEFAULT;
        })()
      : (settings.labelColor.color ?? LABEL_COLOR_DEFAULT);

  context.fillStyle = data.labelColor ?? labelColor;
  context.fillText(data.label, x, data.y + labelSize / 3);
};

type GraphNodeAttributes = {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  zIndex: number;
  expanded?: boolean;
};

type GraphEdgeAttributes = {
  color: string;
};

type GraphControllerOptions = {
  container: HTMLElement;
  onExpand: (title: string) => Promise<ExpandResponse>;
  resolveArticleUrl?: (title: string) => string;
  initialLayoutSettings?: ForceAtlas2Settings;
  onNodeCountChange?: (count: number) => void;
  onEdgeCountChange?: (count: number) => void;
};

const NODE_ALPHA = 0.9;
const NODE_COLOR = `rgba(86, 204, 242, ${NODE_ALPHA})`;
const EXPANDED_NODE_COLOR = `rgba(106, 46, 160, ${NODE_ALPHA})`;

const LABEL_COLOR_DEFAULT = "#e6edf5";
const LABEL_COLOR_HIGHLIGHTED = "#000000";
const LABEL_BACKGROUND_HIGHLIGHTED_COLOR = "#ffffff";
const EDGE_COLOR = "rgba(128, 140, 156, 0.4)";
const EDGE_COLOR_HIGHLIGHTED = "rgba(255, 255, 255, 0.35)";
const NODE_COLOR_DIMMED = "rgba(32, 46, 60, 0.9)";

const BASE_NODE_SIZE = 1;
const MAX_NODE_SIZE_BONUS = 35;
const NODE_SIZE_GROWTH_RATE = 8;
const NODE_COLOR_GROWTH_RATE = 6;
const UNEXPANDED_NODE_COOL_HUE = 198;
const UNEXPANDED_NODE_WARM_HUE = 32;

const degreeIntensity = (degree: number, growthRate: number): number =>
  1 - Math.exp(-degree / growthRate);

const hslToHex = (
  hue: number,
  saturation: number,
  lightness: number,
): string => {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hueSection = hue / 60;
  const x = chroma * (1 - Math.abs((hueSection % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection >= 0 && hueSection < 1) {
    red = chroma;
    green = x;
  } else if (hueSection < 2) {
    red = x;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = x;
  } else if (hueSection < 4) {
    green = x;
    blue = chroma;
  } else if (hueSection < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = l - chroma / 2;
  const toHex = (value: number): string =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const colorForUnexpandedDegree = (degree: number): string => {
  const intensity = degreeIntensity(
    Math.max(0, degree - 1),
    NODE_COLOR_GROWTH_RATE,
  );
  const hue =
    UNEXPANDED_NODE_COOL_HUE -
    (UNEXPANDED_NODE_COOL_HUE - UNEXPANDED_NODE_WARM_HUE) * intensity;
  const saturation = 76 + 14 * intensity;
  const lightness = 63 - 8 * intensity;

  return hexToRgba(hslToHex(hue, saturation, lightness), NODE_ALPHA);
};

const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export class GraphController {
  private graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes>();
  private sigma: Sigma;
  private layout: FA2;
  private layoutSettings: ForceAtlas2Settings;
  private onExpand: (title: string) => Promise<ExpandResponse>;
  private resolveArticleUrl: (title: string) => string;
  private onNodeCountChange?: (count: number) => void;
  private onEdgeCountChange?: (count: number) => void;
  private hoveredNode: string | null = null;
  private hoveredNeighbors: Set<string> | null = null;
  private pendingEdges = new Map<string, ExpandEdge>();
  private pendingEdgesByNode = new Map<string, Set<string>>();

  constructor(options: GraphControllerOptions) {
    this.sigma = new Sigma(this.graph, options.container, {
      renderLabels: true,
      labelDensity: 0.07,
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 8,
      zIndex: true,
      labelColor: { attribute: "labelColor", color: LABEL_COLOR_DEFAULT },
      labelRenderer: drawLabelWithBackground,
    });
    this.layoutSettings = {
      ...defaultLayoutSettings,
      ...options.initialLayoutSettings,
    };
    this.layout = new FA2(this.graph, {
      settings: this.layoutSettings,
    });
    this.onExpand = options.onExpand;
    this.resolveArticleUrl =
      options.resolveArticleUrl ??
      ((title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`);
    this.onNodeCountChange = options.onNodeCountChange;
    this.onEdgeCountChange = options.onEdgeCountChange;
    this.layout.start();

    this.setupNodeReducer();
    this.setupEdgeReducer();
    this.setupEventHandlers();
  }

  private setupNodeReducer() {
    this.sigma.setSetting("nodeReducer", (node, data) => {
      if (!this.hoveredNode) {
        return data;
      }

      const isHovered = node === this.hoveredNode;
      const isNeighbor = this.hoveredNeighbors?.has(node);

      if (isHovered) {
        return {
          ...data,
          color: NODE_COLOR,
          labelBackground: true,
          labelBackgroundColor: LABEL_BACKGROUND_HIGHLIGHTED_COLOR,
          labelColor: LABEL_COLOR_HIGHLIGHTED,
          zIndex: 1,
        };
      }

      if (isNeighbor) {
        return {
          ...data,
          color: NODE_COLOR,
          labelBackground: true,
          labelBackgroundColor: LABEL_BACKGROUND_HIGHLIGHTED_COLOR,
          labelColor: LABEL_COLOR_HIGHLIGHTED,
          zIndex: 0.5,
        };
      }

      return {
        ...data,
        color: NODE_COLOR_DIMMED,
        label: "",
        zIndex: 0,
      };
    });
  }

  private setupEdgeReducer() {
    this.sigma.setSetting("edgeReducer", (edge, data) => {
      if (!this.hoveredNode) {
        return data;
      }

      const source = this.graph.source(edge);
      const target = this.graph.target(edge);
      const isConnected =
        source === this.hoveredNode || target === this.hoveredNode;

      if (isConnected) {
        return {
          ...data,
          color: EDGE_COLOR_HIGHLIGHTED,
          zIndex: 1,
        };
      }

      return {
        ...data,
        hidden: true,
      };
    });
  }

  private setupEventHandlers() {
    this.sigma.on("clickNode", async ({ node }) => {
      const attrs = this.graph.getNodeAttributes(node);
      if (attrs.expanded) return;
      this.graph.setNodeAttribute(node, "expanded", true);
      await this.expandNode(attrs.label, node);
    });

    this.sigma.on("rightClickNode", async ({ node }) => {
      const attrs = this.graph.getNodeAttributes(node);
      const url = this.resolveArticleUrl(attrs.label);
      window.open(url, "_blank");
    });

    this.sigma.on("enterNode", ({ node }) => {
      this.hoveredNode = node;
      this.hoveredNeighbors = new Set(this.graph.neighbors(node));
      this.hoveredNeighbors.add(node);
      this.sigma.refresh();
    });

    this.sigma.on("leaveNode", () => {
      this.hoveredNode = null;
      this.hoveredNeighbors = null;
      this.sigma.refresh();
    });
  }

  destroy() {
    this.layout.kill();
    this.sigma.kill();
  }

  fitToGraph() {
    this.sigma.getCamera().animatedReset({ duration: 600 });
  }

  reset() {
    this.graph.clear();
    this.pendingEdges.clear();
    this.pendingEdgesByNode.clear();
    this.notifyCounts();
  }

  updateLayoutSettings(settings: ForceAtlas2Settings) {
    this.layoutSettings = { ...this.layoutSettings, ...settings };
    this.layout.kill();
    this.layout = new FA2(this.graph, { settings: this.layoutSettings });
    this.layout.start();
  }

  getLayoutSettings(): ForceAtlas2Settings {
    return { ...this.layoutSettings };
  }

  private notifyCounts() {
    this.onNodeCountChange?.(this.graph.order);
    this.onEdgeCountChange?.(this.graph.size);
  }

  async seed(title: string) {
    const payload = await this.onExpand(title);
    this.applyExpansion(payload, true);
  }

  private async expandNode(title: string, nodeId: string) {
    const payload = await this.onExpand(title);
    this.applyExpansion(payload, false, nodeId);
  }

  private ensureNode(
    id: string,
    label: string,
    color: string,
    size = BASE_NODE_SIZE,
  ) {
    if (this.graph.hasNode(id)) {
      return;
    }
    const center =
      this.graph.order > 0
        ? this.graph.getNodeAttributes(this.graph.nodes()[0])
        : null;
    const baseX = center?.x ?? 0;
    const baseY = center?.y ?? 0;
    this.graph.addNode(id, {
      label,
      x: baseX + randomBetween(-5, 5),
      y: baseY + randomBetween(-5, 5),
      size,
      color,
      zIndex: 0,
    });
  }

  private addEdge(source: string, target: string) {
    const edgeId = `${source}->${target}`;
    if (this.graph.hasEdge(edgeId)) {
      return;
    }
    this.graph.addEdgeWithKey(edgeId, source, target, {
      color: EDGE_COLOR,
    });
  }

  private edgeKey(fromNode: string, targetNode: string): string {
    return `${fromNode}->${targetNode}`;
  }

  private canAttachEdge(fromNode: string, targetNode: string): boolean {
    return this.graph.hasNode(fromNode) && this.graph.hasNode(targetNode);
  }

  private storePendingEdge(edge: ExpandEdge) {
    const key = this.edgeKey(edge.fromNode, edge.targetNode);
    if (this.graph.hasEdge(key) || this.pendingEdges.has(key)) {
      return;
    }

    this.pendingEdges.set(key, edge);

    [edge.fromNode, edge.targetNode].forEach((nodeId) => {
      const indexedEdges = this.pendingEdgesByNode.get(nodeId);
      if (indexedEdges) {
        indexedEdges.add(key);
        return;
      }
      this.pendingEdgesByNode.set(nodeId, new Set([key]));
    });
  }

  private removePendingEdge(edgeKey: string) {
    const edge = this.pendingEdges.get(edgeKey);
    if (!edge) {
      return;
    }

    this.pendingEdges.delete(edgeKey);
    [edge.fromNode, edge.targetNode].forEach((nodeId) => {
      const indexedEdges = this.pendingEdgesByNode.get(nodeId);
      if (!indexedEdges) {
        return;
      }
      indexedEdges.delete(edgeKey);
      if (indexedEdges.size === 0) {
        this.pendingEdgesByNode.delete(nodeId);
      }
    });
  }

  private tryAttachPendingForNodes(nodeIds: Iterable<string>) {
    const candidateEdgeKeys = new Set<string>();

    for (const nodeId of nodeIds) {
      const indexedEdges = this.pendingEdgesByNode.get(nodeId);
      if (!indexedEdges) {
        continue;
      }
      indexedEdges.forEach((edgeKey) => {
        candidateEdgeKeys.add(edgeKey);
      });
    }

    candidateEdgeKeys.forEach((edgeKey) => {
      const edge = this.pendingEdges.get(edgeKey);
      if (!edge) {
        return;
      }

      if (this.graph.hasEdge(edgeKey)) {
        this.removePendingEdge(edgeKey);
        return;
      }

      if (!this.canAttachEdge(edge.fromNode, edge.targetNode)) {
        return;
      }

      this.addEdge(edge.fromNode, edge.targetNode);
      this.updateNodeSize(edge.fromNode);
      this.updateNodeSize(edge.targetNode);
      this.removePendingEdge(edgeKey);
    });
  }

  private updateNodeSize(nodeId: string) {
    const degree = this.graph.degree(nodeId);
    const sizeIntensity = degreeIntensity(degree, NODE_SIZE_GROWTH_RATE);
    const size = BASE_NODE_SIZE + MAX_NODE_SIZE_BONUS * sizeIntensity;
    const isExpanded = this.graph.getNodeAttribute(nodeId, "expanded");

    this.graph.setNodeAttribute(nodeId, "size", size);
    this.graph.setNodeAttribute(nodeId, "zIndex", degree);
    this.graph.setNodeAttribute(
      nodeId,
      "color",
      isExpanded ? EXPANDED_NODE_COLOR : colorForUnexpandedDegree(degree),
    );
  }

  private applyExpansion(
    payload: ExpandResponse,
    isSeed: boolean,
    centerNodeId?: string,
  ) {
    const newNodes = payload.newNodes;
    const centerId = centerNodeId ?? payload.newNodes[0];

    const newlyAddedNodes = new Set<string>();
    newNodes.forEach((title) => {
      if (!this.graph.hasNode(title)) {
        newlyAddedNodes.add(title);
      }
      this.ensureNode(title, title, NODE_COLOR);
    });

    if (!isSeed && centerNodeId) {
      const centerAttrs = this.graph.getNodeAttributes(centerId);
      newNodes.slice(1).forEach((title) => {
        if (newlyAddedNodes.has(title)) {
          this.graph.setNodeAttribute(
            title,
            "x",
            centerAttrs.x + randomBetween(-4, 4),
          );
          this.graph.setNodeAttribute(
            title,
            "y",
            centerAttrs.y + randomBetween(-4, 4),
          );
        }
      });
    }

    this.graph.setNodeAttribute(centerId, "expanded", true);
    this.graph.setNodeAttribute(centerId, "color", EXPANDED_NODE_COLOR);

    payload.newEdges.forEach((edge) => {
      const edgeKey = this.edgeKey(edge.fromNode, edge.targetNode);

      if (this.graph.hasEdge(edgeKey)) {
        this.removePendingEdge(edgeKey);
        return;
      }

      if (!this.canAttachEdge(edge.fromNode, edge.targetNode)) {
        this.storePendingEdge(edge);
        return;
      }

      this.addEdge(edge.fromNode, edge.targetNode);
      this.updateNodeSize(edge.fromNode);
      this.updateNodeSize(edge.targetNode);
    });

    this.tryAttachPendingForNodes(newNodes);

    this.updateNodeSize(centerId);
    this.notifyCounts();
  }
}
