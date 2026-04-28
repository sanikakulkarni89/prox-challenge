"use client";

import { useRef, useEffect, useCallback } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import type { WiringNode, WiringEdge } from "@/store/diagramStore";

// ─── Visual config ────────────────────────────────────────────────────────────

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  welder:      { w: 152, h: 56 },
  wire_feeder: { w: 130, h: 48 },
  socket:      { w: 64,  h: 32 },
};
const DEFAULT_SIZE = { w: 112, h: 42 };

const NODE_COLORS: Record<string, { stroke: string; fill: string; text: string }> = {
  welder:           { stroke: "#f97316", fill: "#1c0f04", text: "#fb923c" },
  torch:            { stroke: "#3b82f6", fill: "#030c1f", text: "#60a5fa" },
  electrode_holder: { stroke: "#ef4444", fill: "#1f0303", text: "#f87171" },
  ground_clamp:     { stroke: "#22c55e", fill: "#021a08", text: "#4ade80" },
  workpiece:        { stroke: "#52525b", fill: "#111113", text: "#a1a1aa" },
  wire_feeder:      { stroke: "#f97316", fill: "#1c0f04", text: "#fb923c" },
  gas_cylinder:     { stroke: "#0ea5e9", fill: "#020e17", text: "#38bdf8" },
  socket:           { stroke: "#d4d4d8", fill: "#1c1c1e", text: "#e4e4e7" },
};
const DEFAULT_NODE_COLOR = { stroke: "#52525b", fill: "#111113", text: "#a1a1aa" };

const EDGE_COLORS: Record<string, string> = {
  positive: "#ef4444",
  negative: "#3b82f6",
  ground:   "#22c55e",
  gas:      "#0ea5e9",
  control:  "#a855f7",
};

function sizeOf(type: string) {
  return NODE_SIZES[type] ?? DEFAULT_SIZE;
}
function colorOf(type: string) {
  return NODE_COLORS[type] ?? DEFAULT_NODE_COLOR;
}
function centerOf(node: WiringNode) {
  const s = sizeOf(node.type);
  return { x: node.x + s.w / 2, y: node.y + s.h / 2 };
}
function edgeStroke(edge: WiringEdge): string {
  if (edge.color) return edge.color as string;
  return EDGE_COLORS[edge.polarity ?? ""] ?? "#6b7280";
}
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}
function doExport(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wiring-diagram-${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUndo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-4"/>
    </svg>
  );
}
function IconRedo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-.49-4"/>
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  diagramId: string;
  onClose: () => void;
}

