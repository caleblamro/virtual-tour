#!/usr/bin/env python3
"""Train a 3D Gaussian Splat from COLMAP output using gsplat."""
import os
import re
import sys
import shutil
import subprocess


def main():
    colmap_dir = "/work/colmap"
    output_dir = "/work/output"
    os.makedirs(output_dir, exist_ok=True)

    # 10k steps: good visual quality for home walkthroughs in ~20–30 min on g4dn.xlarge
    cmd = [
        "python3", "/opt/gsplat/examples/simple_trainer.py", "default",
        "--data_dir", colmap_dir,
        "--data_factor", "1",
        "--result_dir", output_dir,
        "--max_steps", "10000",
        "--save_steps", "10000",
        "--eval_steps", "10000",
        "--disable_viewer",
    ]

    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    # Find the output ply file — gsplat names them splat_<step>.ply
    ply_files = []
    for root, dirs, files in os.walk(output_dir):
        for f in files:
            if f.endswith(".ply"):
                ply_files.append(os.path.join(root, f))

    if not ply_files:
        print("ERROR: No .ply file found after training", file=sys.stderr)
        sys.exit(1)

    # Prefer the checkpoint splat over any eval/pointcloud ply
    preferred = [p for p in ply_files if re.search(r'splat_\d+\.ply', os.path.basename(p))]
    chosen = preferred[0] if preferred else ply_files[0]

    dest = "/work/output/point_cloud.ply"
    if os.path.abspath(chosen) != os.path.abspath(dest):
        shutil.copy(chosen, dest)

    print(f"Training complete. PLY saved to {dest} (source: {chosen})")


if __name__ == "__main__":
    main()
