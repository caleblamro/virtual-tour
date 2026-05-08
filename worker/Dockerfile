FROM 584916459912.dkr.ecr.us-west-2.amazonaws.com/tour-worker:base

RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

# gsplat training examples (not included in pip package)
RUN git clone --depth 1 https://github.com/nerfstudio-project/gsplat /opt/gsplat && \
    pip3 install imageio lpips tqdm mediapy pyyaml

COPY scripts/ scripts/
COPY run.sh .
RUN chmod +x run.sh scripts/*.sh

ENTRYPOINT ["./run.sh"]
