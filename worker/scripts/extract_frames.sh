#!/bin/bash
set -euo pipefail
mkdir -p /work/frames

DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 /work/input.mp4)

# Cap at 200 frames: compute fps so total <= 200, but never exceed 2fps.
# A 90s clip → ~180 frames @ 2fps; a 5min clip → 200 frames @ 0.67fps.
TARGET_FPS=$(awk "BEGIN {fps = 200 / $DURATION; if (fps > 2) fps = 2; printf \"%.4f\", fps}")

echo "Extracting frames from ${DURATION}s video at ${TARGET_FPS}fps (target ≤ 200 frames)..."
ffmpeg -i /work/input.mp4 \
  -vf "fps=${TARGET_FPS},scale='min(1920,iw)':-2" \
  -q:v 2 /work/frames/frame_%05d.jpg

COUNT=$(ls /work/frames/ | wc -l)
echo "Extracted $COUNT frames"
