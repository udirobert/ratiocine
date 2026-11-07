#!/bin/bash
# Concat scene webms -> silent mp4, then mux narration.
set -e
cd "$(dirname "$0")"
mkdir -p output
ls "$PWD"/footage/scene*.webm | sort | sed "s|^|file '|; s|$|'|" > /tmp/vidscenes.txt
ffmpeg -y -v error -f concat -safe 0 -i /tmp/vidscenes.txt \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a0c12,fps=30" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 output/silent.mp4
ffmpeg -y -v error -i output/silent.mp4 -i audio/scenes/narration.wav \
  -c:v copy -c:a aac -b:a 192k -shortest \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -movflags +faststart \
  output/ratiocine-eval-walkthrough.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 output/ratiocine-eval-walkthrough.mp4
