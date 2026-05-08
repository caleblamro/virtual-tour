FROM 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker:base

RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

# FastGS: clone with submodules, compile CUDA extensions against our PyTorch 2.3 + CUDA 12.1.
# --recursive pulls diff-gaussian-rasterization_fastgs, simple-knn, fused-ssim.
RUN git clone --depth 1 --recursive https://github.com/fastgs/FastGS.git /opt/fastgs && \
    pip3 install -e /opt/fastgs/submodules/diff-gaussian-rasterization_fastgs \
                 -e /opt/fastgs/submodules/simple-knn \
                 -e /opt/fastgs/submodules/fused-ssim && \
    pip3 install lpipsPyTorch tqdm imageio

COPY scripts/ scripts/
COPY run.sh .
RUN chmod +x run.sh scripts/*.sh

ENTRYPOINT ["./run.sh"]
