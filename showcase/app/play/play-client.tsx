"use client";

import { useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";

import { ConsentBanner } from "@/components/ConsentBanner";
import { PuzzleView } from "./puzzle-view";

export const PlayClient = () => {
  const router = useRouter();

  return (
    <MotionConfig reducedMotion="user">
      <main className="h-svh w-screen overflow-hidden bg-[#0a0c10]">
        <PuzzleView onBack={() => router.push("/")} />
        <ConsentBanner />
      </main>
    </MotionConfig>
  );
};
