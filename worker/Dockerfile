FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    git wget curl ffmpeg python3 python3-pip nodejs npm \
    build-essential cmake libgoogle-glog-dev libgflags-dev \
    libatlas-base-dev libeigen3-dev libsuitesparse-dev \
    libboost-all-dev libfreeimage-dev libmetis-dev \
    colmap awscli \
    && rm -rf /var/lib/apt/lists/*

# PyTorch + gsplat
RUN pip3 install --upgrade pip && \
    pip3 install torch==2.3.0 torchvision --index-url https://download.pytorch.org/whl/cu121 && \
    pip3 install gsplat nerfview viser tyro pillow numpy boto3

# splat-transform (playcanvas CLI)
RUN npm install -g @playcanvas/splat-transform

WORKDIR /app
COPY scripts/ scripts/
COPY run.sh .
RUN chmod +x run.sh scripts/*.sh

ENTRYPOINT ["./run.sh"]
