#!/usr/bin/env bash
# Assemble v3: 9 brand segments + narration + burned captions.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SEG="$HERE/segments"
AUD="$HERE/audio/scenes/narration.wav"
CAP="$HERE/captions.ass"
OUT="$HERE/output/swarm-alignment.mp4"
# burned captions need libass — homebrew ffmpeg 9 on PATH lacks it
FFMPEG="$HOME/.local/bin/ffmpeg"
[ -x "$FFMPEG" ] || FFMPEG=ffmpeg
mkdir -p "$HERE/output"

ORDER=(01-title 02-testbed 03-conditions 04-dashboard 05-contagion 06-poison 07-failures 08-monitor 09-close)
LIST="$SEG/concat.txt"
: > "$LIST"
for n in "${ORDER[@]}"; do
  echo "file '$SEG/$n.mp4'" >> "$LIST"
done

"$FFMPEG" -y -v error -f concat -safe 0 -i "$LIST" -i "$AUD" \
  -vf "subtitles=$CAP:fontsdir=$HERE/fonts" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast -c:a aac -b:a 192k -shortest \
  "$OUT"
cp "$HERE/captions.srt" "$HERE/output/swarm-alignment.srt"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "DONE $OUT"