export default function WiringDiagramRenderer({ diagramId, onClose }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const diagram   = useDiagramStore((s) => s.diagrams[diagramId]);
  const anims     = useDiagramStore((s) => s.animations[diagramId]);
  const histLen   = useDiagramStore((s) => s.history[diagramId]?.length ?? 0);
  const futLen    = useDiagramStore((s) => s.future[diagramId]?.length ?? 0);
  const undo      = useDiagramStore((s) => s.undo);
  const redo      = useDiagramStore((s) => s.redo);

  const canUndo = histLen > 0;
  const canRedo = futLen > 0;

  // Keyboard shortcuts — only active while this renderer is mounted
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo(diagramId);
      } else if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo(diagramId);
      }
    },
    [diagramId, canUndo, canRedo, undo, redo]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!diagram) return null;

  const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex flex-col h-full artifact-new">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {diagram.polarity && (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 flex-shrink-0">
              {diagram.polarity}
            </span>
          )}
          <p className="text-orange-400 text-xs uppercase tracking-wider font-medium flex-shrink-0">
            wiring diagram
          </p>
          <p className="text-zinc-200 text-sm font-semibold truncate">{diagram.title}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Undo / Redo group */}
          <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden">
            <button
              onClick={() => undo(diagramId)}
              disabled={!canUndo}
              title={`Undo (${histLen}) — ⌘Z`}
              className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconUndo />
            </button>
            <div className="w-px h-4 bg-zinc-700" />
            <button
              onClick={() => redo(diagramId)}
              disabled={!canRedo}
              title={`Redo (${futLen}) — ⌘⇧Z`}
              className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <IconRedo />
            </button>
          </div>

          {/* Export */}
          <button
            onClick={() => svgRef.current && doExport(svgRef.current)}
            title="Export as SVG"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-orange-500/40 text-xs text-zinc-400 hover:text-orange-400 transition-colors"
          >
            <IconDownload />
            SVG
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Close diagram"
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* ── SVG Canvas ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-zinc-950">
        <svg
          ref={svgRef}
          viewBox="0 0 820 620"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", minHeight: "100%", display: "block", background: "#0a0a0a" }}
        >
          <defs>
            {/* Inline animation styles so they survive SVG export */}
            <style>{`
              .diagram-node-entering { animation: diagramFadeIn 300ms ease forwards; }
              .diagram-node-exiting  { animation: diagramFadeOut 300ms ease forwards; }
              @keyframes diagramFadeIn  { from { opacity: 0; } to { opacity: 1; } }
              @keyframes diagramFadeOut { from { opacity: 1; } to { opacity: 0; } }
            `}</style>

            {/* Arrowhead per edge polarity */}
            {Object.entries(EDGE_COLORS).map(([pol, col]) => (
              <marker key={pol} id={`ah-${pol}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill={col} />
              </marker>
            ))}
            <marker id="ah-default" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#6b7280" />
            </marker>

            {/* Subtle dot grid */}
            <pattern id="wgrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.5" fill="#222" />
            </pattern>
          </defs>

          <rect width="820" height="620" fill="url(#wgrid)" />

          {/* ── Edges (drawn first, behind nodes) ── */}
          {diagram.edges.map((edge) => {
            const s = nodeMap.get(edge.source);
            const t = nodeMap.get(edge.target);
            if (!s || !t) return null;
            const sc = centerOf(s);
            const tc = centerOf(t);
            const col = edgeStroke(edge);
            const markerId =
              edge.polarity && EDGE_COLORS[edge.polarity]
                ? `ah-${edge.polarity}`
                : "ah-default";
            return (
              <g key={edge.id}>
                <path
                  d={bezierPath(sc.x, sc.y, tc.x, tc.y)}
                  fill="none"
                  stroke={col}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                  opacity="0.8"
                />
                {edge.label && (
                  <text
                    x={(sc.x + tc.x) / 2}
                    y={(sc.y + tc.y) / 2 - 7}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {diagram.nodes.map((node) => {
            const { w, h } = sizeOf(node.type);
            const col = colorOf(node.type);
            const isEntering = anims?.entering.includes(node.id) ?? false;
            const isExiting  = anims?.exiting.includes(node.id)  ?? false;
            const isWelder   = node.type === "welder";

            return (
              <g
                key={node.id}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: "transform 300ms ease",
                }}
              >
                {/* Inner group carries the enter/exit animation */}
                <g className={isEntering ? "diagram-node-entering" : isExiting ? "diagram-node-exiting" : undefined}>
                  <rect
                    x={0} y={0}
                    width={w} height={h}
                    rx={7}
                    fill={col.fill}
                    stroke={col.stroke}
                    strokeWidth={isWelder ? 2 : 1.5}
                  />
                  {/* Type sub-label — hidden for sockets to save space */}
                  {node.type !== "socket" && (
                    <text
                      x={w / 2} y={13}
                      textAnchor="middle"
                      fill={col.text}
                      fontSize="8"
                      opacity="0.6"
                      fontFamily="system-ui, sans-serif"
                    >
                      {node.type.replace(/_/g, " ").toUpperCase()}
                    </text>
                  )}
                  {/* Primary label */}
                  <text
                    x={w / 2}
                    y={node.type === "socket" ? h / 2 + 5 : h / 2 + 7}
                    textAnchor="middle"
                    fill="#e4e4e7"
                    fontSize={isWelder ? "13" : "11"}
                    fontWeight={isWelder ? "600" : "400"}
                    fontFamily="system-ui, sans-serif"
                  >
                    {node.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Polarity badge — bottom-left so it doesn't overlap nodes */}
          {diagram.polarity && (
            <g transform="translate(10, 590)">
              <rect y={-20} rx="5" width="58" height="22" fill="#1c0f04" stroke="#f97316" strokeWidth="1.5" />
              <text x="29" y={-4} textAnchor="middle" fill="#f97316" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
                {diagram.polarity}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── History status bar ── */}
      {(canUndo || canRedo) && (
        <div className="px-4 py-1 border-t border-zinc-900 flex gap-3 text-xs text-zinc-700 flex-shrink-0">
          {canUndo && (
            <span>
              {histLen} step{histLen !== 1 ? "s" : ""} to undo
            </span>
          )}
          {canRedo && (
            <span>
              {futLen} step{futLen !== 1 ? "s" : ""} to redo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
