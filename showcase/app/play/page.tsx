import type { Metadata } from "next";

import { PlayClient } from "./play-client";

export const metadata: Metadata = {
  title: "Play",
  description:
    "Crack the pattern of a real language — then watch the machine try the same puzzle, graded by the same rules.",
  openGraph: {
    title: "Play — ratiocine",
    description:
      "A daily linguistics deduction puzzle. You and a 14B-parameter model, graded by the same algorithm.",
    url: "https://ratiocine.vercel.app/play",
  },
};

const PlayPage = () => {
  return <PlayClient />;
};

export default PlayPage;
