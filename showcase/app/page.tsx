"use client";

import dynamic from "next/dynamic";

import { GridBackground } from "@/components/ui/grid-background";

const Machine = dynamic(
  () => import("./scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);

const Home = () => {
  return (
    <main className="relative h-svh w-screen overflow-hidden bg-[#0a0f2e]">
      <GridBackground className="bg-[#0a0f2e]" />

      {/* Wordmark — top right */}
      <div className="fixed top-5 right-5 z-50">
        <a
          href="https://github.com/udirobert/ratiocine"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm font-bold tracking-tight text-white/80 hover:text-white transition-colors"
        >
          ratiocine
        </a>
      </div>

      <div className="absolute inset-0">
        <Machine />
      </div>
    </main>
  );
};

export default Home;
