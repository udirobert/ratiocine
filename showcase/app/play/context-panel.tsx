"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { PuzzlePair } from "./puzzle-data";

export interface ContextPanelProps {
  pairs: PuzzlePair[];
  highlightedRows: Set<number>; // from hints
}

export const ContextPanel = ({ pairs, highlightedRows }: ContextPanelProps) => {
  const [selectedMorpheme, setSelectedMorpheme] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const visiblePairs = expanded ? pairs : pairs.slice(0, 6);

  // Find which rows contain the selected morpheme
  const matchingRows = new Set<number>();
  if (selectedMorpheme) {
    pairs.forEach((pair) => {
      if (pair.morphemes.includes(selectedMorpheme)) {
        matchingRows.add(pair.id);
      }
    });
  }

  // Highlight a morpheme within a source word
  const renderSource = (pair: PuzzlePair) => {
    if (!selectedMorpheme || !pair.morphemes.includes(selectedMorpheme)) {
      return <span>{pair.source}</span>;
    }

    // Build highlighted version by marking the selected morpheme
    const parts: { text: string; highlight: boolean }[] = [];
    let remaining = pair.source;

    for (const morph of pair.morphemes) {
      const idx = remaining.indexOf(morph);
      if (idx === -1) {
        // fallback: morpheme not found literally (shouldn't happen with good data)
        parts.push({ text: remaining, highlight: false });
        remaining = "";
        break;
      }
      if (idx > 0) {
        parts.push({ text: remaining.slice(0, idx), highlight: false });
      }
      parts.push({ text: morph, highlight: morph === selectedMorpheme });
      remaining = remaining.slice(idx + morph.length);
    }
    if (remaining) {
      parts.push({ text: remaining, highlight: false });
    }

    return (
      <span>
        {parts.map((part, i) =>
          part.highlight ? (
            <span key={i} className="bg-amber-400/20 text-amber-300 rounded px-0.5">
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
            Context
          </span>
          <span className="text-[10px] text-white/30">
            — tap a word to trace its pattern
          </span>
        </div>
        {pairs.length > 6 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="font-mono text-[11px] text-amber-300/70 hover:text-amber-300 transition-colors"
          >
            {expanded ? "show fewer" : `show all ${pairs.length}`}
          </button>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="divide-y divide-white/5">
          {visiblePairs.map((pair) => {
            const isHighlightedByHint = highlightedRows.has(pair.id);
            const isMatchedBySelection = matchingRows.has(pair.id);

            return (
              <motion.div
                key={pair.id}
                layout
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
                  isHighlightedByHint
                    ? "bg-amber-400/[0.06]"
                    : isMatchedBySelection
                      ? "bg-white/[0.04]"
                      : "hover:bg-white/[0.02]"
                }`}
                onClick={() => {
                  // Cycle through morphemes on tap
                  const morphemes = pair.morphemes;
                  if (!selectedMorpheme || !morphemes.includes(selectedMorpheme)) {
                    setSelectedMorpheme(morphemes[0]);
                  } else {
                    const idx = morphemes.indexOf(selectedMorpheme);
                    const next = morphemes[(idx + 1) % morphemes.length];
                    // If we've cycled through all, deselect
                    if (idx === morphemes.length - 1) {
                      setSelectedMorpheme(null);
                    } else {
                      setSelectedMorpheme(next);
                    }
                  }
                }}
              >
                {/* Row number */}
                <span className="font-mono text-[11px] text-white/30 w-5 shrink-0 text-right">
                  {pair.id}
                </span>

                {/* Source (unfamiliar language) */}
                <span className="font-mono text-sm text-sky-300 flex-1 min-w-0">
                  {renderSource(pair)}
                </span>

                {/* Arrow */}
                <span className="text-white/20 text-xs shrink-0">→</span>

                {/* Target (English) */}
                <span className="text-sm text-white/70 flex-1 min-w-0">
                  {pair.target}
                </span>

                {/* Hint indicator */}
                {isHighlightedByHint && (
                  <span className="text-amber-400/60 text-[10px] shrink-0">★</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Morpheme legend (when something is selected) */}
      {selectedMorpheme && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-2 text-[11px] text-white/50"
        >
          <span className="font-mono text-amber-300 bg-amber-400/10 rounded px-1.5 py-0.5">
            {selectedMorpheme}
          </span>
          <span>
            appears in {matchingRows.size} row{matchingRows.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setSelectedMorpheme(null)}
            className="ml-auto text-white/30 hover:text-white/50"
          >
            clear
          </button>
        </motion.div>
      )}
    </div>
  );
};
