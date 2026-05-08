FROM 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker:base

RUN apt-get update && apt-get install -y xvfb ninja-build && rm -rf /var/lib/apt/lists/*

# Tell PyTorch which CUDA architectures to compile for.
# Without this, the build queries the GPU at compile time — which doesn't exist
# inside docker build, causing an IndexError crash.
# 7.5=T4, 8.6=A10G, 8.9=L4 — covers all current Batch GPU instance types.
ENV TORCH_CUDA_ARCH_LIST="7.5;8.6;8.9"

# FastGS CUDA extensions
RUN git clone --depth 1 --recursive https://github.com/fastgs/FastGS.git /opt/fastgs && \
    pip3 install --no-build-isolation \
                 /opt/fastgs/submodules/diff-gaussian-rasterization_fastgs \
                 /opt/fastgs/submodules/simple-knn \
                 /opt/fastgs/submodules/fused-ssim

# lpipsPyTorch repo no longer exists — use lpips from PyPI with a compatibility shim
RUN pip3 install lpips tqdm imageio
COPY lpipsPyTorch/ /usr/local/lib/python3.10/dist-packages/lpipsPyTorch/

COPY scripts/ scripts/
COPY run.sh .
RUN chmod +x run.sh scripts/*.sh

ENTRYPOINT ["./run.sh"]
