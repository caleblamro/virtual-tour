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

colmap image_undistorter \
  --image_path /work/frames/ \
  --input_path /work/sparse/0 \
  --output_path /work/colmap/ \
  --output_type COLMAP

echo "COLMAP done. Images: $(ls /work/colmap/images/ | wc -l)"
