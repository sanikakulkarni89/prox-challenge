"use client";

import { useState, useEffect, useCallback } from "react";
import type { Citation } from "@/lib/types";

interface Props {
  citation: Citation;
  allCitations?: Citation[];
  onClose: () => void;
}

export default function ManualPageViewer({ citation, allCitations = [], onClose }: Props) {
  const [current, setCurrent] = useState(citation);
  const [imgError, setImgError] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    setCurrent(citation);
    setImgError(false);
  }, [citation]);

  useEffect(() => {
    fetch(`/api/pages/${current.source}`)
      .then((r) => r.json())
      .then((d) => setPageCount(d.pages ?? null))
      .catch(() => setPageCount(null));
  }, [current.source]);

  const pageUrl = `/pages/${current.source}/page-${String(current.page).padStart(3, "0")}.png`;

  const navigate = useCallback(
    (delta: number) => {
      if (!pageCount) return;
      const next = Math.max(1, Math.min(pageCount, current.page + delta));
      if (next === current.page) return;
      setCurrent({ ...current, page: next, section: current.section });
      setImgError(false);
    },
    [current, pageCount]
  );

  const jumpToCitation = useCallback((c: Citation) => {
    setCurrent(c);
    setImgError(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-orange-400 text-xs font-medium truncate">{current.section}</p>
              <p className="text-zinc-400 text-xs">
                {current.label} · p.{current.page}
                {pageCount ? ` of ${pageCount}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-2 w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Jump chips for other citations in this response */}
        {allCitations.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-800 overflow-x-auto flex-shrink-0">
            <span className="text-zinc-600 text-xs flex-shrink-0">Jump:</span>
            {allCitations.map((c, i) => (
              <button
                key={i}
                onClick={() => jumpToCitation(c)}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  c.source === current.source && c.page === current.page
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-orange-500/30 hover:text-zinc-200"
                }`}
              >
                {c.label.replace(" Guide", "")} p.{c.page}
              </button>
            ))}
          </div>
        )}

        {/* Page image */}
        <div className="flex-1 overflow-y-auto bg-zinc-950 min-h-0 relative">
          {imgError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl">📄</div>
              <p className="text-zinc-400 text-sm">Page image not yet rendered.</p>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">python3 scripts/render-pages.py</code> to generate page images from the PDFs.
              </p>
            </div>
          ) : (
            <img
              src={pageUrl}
              alt={`${current.label} page ${current.page}`}
              className="w-full h-auto block"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        {/* Excerpt (if present) */}
        {current.excerpt && !imgError && (
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/60">
            <p className="text-zinc-400 text-xs leading-relaxed italic">&ldquo;{current.excerpt}&rdquo;</p>
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            disabled={!pageCount || current.page <= 1}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:hover:bg-transparent"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>

          <span className="text-zinc-600 text-xs">← → keys to navigate</span>

          <button
            onClick={() => navigate(1)}
            disabled={!pageCount || current.page >= pageCount}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:hover:bg-transparent"
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
