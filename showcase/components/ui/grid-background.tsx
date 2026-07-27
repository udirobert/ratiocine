import clsx from "clsx";

interface GridBackgroundProps {
  className?: string;
}

export const GridBackground = ({ className }: GridBackgroundProps) => (
  <div className={clsx("pointer-events-none fixed inset-0", className)}>
    <div
      className={clsx(
        "absolute inset-0 overflow-hidden opacity-30",
        "after:absolute after:-inset-47 after:-top-0.5 after:left-0 after:bg-[url(/grid.svg)] after:bg-center after:opacity-40",
        "after:mask-[radial-gradient(circle_at_calc(50%-94px)_calc(50%-93px),#fff_40%,transparent_75%)]",
      )}
    />
  </div>
);
