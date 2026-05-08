#!/usr/bin/env python3
"""Train a 3D Gaussian Splat from COLMAP output using FastGS."""
import os
import re
import sys
import shutil
import subprocess


def main():
    colmap_dir = "/work/colmap"
    output_dir = "/work/output"
    os.makedirs(output_dir, exist_ok=True)

    # FastGS: CVPR 2026, ~100s training vs 20-30 min for vanilla 3DGS.
    # -s: scene dir with images/ and sparse/0/ (produced by run_colmap.sh)
    # -i: image subfolder name inside -s
    # -m: where to write checkpoints and the final point_cloud.ply
    cmd = [
        "python3", "/opt/fastgs/train.py",
        "-s", colmap_dir,
        "-i", "images",
        "-m", output_dir,
        "--optimizer_type", "default",
        "--densification_interval", "500",
        "--iterations", "30000",
        "--save_iterations", "30000",
        "--test_iterations", "30000",
    ]

    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    # FastGS saves: <model_path>/point_cloud/iteration_<N>/point_cloud.ply
    ply_files = []
    for root, dirs, files in os.walk(output_dir):
        for f in files:
            if f.endswith(".ply"):
                ply_files.append(os.path.join(root, f))

    if not ply_files:
        print("ERROR: No .ply file found after training", file=sys.stderr)
        sys.exit(1)

    def parse_iteration(path):
        m = re.search(r'iteration_(\d+)', path)
        return int(m.group(1)) if m else -1

    chosen = max(ply_files, key=parse_iteration)

    dest = "/work/output/point_cloud.ply"
    if os.path.abspath(chosen) != os.path.abspath(dest):
        shutil.copy(chosen, dest)

    print(f"Training complete. PLY saved to {dest} (source: {chosen})")


if __name__ == "__main__":
    main()
