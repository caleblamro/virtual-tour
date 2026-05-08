#!/bin/bash
# Launch a g4dn.xlarge Spot instance for testing Docker builds with a GPU.
# Usage:
#   ./scripts/dev-instance.sh launch    — start the instance, print SSH command
#   ./scripts/dev-instance.sh terminate — terminate it when done
#
# Prerequisites: AWS CLI configured, an EC2 key pair and security group
# that allows SSH (port 22) from your IP.

set -euo pipefail

REGION=us-west-2
INSTANCE_TYPE=g4dn.xlarge          # 16 GB T4 GPU, matches Batch worker
KEY_NAME=virtual-tour-dev
SG_ID=sg-0dd979d4d47f9e03e
STATE_FILE=/tmp/tour-dev-instance.json

# Amazon Deep Learning Base GPU AMI (Ubuntu 20.04) — has Docker + NVIDIA runtime pre-installed
# us-west-2 latest as of 2025-11 — update if needed
AMI_ID=ami-06f75bb64bb5ddcb4  # Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04) 20260505

usage() {
  echo "Usage: $0 [launch|terminate|ssh|status]"
  echo "  KEY_NAME and SG_ID must be set as env vars or hardcoded in this script."
  exit 1
}

cmd=${1:-usage}

case "$cmd" in
  launch)
    echo "Requesting Spot g4dn.xlarge in $REGION..."
    # No SubnetId — AWS picks the AZ with available Spot capacity.
    # Network interface is required to get AssociatePublicIpAddress on Spot.
    INSTANCE_ID=$(aws ec2 run-instances \
      --region "$REGION" \
      --image-id "$AMI_ID" \
      --instance-type "$INSTANCE_TYPE" \
      --key-name "$KEY_NAME" \
      --network-interfaces "[{\"DeviceIndex\":0,\"Groups\":[\"$SG_ID\"],\"AssociatePublicIpAddress\":true}]" \
      --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time"}}' \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3"}}]' \
      --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=tour-dev},{Key=Project,Value=virtual-tour}]' \
      --query 'Instances[0].InstanceId' \
      --output text)

    echo "Launched: $INSTANCE_ID"
    echo "$INSTANCE_ID" > "$STATE_FILE"

    echo "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

    PUBLIC_IP=$(aws ec2 describe-instances \
      --instance-ids "$INSTANCE_ID" \
      --region "$REGION" \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text)

    echo ""
    echo "Instance ready: $PUBLIC_IP"
    echo ""
    echo "SSH in with:"
    echo "  ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
    echo ""
    echo "Once connected, run:"
    cat <<'EOF'
  # Configure AWS credentials
  aws configure

  # Log into ECR
  aws ecr get-login-password --region us-west-2 | \
    docker login --username AWS --password-stdin \
    584916459912.dkr.ecr.us-west-2.amazonaws.com

  # Clone the repo
  git clone <your-repo-url>
  cd virtual-tour/worker

  # --- Test base image build (takes ~40 min) ---
  make build-base

  # Verify COLMAP 4.x is installed and global_mapper exists:
  docker run --rm 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker:base \
    colmap help | grep global_mapper

  # --- Test app image build (takes ~10-15 min for FastGS CUDA compile) ---
  make build

  # --- Smoke test: frames + COLMAP + training ---
  # (upload a short test video to S3 first, or use the local test targets)
  make test-frames VIDEO=/path/to/test.mp4
  make test-colmap
  make test-train

  # --- If everything passes, push to ECR ---
  make push-base
  make push
EOF
    ;;

  terminate)
    if [ ! -f "$STATE_FILE" ]; then
      echo "No instance state found at $STATE_FILE"
      exit 1
    fi
    INSTANCE_ID=$(cat "$STATE_FILE")
    echo "Terminating $INSTANCE_ID..."
    aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$REGION" --output text
    rm -f "$STATE_FILE"
    echo "Terminated."
    ;;

  ssh)
    if [ ! -f "$STATE_FILE" ]; then
      echo "No instance state found — run '$0 launch' first"
      exit 1
    fi
    INSTANCE_ID=$(cat "$STATE_FILE")
    PUBLIC_IP=$(aws ec2 describe-instances \
      --instance-ids "$INSTANCE_ID" \
      --region "$REGION" \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text)
    echo "ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
    ;;

  status)
    if [ ! -f "$STATE_FILE" ]; then
      echo "No instance state found"
      exit 1
    fi
    INSTANCE_ID=$(cat "$STATE_FILE")
    aws ec2 describe-instances \
      --instance-ids "$INSTANCE_ID" \
      --region "$REGION" \
      --query 'Reservations[0].Instances[0].{State:State.Name,IP:PublicIpAddress,Type:InstanceType}' \
      --output table
    ;;

  *)
    usage
    ;;
esac
