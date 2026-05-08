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

  # Build attribute values via Python to safely escape message strings as JSON
  local update_expr attr_values
  if [ -n "$message" ]; then
    update_expr="SET #s = :s, progress = :p, updatedAt = :u, message = :m"
    attr_values=$(python3 -c "
import json,sys
s,p,u,m=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
print(json.dumps({':s':{'S':s},':p':{'N':p},':u':{'S':u},':m':{'S':m}}))" \
      "$status" "$progress" "$now" "$message")
  else
    update_expr="SET #s = :s, progress = :p, updatedAt = :u"
    attr_values=$(python3 -c "
import json,sys
s,p,u=sys.argv[1],sys.argv[2],sys.argv[3]
print(json.dumps({':s':{'S':s},':p':{'N':p},':u':{'S':u}}))" \
      "$status" "$progress" "$now")
  fi

  aws dynamodb update-item \
    --table-name "$JOBS_TABLE" \
    --key "{\"jobId\":{\"S\":\"$JOB_ID\"}}" \
    --update-expression "$update_expr" \
    --expression-attribute-names '{"#s":"status"}' \
    --expression-attribute-values "$attr_values"
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
