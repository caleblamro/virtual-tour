#!/usr/bin/env python3
"""Train a 3D Gaussian Splat from COLMAP output using gsplat."""
import os
import sys
import shutil
import subprocess


def main():
    colmap_dir = "/work/colmap"
    output_dir = "/work/output"
    os.makedirs(output_dir, exist_ok=True)

    # Use gsplat's simple_trainer CLI
    cmd = [
        "python3", "-m", "gsplat.scripts.simple_trainer",
        "--data_dir", colmap_dir,
        "--data_factor", "1",
        "--result_dir", output_dir,
        "--max_steps", "15000",
        "--save_steps", "15000",
        "--eval_steps", "15000",
        "--disable_viewer",
    ]

    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    # Find the output ply file
    ply_files = []
    for root, dirs, files in os.walk(output_dir):
        for f in files:
            if f.endswith(".ply"):
                ply_files.append(os.path.join(root, f))

    if not ply_files:
        print("ERROR: No .ply file found after training", file=sys.stderr)
        sys.exit(1)

    # Prefer a splat/point_cloud ply over any eval ply if multiple exist
    preferred = [p for p in ply_files if "point_cloud" in os.path.basename(p)]
    chosen = preferred[0] if preferred else ply_files[0]

    dest = "/work/output/point_cloud.ply"
    if os.path.abspath(chosen) != os.path.abspath(dest):
        shutil.copy(chosen, dest)

    print(f"Training complete. PLY saved to {dest} (source: {chosen})")


if __name__ == "__main__":
    main()
