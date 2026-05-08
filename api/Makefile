.PHONY: deploy-createJob deploy-getJob deploy-listJobs deploy-onUpload deploy-all \
        bundle-createJob bundle-getJob bundle-listJobs bundle-onUpload

REGION   ?= us-west-2
DIST     := .dist
FPREFIX  := virtual-tour

# Bundle a single function: make bundle-<name>
bundle-%:
	mkdir -p $(DIST)/$*
	npx esbuild src/$*.ts \
		--bundle \
		--platform=node \
		--target=node20 \
		--external:@aws-sdk/* \
		--sourcemap \
		--outfile=$(DIST)/$*/index.js
	cd $(DIST)/$* && zip -q ../$*.zip index.js index.js.map

# Deploy a single function: make deploy-<name>
deploy-%: bundle-%
	aws lambda update-function-code \
		--region $(REGION) \
		--function-name $(FPREFIX)-$* \
		--zip-file fileb://$(DIST)/$*.zip \
		--output text --query 'FunctionName'
	@echo "  deployed $(FPREFIX)-$*"

# Deploy all four functions in sequence
deploy-all: deploy-createJob deploy-getJob deploy-listJobs deploy-onUpload
	@echo "All Lambda functions deployed."
