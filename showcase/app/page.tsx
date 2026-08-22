"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { SceneLabel, SceneNav, SceneId, Wordmark } from "@/components/scene-nav";
import { GridBackground } from "@/components/ui/grid-background";
import { HeroOverlay } from "@/components/hero-overlay";

const Problem = dynamic(
  () => import("./scenes/problem/index").then((m) => m.Problem),
  { ssr: false },
);
const Machine = dynamic(
  () => import("./scenes/machine/index").then((m) => m.Machine),
  { ssr: false },
);
const Answer = dynamic(
  () => import("./scenes/answer/index").then((m) => m.Answer),
  { ssr: false },
);

const Home = () => {
  const [scene, setScene] = useState<SceneId>("machine");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0a0f2e]">
      <GridBackground className="bg-[#0a0f2e]" />
      <SceneLabel current={scene} />
      <Wordmark />

      <div className="absolute inset-0">
        {scene === "problem" && <Problem key="problem" />}
        {scene === "machine" && <Machine key="machine" />}
        {scene === "answer" && <Answer key="answer" />}
      </div>

      <SceneNav current={scene} onChange={setScene} />
      <HeroOverlay />
    </main>
  );
};

export default Home;
