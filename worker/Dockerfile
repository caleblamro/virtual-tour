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

# lpipsPyTorch repo no longer exists — install the PyPI equivalent and shim the import
RUN pip3 install lpips tqdm imageio && \
    python3 -c "
import site, os
d = site.getsitepackages()[0] + '/lpipsPyTorch'
os.makedirs(d, exist_ok=True)
open(d + '/__init__.py', 'w').write('''
import torch, lpips as _l
_cache = {}
def lpips(x, y, net=\"alex\", normalize=False):
    key = (net, str(x.device))
    if key not in _cache:
        _cache[key] = _l.LPIPS(net=net).to(x.device)
    fn = _cache[key]
    if normalize:
        x, y = 2*x - 1, 2*y - 1
    return fn(x, y)
'''.strip())
"

COPY scripts/ scripts/
COPY run.sh .
RUN chmod +x run.sh scripts/*.sh

ENTRYPOINT ["./run.sh"]
