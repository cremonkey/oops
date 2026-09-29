#!/usr/bin/env bash
# Combine a rendered video track with audio/mix.wav into the final deliverable.
# usage: build/mux.sh out/video_captions.mp4 out/nexus-crm-promo.mp4
set -euo pipefail
FF=${FFMPEG:-ffmpeg}
"$FF" -v error -y -i "$1" -i "$(dirname "$0")/../audio/mix.wav" -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -t 60 -movflags +faststart "$2"
echo "wrote $2"
