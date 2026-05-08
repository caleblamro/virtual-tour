#!/bin/bash
set -euo pipefail
mkdir -p /work/frames

# Extract at 3fps, cap at 300 frames
DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 /work/input.mp4)
TOTAL=$(echo "$DURATION" | awk '{print int($1 * 3)}')

if [ "$TOTAL" -gt 300 ]; then
  FPS=$(echo "scale=4; 300 / $DURATION" | bc)
else
  FPS=3
fi

echo "Duration: ${DURATION}s  Raw 3fps count: $TOTAL  Target fps: $FPS"
ffmpeg -i /work/input.mp4 -vf "fps=$FPS,scale=1920:-2" -q:v 2 /work/frames/frame_%05d.jpg
echo "Extracted $(ls /work/frames/ | wc -l) frames"
