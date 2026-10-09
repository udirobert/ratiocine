// Share-copy A/B test (48-hour window): control = competitive "beat the
// machine" framing, linguistic = puzzle-provenance framing. Assignment is a
// stable 50/50 bucket persisted locally; the shared link carries `&sc=` so
// inbound clicks attribute back to the variant.

export type ShareVariant = "control" | "linguistic";

const KEY = "ration-share-variant";

export function getShareVariant(): ShareVariant {
  if (typeof window === "undefined") return "control";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "control" || stored === "linguistic") return stored;
    const assigned: ShareVariant = Math.random() < 0.5 ? "control" : "linguistic";
    window.localStorage.setItem(KEY, assigned);
    return assigned;
  } catch {
    return "control";
  }
}

export function challengeParam(v: ShareVariant): string {
  return `&sc=${v === "linguistic" ? "l" : "c"}`;
}

export function variantTagline(v: ShareVariant): string {
  return v === "linguistic"
    ? "A real-language grammar puzzle from the IOL tradition."
    : "Out-deduce the machine on a language it has never seen.";
}

export function variantInvite(v: ShareVariant): string {
  return v === "linguistic"
    ? "Every clue is in the evidence. Solve it."
    : "Can the machine do it too?";
}
