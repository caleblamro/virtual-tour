#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Environment inputs
# ---------------------------------------------------------------------------
JOB_ID="${JOB_ID:?JOB_ID is required}"
INPUT_S3_URI="${INPUT_S3_URI:?INPUT_S3_URI is required}"
OUTPUT_S3_PREFIX="${OUTPUT_S3_PREFIX:?OUTPUT_S3_PREFIX is required}"
JOBS_TABLE="${JOBS_TABLE:?JOBS_TABLE is required}"
OUTPUTS_BUCKET="${OUTPUTS_BUCKET:?OUTPUTS_BUCKET is required}"
LOCAL_MODE="${LOCAL_MODE:-}"

STEP="init"

mkdir -p /work/frames /work/sparse /work/colmap /work/output /work/final

# ---------------------------------------------------------------------------
# update_progress <status> <progress_pct> [message]
# Skipped entirely in LOCAL_MODE.
# ---------------------------------------------------------------------------
update_progress() {
  local status="$1"
  local progress="$2"
  local message="${3:-}"

  if [ -n "$LOCAL_MODE" ]; then
    echo "[LOCAL] status=$status progress=$progress${message:+ msg=$message}"
    return 0
  fi

  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  if [ -n "$message" ]; then
    aws dynamodb update-item \
      --table-name "$JOBS_TABLE" \
      --key '{"jobId":{"S":"'"$JOB_ID"'"}}' \
      --update-expression "SET #s = :s, progress = :p, updatedAt = :u, message = :m" \
      --expression-attribute-names '{"#s":"status"}' \
      --expression-attribute-values '{":s":{"S":"'"$status"'"},":p":{"N":"'"$progress"'"},":u":{"S":"'"$now"'"},":m":{"S":"'"$message"'"}}'
  else
    aws dynamodb update-item \
      --table-name "$JOBS_TABLE" \
      --key '{"jobId":{"S":"'"$JOB_ID"'"}}' \
      --update-expression "SET #s = :s, progress = :p, updatedAt = :u" \
      --expression-attribute-names '{"#s":"status"}' \
      --expression-attribute-values '{":s":{"S":"'"$status"'"},":p":{"N":"'"$progress"'"},":u":{"S":"'"$now"'"}}'
  fi
}

# ---------------------------------------------------------------------------
# fail <message>
# ---------------------------------------------------------------------------
fail() {
  local msg="$1"
  echo "FATAL [$STEP]: $msg" >&2
  update_progress "failed" "0" "$msg" || true
  exit 1
}

trap 'fail "Pipeline failed at step $STEP"' ERR

# ---------------------------------------------------------------------------
# Step: download
# ---------------------------------------------------------------------------
STEP="download"
echo "==> [$STEP] Fetching input video"

if [ -n "$LOCAL_MODE" ]; then
  echo "[LOCAL] Using /input.mp4 directly (skipping S3 download)"
  cp /input.mp4 /work/input.mp4
else
  aws s3 cp "$INPUT_S3_URI" /work/input.mp4
fi

update_progress "running" "5"

# ---------------------------------------------------------------------------
# Step: extract_frames
# ---------------------------------------------------------------------------
STEP="extract_frames"
echo "==> [$STEP] Extracting frames"
bash /app/scripts/extract_frames.sh
update_progress "running" "10"

# ---------------------------------------------------------------------------
# Step: colmap
# ---------------------------------------------------------------------------
STEP="colmap"
echo "==> [$STEP] Running COLMAP reconstruction"
bash /app/scripts/run_colmap.sh
update_progress "running" "35"

# ---------------------------------------------------------------------------
# Step: train_gsplat
# ---------------------------------------------------------------------------
STEP="train_gsplat"
echo "==> [$STEP] Training 3D Gaussian Splat"
python3 /app/scripts/train_gsplat.py
update_progress "running" "90"

# ---------------------------------------------------------------------------
# Step: transform
# ---------------------------------------------------------------------------
STEP="transform"
echo "==> [$STEP] Converting to SOG + collision mesh"
bash /app/scripts/transform.sh
update_progress "running" "95"

# ---------------------------------------------------------------------------
# Step: upload
# ---------------------------------------------------------------------------
STEP="upload"
echo "==> [$STEP] Uploading outputs"

if [ -n "$LOCAL_MODE" ]; then
  echo "[LOCAL] Skipping S3 upload. Final files:"
  ls -lh /work/final/
else
  aws s3 sync /work/final/ "s3://${OUTPUTS_BUCKET}/${OUTPUT_S3_PREFIX}/"

  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  aws dynamodb update-item \
    --table-name "$JOBS_TABLE" \
    --key '{"jobId":{"S":"'"$JOB_ID"'"}}' \
    --update-expression "SET #s = :s, progress = :p, updatedAt = :u, outputPrefix = :o" \
    --expression-attribute-names '{"#s":"status"}' \
    --expression-attribute-values '{":s":{"S":"done"},":p":{"N":"100"},":u":{"S":"'"$NOW"'"},":o":{"S":"'"$OUTPUT_S3_PREFIX"'"}}'

  echo "Job $JOB_ID complete. Output: s3://${OUTPUTS_BUCKET}/${OUTPUT_S3_PREFIX}/"
fi

echo "==> Pipeline complete"
