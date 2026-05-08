#!/bin/bash
set -euo pipefail
mkdir -p /work/sparse /work/colmap

colmap feature_extractor \
  --database_path /work/db.db \
  --image_path /work/frames/ \
  --SiftExtraction.use_gpu 1 \
  --SiftExtraction.max_num_features 8192

colmap exhaustive_matcher \
  --database_path /work/db.db \
  --SiftMatching.use_gpu 1

colmap mapper \
  --database_path /work/db.db \
  --image_path /work/frames/ \
  --output_path /work/sparse/

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
