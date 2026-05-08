#!/bin/bash
set -euo pipefail
mkdir -p /work/final

PLY=/work/output/point_cloud.ply

if [ ! -f "$PLY" ]; then
  echo "ERROR: point_cloud.ply not found" >&2
  exit 1
fi

# Convert to SOG format
splat-transform -w "$PLY" /work/final/scene.sog

# Generate collision mesh
splat-transform -w "$PLY" /work/final/scene.collision.glb -K

# Generate thumbnail by extracting a representative frame from input
ffmpeg -i /work/input.mp4 -ss 00:00:03 -vframes 1 -vf "scale=640:-2" /work/final/thumbnail.jpg

echo "Transform complete. Files:"
ls -lh /work/final/
