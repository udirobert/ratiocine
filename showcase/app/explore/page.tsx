import type { Metadata } from "next";

import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore the Build",
  description:
    "Three scenes from the IOL-AI 2026 build: the problem, the machine, the answer.",
};

const ExplorePage = () => {
  return <ExploreClient />;
};

export default ExplorePage;
