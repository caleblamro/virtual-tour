# Virtual Tour Pipeline

Record a walkthrough video → GPU processes it into a walkable 3D Gaussian Splat → view in browser/WebView.

## Quick Start

### 1. Bootstrap CDK (once per account/region)
```bash
npx cdk bootstrap aws://584916459912/us-west-2
```

### 2. Deploy infra
```bash
cd infra && npm install && npx cdk deploy
```

Note the outputs:
- `ApiUrl` → set as `EXPO_PUBLIC_API_URL` in `mobile/.env`
- `EcrRepositoryUri` → used in worker push step

### 3. Build & push worker image (requires Docker + NVIDIA GPU locally, or use EC2)
```bash
cd worker
make build
ECR_URI=<EcrRepositoryUri from above> make push
```

### 4. Update CDK with real worker image
Edit `infra/lib/virtual-tour-stack.ts`, find the `CfnJobDefinition` and change:
```ts
image: 'public.ecr.aws/lambda/provided:al2'
```
to:
```ts
image: `${ecrRepo.repositoryUri}:latest`
```
Then `cdk deploy` again.

### 5. Run mobile app
```bash
cd mobile
cp .env.example .env
# fill in EXPO_PUBLIC_API_URL
npx expo start
```

## Architecture

```
Phone → S3 (upload) → Lambda (onUpload) → Batch (GPU worker)
                                              ↓
                        ffmpeg → COLMAP → gsplat → splat-transform
                                              ↓
                              S3 (outputs) → CloudFront → WebView viewer
```

## Cost estimate
- Per scan: ~$0.20–$0.50 (g5.xlarge spot, ~15 min)
- Monthly fixed: ~$1–3

## Viewer
Tours are viewed via [SuperSplat](https://superspl.at/viewer/) — the mobile app opens a WebView
pointing at `https://superspl.at/viewer/?content=<sog_url>&collision=<collision_url>`.

The collision mesh enables "ghost walk" mode (fly camera respects walls).
