#!/usr/bin/env bash
# bash scripts/review.sh [video] [fast-action-time]
# The sheets the critique loop looks at.
#   no args   → overlay-over-footage stills every 2 s (fast, before any full render): out/contact.png
#   video [T] → contact sheet with timestamps, phone-size sheet, 12-frame strip around T, loudness, poster
set -euo pipefail
V="${1:-}"; T="${2:-}"
mkdir -p out
if [ -z "$V" ]; then node scripts/render-overlay.mjs --stills "${EVERY:-2}"; exit 0; fi

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
node lib/sheet.mjs "$V" out/contact.png --n 30 --cols 6 --tile 270 >/dev/null
ffmpeg -y -loglevel error -i "$V" -vf "fps=1/$(echo "$DUR / 15" | bc -l),scale=360:-2,tile=5x3" -frames:v 1 out/phone.png
if [ -n "$T" ]; then
  ffmpeg -y -loglevel error -ss "$(echo "$T - 0.2" | bc)" -i "$V" -vf "scale=240:-2,tile=12x1" -frames:v 1 out/strip.png
fi
ffmpeg -y -loglevel error -ss "${POSTER_T:-1.5}" -i "$V" -frames:v 1 out/poster.png
LOUD=$(ffmpeg -hide_banner -i "$V" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' ' | tr '\n' ' ')
echo "sheets: out/contact.png out/phone.png ${T:+out/strip.png }out/poster.png · loudness:$LOUD"
