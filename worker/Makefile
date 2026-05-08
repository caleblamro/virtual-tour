.PHONY: build push build-base push-base test-worker \
        test-frames test-colmap test-train test-transform

ECR_URI    ?= 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker
CHECKPOINT ?= /tmp/tour-checkpoint

ecr-login:
	aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $(ECR_URI)

build-base:
	docker build --platform linux/amd64 -f Dockerfile.base -t $(ECR_URI):base .

push-base: build-base ecr-login
	docker push $(ECR_URI):base

build: ecr-login
	docker build --platform linux/amd64 -t $(ECR_URI):latest .

push: build
	docker push $(ECR_URI):latest

test-worker:
	@if [ -z "$(VIDEO)" ]; then echo "Usage: make test-worker VIDEO=path/to/video.mp4"; exit 1; fi
	mkdir -p /tmp/tour-test-out
	docker run --gpus all --rm \
		-e JOB_ID=test-local-001 \
		-e INPUT_S3_URI=file:///input.mp4 \
		-e OUTPUT_S3_PREFIX=test-local-001 \
		-e JOBS_TABLE=local \
		-e OUTPUTS_BUCKET=local \
		-e LOCAL_MODE=1 \
		-v "$(VIDEO):/input.mp4:ro" \
		-v "/tmp/tour-test-out:/work/final" \
		$(ECR_URI):latest
	@echo "Output in /tmp/tour-test-out/"
	@ls -lh /tmp/tour-test-out/

# ── Stage-isolated targets ────────────────────────────────────────────────────
# Each stage mounts $(CHECKPOINT) as /work so intermediate files persist
# between runs. Run in order the first time; re-run any single stage to
# iterate without redoing earlier steps.
#
#   make test-frames VIDEO=~/clip.mp4   # ~10s
#   make test-colmap                     # ~10 min — checkpoint reused after
#   make test-train                      # ~20 min — checkpoint reused after
#   make test-transform                  # ~30s

test-frames:
	@[ -n "$(VIDEO)" ] || (echo "Usage: make test-frames VIDEO=path/to/video.mp4"; exit 1)
	mkdir -p $(CHECKPOINT)/frames
	cp "$(VIDEO)" $(CHECKPOINT)/input.mp4
	docker run --rm \
		-v "$(CHECKPOINT):/work" \
		--entrypoint bash $(ECR_URI):latest /app/scripts/extract_frames.sh
	@echo "Frames saved to $(CHECKPOINT)/frames/"

test-colmap:
	@[ -d "$(CHECKPOINT)/frames" ] || (echo "No frames found — run make test-frames first"; exit 1)
	docker run --gpus all --rm \
		-v "$(CHECKPOINT):/work" \
		--entrypoint bash $(ECR_URI):latest /app/scripts/run_colmap.sh
	@echo "COLMAP output saved to $(CHECKPOINT)/colmap/"

test-train:
	@[ -d "$(CHECKPOINT)/colmap" ] || (echo "No COLMAP output found — run make test-colmap first"; exit 1)
	docker run --gpus all --rm \
		-v "$(CHECKPOINT):/work" \
		--entrypoint python3 $(ECR_URI):latest /app/scripts/train_gsplat.py
	@echo "PLY saved to $(CHECKPOINT)/output/point_cloud.ply"

test-transform:
	@[ -f "$(CHECKPOINT)/output/point_cloud.ply" ] || (echo "No PLY found — run make test-train first"; exit 1)
	mkdir -p $(CHECKPOINT)/final
	docker run --rm \
		-v "$(CHECKPOINT):/work" \
		--entrypoint bash $(ECR_URI):latest /app/scripts/transform.sh
	@echo "Final output in $(CHECKPOINT)/final/"
	@ls -lh $(CHECKPOINT)/final/
