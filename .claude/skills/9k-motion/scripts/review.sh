#!/usr/bin/env bash
# bash scripts/review.sh [video] [fast-action-time]
# Builds the sheets the critique loop looks at. Without a video it renders stills only (pre-render check).
set -euo pipefail
V="${1:-}"; T="${2:-}"
mkdir -p out

if [ -z "$V" ]; then
  node stills.mjs --every 0.5
  exit 0
fi

# Contact sheet: 2 frames per second, 6 across
ffmpeg -y -loglevel error -i "$V" -vf "fps=2,scale=270:-1,tile=6x5" -frames:v 1 out/contact.png
# Phone test: how it reads at 360 px wide
ffmpeg -y -loglevel error -i "$V" -vf "fps=1,scale=360:-1,tile=5x3" -frames:v 1 out/phone.png
# Strip: 12 consecutive frames around a fast action (catch pops, overlaps, text collisions)
if [ -n "$T" ]; then
  ffmpeg -y -loglevel error -ss "$(echo "$T - 0.1" | bc)" -i "$V" -vf "scale=320:-1,tile=12x1" -frames:v 1 out/strip.png
fi
# Loop check: play it twice back to back, watch the seam
ffmpeg -y -loglevel error -stream_loop 1 -i "$V" -c copy out/loop_check.mp4
# Poster: the strongest frame is usually the end of the hook — override with POSTER_T
ffmpeg -y -loglevel error -ss "${POSTER_T:-1.8}" -i "$V" -frames:v 1 out/poster.png
echo "sheets: out/contact.png out/phone.png ${T:+out/strip.png }out/loop_check.mp4 out/poster.png"
