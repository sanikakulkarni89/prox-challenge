import { create } from "zustand";

export interface WiringNode {
  id: string;
  label: string;
  type:
    | "welder"
    | "torch"
    | "electrode_holder"
    | "ground_clamp"
    | "workpiece"
    | "wire_feeder"
    | "gas_cylinder"
    | "socket";
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface WiringEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  polarity?: "positive" | "negative" | "ground" | "gas" | "control";
  [key: string]: unknown;
}

export interface WiringDiagram {
  id: string;
  title: string;
  polarity?: "DCEP" | "DCEN" | "AC";
  nodes: WiringNode[];
  edges: WiringEdge[];
}

export interface EdgePatch extends Partial<Omit<WiringEdge, "id">> {
  id: string;
}

export interface NodeMove {
  id: string;
  x: number;
  y: number;
}

export interface DiagramPatch {
  diagramId: string;
  addNodes?: WiringNode[];
  removeNodeIds?: string[];
  updateEdges?: EdgePatch[];
  moveNodes?: NodeMove[];
}

export interface NodeAnimationState {
  entering: string[];
  exiting: string[];
  moving: string[];
}

const ANIM_MS = 300;
const HISTORY_MAX = 20;

interface DiagramStore {
  diagrams: Record<string, WiringDiagram>;
  animations: Record<string, NodeAnimationState>;
  history: Record<string, WiringDiagram[]>;
  future: Record<string, WiringDiagram[]>;
  activeDiagramId: string | null;
  setDiagram: (diagram: WiringDiagram) => void;
  setActiveDiagramId: (id: string | null) => void;
  updateDiagram: (id: string, patches: Partial<Omit<WiringDiagram, "id">>) => void;
  addNode: (id: string, node: WiringNode) => void;
  removeNode: (id: string, nodeId: string) => void;
  moveNode: (id: string, nodeId: string, x: number, y: number) => void;
  updateEdge: (id: string, edgeId: string, patches: Partial<Omit<WiringEdge, "id">>) => void;
  applyDiagramPatch: (patch: DiagramPatch) => void;
  undo: (diagramId: string) => void;
  redo: (diagramId: string) => void;
}

