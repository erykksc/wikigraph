import Graph from "graphology";
import Sigma from "sigma";
import FA2 from "graphology-layout-forceatlas2/worker";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import type { ExpandResponse } from "@wikipedia-graph/shared";

type GraphNodeAttributes = {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  expanded?: boolean;
};

type GraphEdgeAttributes = {
  color: string;
};

type GraphControllerOptions = {
  container: HTMLElement;
  onExpand: (title: string) => Promise<ExpandResponse>;
};

const NODE_COLOR = "#56ccf2";

const BASE_NODE_SIZE = 4;
const SIZE_SCALE = 1.4;

const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export class GraphController {
  private graph = new Graph<GraphNodeAttributes, GraphEdgeAttributes>();
  private sigma: Sigma;
  private layout: FA2;
  private layoutSettings: ForceAtlas2Settings;
  private onExpand: (title: string) => Promise<ExpandResponse>;

  constructor(options: GraphControllerOptions) {
    this.sigma = new Sigma(this.graph, options.container, {
      renderLabels: true,
      labelDensity: 0.07,
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 8,
      zIndex: true,
    });
    this.layoutSettings = {
      adjustSizes: true,
      outboundAttractionDistribution: true,
      slowDown: 100,
      gravity: 0,
    };
    this.layout = new FA2(this.graph, {
      settings: this.layoutSettings,
    });
    this.onExpand = options.onExpand;
    this.layout.start();

    this.sigma.on("clickNode", async ({ node }) => {
      const attrs = this.graph.getNodeAttributes(node);
      if (attrs.expanded) return;
      this.graph.setNodeAttribute(node, "expanded", true);
      await this.expandNode(attrs.label, node);
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
    });
  }

  private addEdge(source: string, target: string) {
    const edgeId = `${source}->${target}`;
    if (this.graph.hasEdge(edgeId)) {
      return;
    }
    this.graph.addEdgeWithKey(edgeId, source, target, {
      color: "rgba(255,255,255,0.15)",
    });
  }

  private updateNodeSize(nodeId: string) {
    const degree = this.graph.degree(nodeId);
    const size = BASE_NODE_SIZE + Math.sqrt(degree) * SIZE_SCALE;
    this.graph.setNodeAttribute(nodeId, "size", size);
  }

  private applyExpansion(
    payload: ExpandResponse,
    isSeed: boolean,
    centerNodeId?: string,
  ) {
    const nodeId = payload.node.title;
    const label = payload.node.title;
    const centerId = centerNodeId ?? nodeId;

    this.ensureNode(nodeId, label, NODE_COLOR, BASE_NODE_SIZE + 4);
    this.graph.setNodeAttribute(nodeId, "expanded", true);

    const centerAttrs = this.graph.getNodeAttributes(centerId);

    payload.outlinks.forEach((title) => {
      const id = title;
      this.ensureNode(id, title, NODE_COLOR);
      this.graph.setNodeAttribute(
        id,
        "x",
        centerAttrs.x + randomBetween(-4, 4),
      );
      this.graph.setNodeAttribute(
        id,
        "y",
        centerAttrs.y + randomBetween(-4, 4),
      );
      this.addEdge(centerId, id);
      this.addEdge(id, centerId);
      this.updateNodeSize(id);
    });

    payload.inlinks.forEach((title) => {
      const id = title;
      this.ensureNode(id, title, NODE_COLOR);
      this.graph.setNodeAttribute(
        id,
        "x",
        centerAttrs.x + randomBetween(-4, 4),
      );
      this.graph.setNodeAttribute(
        id,
        "y",
        centerAttrs.y + randomBetween(-4, 4),
      );
      this.addEdge(id, centerId);
      this.addEdge(centerId, id);
      this.updateNodeSize(id);
    });

    this.updateNodeSize(centerId);
  }
}
