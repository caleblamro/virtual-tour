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

# Sequential matching — correct for ordered video frames
colmap sequential_matcher \
  --database_path /work/db.db \
  --SiftMatching.use_gpu 1 \
  --SequentialMatching.overlap 20

# view_graph_calibrator refines focal length estimates before global reconstruction.
# Recommended by COLMAP docs before global_mapper. Works on a copy of the DB
# since it modifies intrinsics in-place.
cp /work/db.db /work/db_global.db
colmap view_graph_calibrator \
  --database_path /work/db_global.db \
  --image_path /work/frames/

# Global mapper: solves all camera poses simultaneously via rotation averaging.
# ~10x faster than incremental mapper on large scenes.
colmap global_mapper \
  --database_path /work/db_global.db \
  --image_path /work/frames/ \
  --output_path /work/sparse/

# global_mapper may write the model directly to sparse/ instead of sparse/0/
if [ -d "/work/sparse/0" ]; then
  SPARSE_MODEL="/work/sparse/0"
elif [ -f "/work/sparse/cameras.bin" ] || [ -f "/work/sparse/cameras.txt" ]; then
  # Normalise to sparse/0/ so downstream tools (image_undistorter, FastGS) are happy
  mkdir -p /work/sparse/0
  mv /work/sparse/cameras.* /work/sparse/images.* /work/sparse/points3D.* /work/sparse/0/
  SPARSE_MODEL="/work/sparse/0"
else
  echo "COLMAP reconstruction failed - no model produced"
  exit 1
fi

colmap image_undistorter \
  --image_path /work/frames/ \
  --input_path "$SPARSE_MODEL" \
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
