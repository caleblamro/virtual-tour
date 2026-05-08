#!/bin/bash
set -euo pipefail
mkdir -p /work/frames

DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 /work/input.mp4)

# 2fps — good coverage for walkthroughs without excessive redundancy
# scale caps at native width to avoid upscaling (never scale up, only down to 1920)
echo "Extracting frames at 2fps from ${DURATION}s video..."
ffmpeg -i /work/input.mp4 -vf "fps=2,scale='min(1920,iw)':-2" -q:v 2 /work/frames/frame_%05d.jpg

COUNT=$(ls /work/frames/ | wc -l)
echo "Extracted $COUNT frames"
