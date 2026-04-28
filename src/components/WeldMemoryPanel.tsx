"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosisEntry {
  id: string;
  defect_type: string;
  parameters: Record<string, unknown>;
  outcome: string | null;
  created_at: string;
}

type OutcomeStatus = "success" | "defect" | "unknown";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(outcome: string | null): OutcomeStatus {
  if (!outcome?.trim()) return "unknown";
  const lower = outcome.toLowerCase();
  if (/good|success|clean|pass|acceptable|fixed|resolved|correct/.test(lower))
    return "success";
  return "defect";
}

const STATUS_CONFIG: Record<
  OutcomeStatus,
  { pill: string; dot: string; label: string }
> = {
  success: {
    pill: "bg-green-500/10 text-green-400 border border-green-500/25",
    dot: "bg-green-500",
    label: "Good",
  },
  defect: {
    pill: "bg-red-500/10 text-red-400 border border-red-500/25",
    dot: "bg-red-500",
    label: "Defect",
  },
  unknown: {
    pill: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/25",
    dot: "bg-yellow-500",
    label: "Unknown",
  },
};

function strParam(params: Record<string, unknown>, key: string): string | null {
  const val = params[key];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function numParam(
  params: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const val = params[key];
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim()) {
      const n = parseFloat(val);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildResumeMessage(entry: DiagnosisEntry): string {
  const date = formatDate(entry.created_at);
  const material =
    strParam(entry.parameters, "material") ?? "unknown material";
  const process =
    strParam(entry.parameters, "process") ?? entry.defect_type ?? "same process";
  const amps = numParam(entry.parameters, "voltage", "amperage");
  const ampsStr = amps != null ? `${amps}A` : "same settings";
  return `I'm working with the same setup as ${date} — ${material}, ${process}, ${ampsStr}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function EntryCard({
  entry,
  onResume,
}: {
  entry: DiagnosisEntry;
  onResume: () => void;
}) {
  const status = getStatus(entry.outcome);
  const { pill, label } = STATUS_CONFIG[status];
  const process = strParam(entry.parameters, "process");
  const material = strParam(entry.parameters, "material");
  const amps = numParam(entry.parameters, "voltage", "amperage");

  return (
    <li className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 transition-colors">
      {/* Date + status pill */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] text-zinc-500 font-medium">
          {formatDate(entry.created_at)}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill}`}>
          {label}
        </span>
      </div>

      {/* Process / material / voltage */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        {process && (
          <span className="text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase tracking-wide">
            {process}
          </span>
        )}
        {material && (
          <span className="text-xs text-zinc-300">{material}</span>
        )}
        {amps != null && (
          <span className="text-xs text-zinc-500">{amps}A</span>
        )}
      </div>

      {/* Defect type */}
      {entry.defect_type && (
        <p className="text-[11px] text-zinc-600 capitalize mb-2.5">
          {entry.defect_type}
        </p>
      )}

      {/* Resume context button */}
      <button
        onClick={onResume}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-orange-400 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700 hover:border-orange-500/30 rounded-lg py-1.5 transition-all"
      >
        <svg
          className="w-3 h-3 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Resume context
      </button>
    </li>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WeldMemoryPanelProps {
  userId: string;
  onResumeContext: (message: string) => void;
}

export default function WeldMemoryPanel({
  userId,
  onResumeContext,
}: WeldMemoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<DiagnosisEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/memory?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { diagnoses: DiagnosisEntry[] } = await res.json();
      setEntries(data.diagnoses ?? []);
      setFetched(true);
    } catch (err) {
      console.error("Failed to load session history:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch on first open; re-fetch if userId changes
  useEffect(() => {
    if (isOpen && !fetched) {
      fetchHistory();
    }
  }, [isOpen, fetched, fetchHistory]);

  useEffect(() => {
    setFetched(false);
  }, [userId]);

  const handleResume = useCallback(
    (entry: DiagnosisEntry) => {
      onResumeContext(buildResumeMessage(entry));
      setIsOpen(false);
    },
    [onResumeContext]
  );

  if (!userId) return null;

  return (
    <>
      {/* ── Toggle tab fixed to left edge ── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle session history"
        title="Session history"
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40
          flex flex-col items-center gap-1.5
          bg-zinc-900 border border-zinc-800 border-l-0
          rounded-r-xl px-2 py-3
          transition-all duration-150
          hover:bg-zinc-800
          ${isOpen
            ? "text-orange-400 border-orange-500/40 bg-zinc-800"
            : "text-zinc-500 hover:text-orange-400"
          }`}
      >
        <HistoryIcon className="w-4 h-4" />
        <span
          className="text-[9px] font-semibold tracking-widest uppercase"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          History
        </span>
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          style={{ top: "56px" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Sliding panel ── */}
      <div
        className={`fixed left-0 bottom-0 z-40 w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ top: "56px" }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Session History
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Refresh */}
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="w-7 h-7 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading history…
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                <HistoryIcon className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm font-medium mb-1">
                No sessions yet
              </p>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Conversations where a defect is diagnosed will be saved here
                automatically.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onResume={() => handleResume(entry)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Panel footer */}
        {!loading && fetched && (
          <div className="flex-shrink-0 px-4 py-2 border-t border-zinc-800">
            <p className="text-[11px] text-zinc-700 text-center">
              {entries.length === 0
                ? "No sessions on record"
                : `${entries.length} recent session${entries.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
