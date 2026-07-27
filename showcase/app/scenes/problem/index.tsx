"use client";

import { ProblemContent } from "./problem-content";
import { RainOverlay } from "./rain-overlay";

export const Problem = () => (
  <div className="relative h-svh w-full overflow-hidden bg-[#0a0f2e]">
    {/* The real IOL problem — always visible as readable DOM */}
    <ProblemContent />

    {/* Universal CSS rain overlay — no experimental flags needed */}
    <RainOverlay />
  </div>
);