export const useDiagramStore = create<DiagramStore>()((set) => ({
  diagrams: {},
  animations: {},
  history: {},
  future: {},
  activeDiagramId: null,

  setDiagram: (diagram) =>
    set((state) => ({
      diagrams: { ...state.diagrams, [diagram.id]: diagram },
    })),

  setActiveDiagramId: (id) => set({ activeDiagramId: id }),

  updateDiagram: (id, patches) =>
    set((state) => {
      if (!state.diagrams[id]) return state;
      return {
        diagrams: {
          ...state.diagrams,
          [id]: { ...state.diagrams[id], ...patches },
        },
      };
    }),

  addNode: (id, node) =>
    set((state) => {
      if (!state.diagrams[id]) return state;
      return {
        diagrams: {
          ...state.diagrams,
          [id]: {
            ...state.diagrams[id],
            nodes: [...state.diagrams[id].nodes, node],
          },
        },
      };
    }),

  removeNode: (id, nodeId) =>
    set((state) => {
      if (!state.diagrams[id]) return state;
      return {
        diagrams: {
          ...state.diagrams,
          [id]: {
            ...state.diagrams[id],
            nodes: state.diagrams[id].nodes.filter((n) => n.id !== nodeId),
          },
        },
      };
    }),

  moveNode: (id, nodeId, x, y) =>
    set((state) => {
      if (!state.diagrams[id]) return state;
      return {
        diagrams: {
          ...state.diagrams,
          [id]: {
            ...state.diagrams[id],
            nodes: state.diagrams[id].nodes.map((n) =>
              n.id === nodeId ? { ...n, x, y } : n
            ),
          },
        },
      };
    }),

  updateEdge: (id, edgeId, patches) =>
    set((state) => {
      if (!state.diagrams[id]) return state;
      return {
        diagrams: {
          ...state.diagrams,
          [id]: {
            ...state.diagrams[id],
            edges: state.diagrams[id].edges.map((e) =>
              e.id === edgeId ? { ...e, ...patches } : e
            ),
          },
        },
      };
    }),

  applyDiagramPatch: (patch) => {
    const {
      diagramId,
      addNodes = [],
      removeNodeIds = [],
      updateEdges = [],
      moveNodes = [],
    } = patch;

    // Phase 1: snapshot current state, then apply all changes atomically.
    // Exiting nodes stay in the nodes array during the animation window.
    set((state) => {
      if (!state.diagrams[diagramId]) return state;
      const diagram = state.diagrams[diagramId];

      // Snapshot before mutation — shallow copy of nodes/edges arrays is enough
      // since individual node/edge objects are replaced on update, never mutated.
      const snapshot: WiringDiagram = {
        ...diagram,
        nodes: diagram.nodes.slice(),
        edges: diagram.edges.slice(),
      };
      const prevHistory = state.history[diagramId] ?? [];
      const newHistory = prevHistory.concat(snapshot).slice(-HISTORY_MAX);

      const movedIds = moveNodes.map((m) => m.id);
      const addedIds = addNodes.map((n) => n.id);

      const nodes = [
        ...diagram.nodes.map((n) => {
          const move = moveNodes.find((m) => m.id === n.id);
          return move ? { ...n, x: move.x, y: move.y } : n;
        }),
        ...addNodes,
      ];

      const edges = diagram.edges.map((e) => {
        const ep = updateEdges.find((p) => p.id === e.id);
        return ep ? { ...e, ...ep } : e;
      });

      const prev = state.animations[diagramId] ?? {
        entering: [],
        exiting: [],
        moving: [],
      };

      const dedupe = (arr: string[]) => arr.filter((v, i) => arr.indexOf(v) === i);

      return {
        diagrams: { ...state.diagrams, [diagramId]: { ...diagram, nodes, edges } },
        history: { ...state.history, [diagramId]: newHistory },
        future: { ...state.future, [diagramId]: [] },
        animations: {
          ...state.animations,
          [diagramId]: {
            entering: dedupe(prev.entering.concat(addedIds)),
            exiting: dedupe(prev.exiting.concat(removeNodeIds)),
            moving: dedupe(prev.moving.concat(movedIds)),
          },
        },
      };
    });

    // Phase 2: after the animation, remove exiting nodes and clear all flags.
    setTimeout(() => {
      set((state) => {
        if (!state.diagrams[diagramId]) return state;
        return {
          diagrams: {
            ...state.diagrams,
            [diagramId]: {
              ...state.diagrams[diagramId],
              nodes: state.diagrams[diagramId].nodes.filter(
                (n) => !removeNodeIds.includes(n.id)
              ),
            },
          },
          animations: {
            ...state.animations,
            [diagramId]: { entering: [], exiting: [], moving: [] },
          },
        };
      });
    }, ANIM_MS);
  },

  undo: (diagramId) =>
    set((state) => {
      const hist = state.history[diagramId];
      if (!hist || hist.length === 0) return state;
      const previous = hist[hist.length - 1];
      const current = state.diagrams[diagramId];
      if (!current) return state;
      const prevFuture = state.future[diagramId] ?? [];
      return {
        diagrams: { ...state.diagrams, [diagramId]: previous },
        history: { ...state.history, [diagramId]: hist.slice(0, -1) },
        future: {
          ...state.future,
          [diagramId]: prevFuture.concat(current).slice(-HISTORY_MAX),
        },
        animations: { ...state.animations, [diagramId]: { entering: [], exiting: [], moving: [] } },
      };
    }),

  redo: (diagramId) =>
    set((state) => {
      const fut = state.future[diagramId];
      if (!fut || fut.length === 0) return state;
      const next = fut[fut.length - 1];
      const current = state.diagrams[diagramId];
      if (!current) return state;
      const prevHistory = state.history[diagramId] ?? [];
      return {
        diagrams: { ...state.diagrams, [diagramId]: next },
        history: {
          ...state.history,
          [diagramId]: prevHistory.concat(current).slice(-HISTORY_MAX),
        },
        future: { ...state.future, [diagramId]: fut.slice(0, -1) },
        animations: { ...state.animations, [diagramId]: { entering: [], exiting: [], moving: [] } },
      };
    }),
}));
