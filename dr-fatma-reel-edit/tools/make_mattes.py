#!/usr/bin/env python3
"""Cut the exact A-roll frames for every behind-text window and matte the subject locally
(HyperFrames remove-background, u2net human segmentation). Output: assets/mattes/<id>.webm (VP9 + alpha)."""
import json, os, subprocess
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs("assets/mattes", exist_ok=True); os.makedirs("work/matte_src", exist_ok=True)
for b in json.load(open("timing-map.json"))["behind_text"]:
    src = f"work/matte_src/{b['id']}.mp4"; out = f"assets/mattes/{b['id']}.webm"
    f0, n = b["src_frame"], b["frames"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "assets/rawreel_1080.mp4", "-an",
                    "-vf", f"select=between(n\\,{f0}\\,{f0 + n - 1}),setpts=N/30/TB", "-r", "30",
                    "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", src], check=True)
    subprocess.run(["npx", "hyperframes", "remove-background", src, "-o", out, "--quality", "best"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(b["id"], n, "frames ->", out, flush=True)
