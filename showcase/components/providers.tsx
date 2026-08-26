"use client";

// App-wide client providers.
// MotionConfig reducedMotion="user" makes every motion component honour the
// OS-level reduced-motion preference (CSS animations are handled in globals.css).
import { MotionConfig } from "motion/react";
import { Analytics } from "@vercel/analytics/next";

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <MotionConfig reducedMotion="user">
    {children}
    <Analytics />
  </MotionConfig>
);
