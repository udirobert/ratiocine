// Universal CSS-based rain overlay — no experimental APIs needed.
// Layered animated streaks + a subtle wet-glass droplet texture.

export const RainOverlay = () => (
  <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
    {/* rain streaks — three layers at different speeds/angles */}
    <div className="rain-layer rain-layer-1" />
    <div className="rain-layer rain-layer-2" />
    <div className="rain-layer rain-layer-3" />

    {/* static droplets on "glass" */}
    <div className="rain-droplets" />

    {/* wet-glass vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(5,8,25,0.45)_100%)]" />
  </div>
);
