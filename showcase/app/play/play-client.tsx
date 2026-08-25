"use client";

import { useRouter } from "next/navigation";

import { PuzzleView } from "./puzzle-view";

export const PlayClient = () => {
  const router = useRouter();

  return (
    <main className="h-svh w-screen overflow-hidden bg-[#0a0c10]">
      <PuzzleView onBack={() => router.push("/")} />
    </main>
  );
};
