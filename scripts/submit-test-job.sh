#!/usr/bin/env bash
set -euo pipefail

VIDEO="${1:-}"
if [ -z "$VIDEO" ]; then
  echo "Usage: $0 <path-to-video.mp4>"
  exit 1
fi

API_URL="${VIRTUAL_TOUR_API_URL:-}"
if [ -z "$API_URL" ]; then
  echo "Error: VIRTUAL_TOUR_API_URL is not set. Export it before running this script."
  echo "  export VIRTUAL_TOUR_API_URL=https://<id>.execute-api.<region>.amazonaws.com"
  exit 1
fi
REGION="${AWS_REGION:-us-west-2}"

echo "==> Creating job..."
RESPONSE=$(curl -sf -X POST "$API_URL/jobs" -H "Content-Type: application/json" -d '{}')
JOB_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['uploadUrl'])")
echo "    jobId: $JOB_ID"

echo "==> Uploading $VIDEO..."
curl -sf -X PUT "$UPLOAD_URL" -H "Content-Type: video/mp4" --data-binary "@$VIDEO"
echo "    uploaded."

echo "==> Polling job status (Ctrl-C to stop)..."
while true; do
  STATUS=$(curl -sf "$API_URL/jobs/$JOB_ID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))")
  echo "    $(date '+%H:%M:%S')  $STATUS"
  if [[ "$STATUS" == "done" || "$STATUS" == "failed" ]]; then
    break
  fi
  sleep 15
done

echo "==> Final job record:"
curl -sf "$API_URL/jobs/$JOB_ID" | python3 -m json.tool

echo ""
echo "==> CloudWatch logs:"
echo "    https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group/\$252Faws\$252Fbatch\$252Fjob"
