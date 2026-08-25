"use client";

import { useCallback, useEffect, useState } from "react";

export const useSolveCounter = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/counter")
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => {}); // silent fail — social proof is optional
  }, []);

  const increment = useCallback(async () => {
    try {
      const r = await fetch("/api/counter", { method: "POST" });
      const d = await r.json();
      setCount(d.count);
    } catch {} // silent
  }, []);

  return { count, increment };
};
