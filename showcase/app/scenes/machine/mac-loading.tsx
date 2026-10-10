"use client";

interface MacLoadingProps {
  progress?: number;
}

export const MacLoading = ({ progress }: MacLoadingProps) => {
  const pct = progress === undefined ? null : Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className="mac-loading" role="status" aria-live="polite">
      <svg
        className="mac-loading-svg"
        viewBox="0 0 120 100"
        width="120"
        height="100"
        aria-hidden="true"
      >
        <rect x="18" y="10" width="84" height="70" rx="10" className="mac-loading-body" />
        <rect x="30" y="22" width="60" height="44" rx="4" className="mac-loading-screen" />
        <rect x="48" y="80" width="24" height="6" rx="2" className="mac-loading-body" />
        <rect x="38" y="88" width="44" height="5" rx="2.5" className="mac-loading-body" />
      </svg>
      <div className="mac-loading-track">
        <div className="mac-loading-bar" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="mac-loading-text font-mono">
        warming up the machine&hellip;{pct !== null ? ` ${pct}%` : ""}
      </p>
    </div>
  );
};
