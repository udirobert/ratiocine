"use client";

import { motion } from "motion/react";

const PARTNERS = [
  {
    name: "Arkor",
    url: "https://arkor.ai",
    desc: "TypeScript fine-tuning framework",
    color: "#a78bfa",
  },
  {
    name: "Modal",
    url: "https://modal.com",
    desc: "Serverless GPU runtime",
    color: "#34d399",
  },
  {
    name: "Vultr",
    url: "https://vultr.com",
    desc: "VPS & cloud compute",
    color: "#60a5fa",
  },
  {
    name: "Cohere Labs",
    url: "https://cohere.com/research",
    desc: "Multilingual AI research",
    color: "#fb923c",
  },
  {
    name: "Hugging Face",
    url: "https://huggingface.co",
    desc: "Model hub & submission platform",
    color: "#fbbf24",
  },
];

const chip = (p: (typeof PARTNERS)[number], i: number) => (
  <motion.a
    key={p.name}
    href={p.url}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: "easeOut" }}
    className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur hover:bg-white/10 transition-colors"
  >
    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
    <div className="min-w-0">
      <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors leading-none mb-0.5">
        {p.name}
      </p>
      <p className="text-[10px] text-white/40 leading-none whitespace-nowrap">
        {p.desc}
      </p>
    </div>
  </motion.a>
);

export const PartnerLogos = () => {
  const left = PARTNERS.slice(0, 3);
  const right = PARTNERS.slice(3);
  return (
    <>
      {/* left column — above nav, clear of the centered mac */}
      <div className="pointer-events-none absolute left-5 bottom-28 z-20 hidden flex-col gap-2 md:flex">
        {left.map((p, i) => (
          <div key={p.name} className="pointer-events-auto">{chip(p, i)}</div>
        ))}
      </div>

      {/* right column */}
      <div className="pointer-events-none absolute right-5 bottom-28 z-20 hidden flex-col items-end gap-2 md:flex">
        {right.map((p, i) => (
          <div key={p.name} className="pointer-events-auto">{chip(p, i + left.length)}</div>
        ))}
      </div>
    </>
  );
};
