.PHONY: build push test-worker

ECR_URI ?= 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker

build:
	docker build -t tour-worker .

push: build
	aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $(ECR_URI)
	docker tag tour-worker:latest $(ECR_URI):latest
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
		tour-worker
	@echo "Output in /tmp/tour-test-out/"
	@ls -lh /tmp/tour-test-out/
