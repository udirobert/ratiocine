import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#34d399";
const BG = "#0a0c10";

// River-current motif — same generative geometry as the in-game Apurinã
// backdrop (see play/motifs.tsx), stroked in the brand accent.
function riverPaths(): string[] {
  const lines: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y0 = 60 + i * 100;
    const amp = 22 + (i % 3) * 12;
    const phase = i * 1.7;
    let d = `M -80 ${y0}`;
    for (let x = -80; x < 1600; x += 100) {
      const yc = y0 + Math.sin(phase + (x + 50) / 180) * amp;
      const ye = y0 + Math.sin(phase + (x + 100) / 180) * amp;
      d += ` Q ${x + 50} ${yc.toFixed(1)} ${x + 100} ${ye.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}

async function loadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OgImage() {
  const [serif700, serifItalic, mono] = await Promise.all([
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-700-normal.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-500-italic.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-500-normal.ttf"),
  ]);

  const fonts = [
    serif700 && { name: "Fraunces", data: serif700, weight: 700 as const, style: "normal" as const },
    serifItalic && { name: "Fraunces", data: serifItalic, weight: 500 as const, style: "italic" as const },
    mono && { name: "Plex Mono", data: mono, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: BG,
          padding: "64px 72px",
          position: "relative",
          overflow: "hidden",
          fontFamily: '"Fraunces", Georgia, serif',
        }}
      >
        {/* ── Backdrop: river motif + glows ── */}
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, opacity: 0.5 }}
        >
          {riverPaths().map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.1 + (i % 3) * 0.04}
              strokeWidth={2}
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -200,
            width: 720,
            height: 720,
            borderRadius: 360,
            backgroundColor: ACCENT,
            opacity: 0.06,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            left: 200,
            width: 760,
            height: 480,
            borderRadius: 240,
            backgroundColor: "#064e3b",
            opacity: 0.32,
          }}
        />

        {/* ── Left: promise ── */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
            <div style={{ width: 10, height: 10, backgroundColor: ACCENT, marginRight: 12 }} />
            <div
              style={{
                fontFamily: '"Plex Mono", monospace',
                fontSize: 21,
                letterSpacing: 4,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              A DAILY LINGUISTICS DEDUCTION GAME
            </div>
          </div>

          <div style={{ fontSize: 96, fontWeight: 700, color: "#fff", lineHeight: 1.02 }}>
            Crack the pattern.
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 500,
              fontStyle: "italic",
              color: ACCENT,
              marginTop: 6,
            }}
          >
            then watch the machine try.
          </div>

          {/* specimen rows */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 10 }}>
            {[
              ["nhaapitaka", "I am going"],
              ["ãpitaka", "you are going"],
            ].map(([src, tgt]) => (
              <div key={src} style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    fontFamily: '"Plex Mono", monospace',
                    fontSize: 24,
                    color: "#6ee7b7",
                    width: 190,
                  }}
                >
                  {src}
                </div>
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.3)", marginRight: 14 }}>→</div>
                <div style={{ fontSize: 24, color: "rgba(255,255,255,0.75)" }}>{tgt}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: '"Plex Mono", monospace',
              fontSize: 19,
              color: "rgba(255,255,255,0.35)",
              marginTop: 30,
            }}
          >
            ratiocine · you vs 14B parameters · same grading
          </div>
        </div>

        {/* ── Right: the duel card ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 330,
            marginLeft: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              border: `1px solid rgba(255,255,255,0.14)`,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.03)",
              padding: "28px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontFamily: '"Plex Mono", monospace',
                    fontSize: 18,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: 2,
                  }}
                >
                  YOU
                </div>
                <div style={{ fontSize: 64, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>5/5</div>
              </div>
              <div
                style={{
                  fontFamily: '"Plex Mono", monospace',
                  fontSize: 20,
                  color: "rgba(255,255,255,0.3)",
                  paddingBottom: 14,
                }}
              >
                vs
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div
                  style={{
                    fontFamily: '"Plex Mono", monospace',
                    fontSize: 18,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: 2,
                  }}
                >
                  MACHINE
                </div>
                <div style={{ fontSize: 64, fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>3/5</div>
              </div>
            </div>

            {/* tile chips */}
            <div style={{ display: "flex", flexDirection: "row", marginTop: 22, gap: 8 }}>
              {["nhaa", "pita", "ka"].map((t) => (
                <div
                  key={t}
                  style={{
                    fontFamily: '"Plex Mono", monospace',
                    fontSize: 22,
                    color: "#fff",
                    border: `1px solid ${ACCENT}66`,
                    backgroundColor: `${ACCENT}22`,
                    borderRadius: 8,
                    padding: "8px 14px",
                  }}
                >
                  {t}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 30, fontStyle: "italic", color: "rgba(255,255,255,0.85)", marginTop: 18 }}>
              Beat the machine.
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts as never,
    },
  );
}
