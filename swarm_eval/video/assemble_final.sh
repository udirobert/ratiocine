#!/usr/bin/env bash
# Assemble the swarm video: normalize webm scenes -> mp4, concat, mux narration.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FOOT="$HERE/footage"
SEG="$HERE/segments"
AUD="$HERE/audio/scenes/narration.wav"
OUT="$HERE/output/swarm-alignment.mp4"
mkdir -p "$HERE/output" "$SEG"

# scene webm -> mp4 (exact filenames already normalized to 1920x1080 vp9)
declare -a CLIPS=(
  "$FOOT/page@c25c123898751165988651af57669761.webm"   # 01 title
  "$SEG/02-flux-swarm.mp4"                            # 02 flux
  "$FOOT/page@34dc57d383f734e0eb9ace12c247a537.webm"   # 03 testbed
  "$FOOT/page@09887531994420424c6f3161b4a63c8f.webm"   # 04 conditions
  "$SEG/05-dashboard.mp4"                             # 05 dashboard replay
  "$SEG/06-flux-poison.mp4"                           # 06 flux poison
  "$FOOT/page@2a00bd9965836c53bd9fe173cc6a81f1.webm"   # 07 poison results
  "$FOOT/page@321fddf11e4265ab083f24e0c64b91de.webm"   # 08 failures
  "$FOOT/page@bc7895f42224fab0e212924fbb9fdfc2.webm"   # 09 monitor
  "$FOOT/page@2ed9e567a9d63e01dfb9cd1c2f8b3a31.webm"   # 10 close
)

NAMES=(01-title 02-flux 03-testbed 04-conditions 05-dashboard 06-flux-poison 07-poison 08-failures 09-monitor 10-close)
LIST="$SEG/concat.txt"
: > "$LIST"
for i in "${!CLIPS[@]}"; do
  src="${CLIPS[$i]}"
  dst="$SEG/$(printf '%02d' $((i+1)))-${NAMES[$i]}.mp4"
  if [[ "$src" == *.webm ]]; then
    ffmpeg -y -v error -i "$src" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast -an "$dst"
  else
    cp "$src" "$dst"
  fi
  echo "file '$dst'" >> "$LIST"
done

ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -i "$AUD" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast -c:a aac -b:a 192k -shortest \
  "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "DONE $OUT"
