import { create } from "zustand";
import type { ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import type { WikipediaLanguage } from "../api";
import { defaultLayoutSettings } from "../layout-config";

type ToastState = {
  status: string;
  error: string | null;
  visible: boolean;
  fading: boolean;
};

type SelectedNodeState = {
  nodeId: string;
  title: string;
  expanded: boolean;
};

type AppStore = {
  seed: string;
  querySource: WikipediaLanguage;
  spotlightOpen: boolean;
  controlsOpen: boolean;
  isAudioMuted: boolean;
  layoutSettings: ForceAtlas2Settings;
  isPaused: boolean;
  isLoading: boolean;
  nodeCount: number;
  edgeCount: number;
  selectedNode: SelectedNodeState | null;
  toast: ToastState;
  setSeed: (seed: string) => void;
  setQuerySource: (querySource: WikipediaLanguage) => void;
  openSpotlight: () => void;
  closeSpotlight: () => void;
  setSpotlightOpen: (open: boolean) => void;
  openControls: () => void;
  closeControls: () => void;
  setControlsOpen: (open: boolean) => void;
  toggleControls: () => void;
  toggleAudioMuted: () => void;
  setLayoutBoolean: (key: keyof ForceAtlas2Settings, value: boolean) => void;
  setLayoutNumber: (key: keyof ForceAtlas2Settings, value: number) => void;
  resetLayoutSettings: () => void;
  setIsPaused: (isPaused: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setNodeCount: (nodeCount: number) => void;
  setEdgeCount: (edgeCount: number) => void;
  setSelectedNode: (selectedNode: SelectedNodeState | null) => void;
  showToast: (message: string, error?: string | null) => void;
  setToastFading: (fading: boolean) => void;
  clearToast: () => void;
};

const initialToastState: ToastState = {
  status: "",
  error: null,
  visible: false,
  fading: false,
};

export const useAppStore = create<AppStore>((set) => ({
  seed: "",
  querySource: "en",
  spotlightOpen: true,
  controlsOpen: false,
  isAudioMuted: false,
  layoutSettings: { ...defaultLayoutSettings },
  isPaused: false,
  isLoading: false,
  nodeCount: 0,
  edgeCount: 0,
  selectedNode: null,
  toast: initialToastState,
  setSeed: (seed) => set({ seed }),
  setQuerySource: (querySource) => set({ querySource }),
  openSpotlight: () => set({ spotlightOpen: true }),
  closeSpotlight: () => set({ spotlightOpen: false }),
  setSpotlightOpen: (spotlightOpen) => set({ spotlightOpen }),
  openControls: () => set({ controlsOpen: true }),
  closeControls: () => set({ controlsOpen: false }),
  setControlsOpen: (controlsOpen) => set({ controlsOpen }),
  toggleControls: () => set((state) => ({ controlsOpen: !state.controlsOpen })),
  toggleAudioMuted: () =>
    set((state) => ({ isAudioMuted: !state.isAudioMuted })),
  setLayoutBoolean: (key, value) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, [key]: value },
    })),
  setLayoutNumber: (key, value) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, [key]: value },
    })),
  resetLayoutSettings: () =>
    set({
      layoutSettings: { ...defaultLayoutSettings },
      isPaused: false,
    }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setNodeCount: (nodeCount) => set({ nodeCount }),
  setEdgeCount: (edgeCount) => set({ edgeCount }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  showToast: (message, error = null) =>
    set({
      toast: {
        status: message,
        error,
        visible: true,
        fading: false,
      },
    }),
  setToastFading: (fading) =>
    set((state) => ({
      toast: {
        ...state.toast,
        visible: true,
        fading,
      },
    })),
  clearToast: () => set({ toast: initialToastState }),
}));

export type { ToastState };
