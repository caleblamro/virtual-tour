#!/bin/bash
set -euo pipefail
mkdir -p /work/sparse /work/colmap

Xvfb :99 -screen 0 1024x768x16 &
export DISPLAY=:99

# All frames come from the same camera (video), so share one camera model
colmap feature_extractor \
  --database_path /work/db.db \
  --image_path /work/frames/ \
  --ImageReader.single_camera 1 \
  --SiftExtraction.use_gpu 1 \
  --SiftExtraction.max_num_features 16384

# Exhaustive matching — checks all frame pairs, catching connections when the
# camera revisits the same area (common in home/room walkthroughs). More accurate
# than sequential_matcher for scenes ≤300 frames.
colmap exhaustive_matcher \
  --database_path /work/db.db \
  --SiftMatching.use_gpu 1

colmap mapper \
  --database_path /work/db.db \
  --image_path /work/frames/ \
  --output_path /work/sparse/ \
  --Mapper.ba_global_max_num_iterations 30

# Check that reconstruction succeeded
if [ ! -d "/work/sparse/0" ]; then
  echo "COLMAP reconstruction failed - no model produced"
  exit 1
fi

# Align world orientation so Y is up — fixes upside-down/tilted models
colmap model_orientation_aligner \
  --input_path /work/sparse/0 \
  --output_path /work/sparse/0 \
  --image_path /work/frames/

colmap image_undistorter \
  --image_path /work/frames/ \
  --input_path /work/sparse/0 \
  --output_path /work/colmap/ \
  --output_type COLMAP

# FastGS (3DGS-based) expects sparse/0/ inside the scene directory.
# image_undistorter writes directly to sparse/ — create the 0/ layout.
if [ ! -d "/work/colmap/sparse/0" ]; then
  mkdir -p /work/colmap/sparse/0
  cp /work/colmap/sparse/cameras.* /work/colmap/sparse/images.* \
     /work/colmap/sparse/points3D.* /work/colmap/sparse/0/ 2>/dev/null || true
fi

echo "COLMAP done. Images: $(ls /work/colmap/images/ | wc -l)"
