"use client";

import { motion } from "motion/react";
import type { LanguageLore } from "./puzzle-data";

interface LorePanelProps {
  lore: LanguageLore;
  language: string;
}

export const LorePanel = ({ lore, language }: LorePanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1">
          About this language
        </p>
        <h3 className="text-base font-bold text-white/90">{language}</h3>
      </div>

      {/* Lore grid */}
      <div className="divide-y divide-white/5">
        <LoreRow
          label="Etymology"
          content={lore.etymology}
          delay={0.3}
        />
        <LoreRow
          label="Where"
          content={lore.geography}
          delay={0.4}
        />
        <LoreRow
          label="Speakers"
          content={`${lore.speakers} — ${lore.endangerment}`}
          delay={0.5}
        />
        <LoreRow
          label="Language family"
          content={lore.family}
          delay={0.6}
        />
        <LoreRow
          label="Cultural context"
          content={lore.culturalNote}
          delay={0.7}
        />
        <LoreRow
          label="Did you know?"
          content={lore.funFact}
          delay={0.8}
          highlight
        />
      </div>

      {/* Map hint */}
      <div className="px-5 py-3 bg-white/[0.01] text-center">
        <p className="text-[10px] text-white/25 font-mono">
          📍 {lore.coordinates[0].toFixed(2)}°, {lore.coordinates[1].toFixed(2)}° — Purus River basin, Amazonas
        </p>
      </div>
    </motion.div>
  );
};

const LoreRow = ({
  label,
  content,
  delay,
  highlight,
}: {
  label: string;
  content: string;
  delay: number;
  highlight?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3 }}
    className={`px-5 py-3 ${highlight ? "bg-amber-400/[0.03]" : ""}`}
  >
    <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">
      {label}
    </p>
    <p className={`text-sm leading-relaxed ${highlight ? "text-amber-200/80" : "text-white/65"}`}>
      {content}
    </p>
  </motion.div>
);
