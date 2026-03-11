import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";

export type SettingControl = {
  key: keyof ForceAtlas2Settings;
  label: string;
  type: "boolean" | "number";
  min?: number;
  max?: number;
  step?: number;
  description: string;
};

export const layoutControls: SettingControl[] = [
  {
    key: "adjustSizes",
    label: "Adjust Sizes",
    type: "boolean",
    description: "Account for node sizes in layout forces.",
  },
  {
    key: "barnesHutOptimize",
    label: "Barnes-Hut Optimize",
    type: "boolean",
    description:
      "Use Barnes-Hut approximation for faster repulsion (O(n log n)).",
  },
  {
    key: "barnesHutTheta",
    label: "Barnes-Hut Theta",
    type: "number",
    min: 0.1,
    max: 1.2,
    step: 0.05,
    description: "Barnes-Hut accuracy parameter (lower is more accurate).",
  },
  {
    key: "edgeWeightInfluence",
    label: "Edge Weight Influence",
    type: "number",
    min: 0,
    max: 3,
    step: 0.1,
    description: "How much edge weights affect attraction strength.",
  },
  {
    key: "gravity",
    label: "Gravity",
    type: "number",
    min: 0,
    max: 5,
    step: 0.1,
    description: "Pulls nodes toward the center of the layout.",
  },
  {
    key: "linLogMode",
    label: "LinLog Mode",
    type: "boolean",
    description: "Use LinLog energy model for clustering.",
  },
  {
    key: "outboundAttractionDistribution",
    label: "Outbound Attraction",
    type: "boolean",
    description: "Distribute attraction along outbound edges.",
  },
  {
    key: "scalingRatio",
    label: "Scaling Ratio",
    type: "number",
    min: 0.1,
    max: 8,
    step: 0.1,
    description: "Strength of repulsion between nodes.",
  },
  {
    key: "slowDown",
    label: "Slow Down",
    type: "number",
    min: 0.01,
    max: 10,
    step: 0.01,
    description: "Dampens movement for more stable layouts.",
  },
  {
    key: "strongGravityMode",
    label: "Strong Gravity",
    type: "boolean",
    description: "Use a stronger gravity model to keep clusters tighter.",
  },
];

export const defaultLayoutSettings: ForceAtlas2Settings = {
  adjustSizes: true,
  barnesHutOptimize: true,
  barnesHutTheta: 0.5,
  edgeWeightInfluence: 1,
  gravity: 1,
  linLogMode: false,
  outboundAttractionDistribution: true,
  scalingRatio: 1,
  slowDown: 1,
  strongGravityMode: false,
};
