#!/usr/bin/env bash
# bash scripts/mux.sh <silent.mp4|overlay.mov> <audio.wav> [out/final.mp4]
# Mixes picture + audio, two-pass loudness-normalised to -14 LUFS (YouTube/social target).
# SFX that sit under the user's voiceover: LUFS=-20 bash scripts/mux.sh ...
set -euo pipefail
V="${1:?video}"; A="${2:?audio}"; OUT="${3:-out/final.mp4}"; LUFS="${LUFS:--14}"
case "$OUT" in
  *.mov) ACODEC=(-c:a pcm_s16le) ;;
  *)     ACODEC=(-c:a aac -b:a 256k) ;;
esac

# Gentle limiter first so synthesized transients do not cap the gain
PRE="alimiter=limit=0.5:attack=2:release=40:level=disabled"
# Pass 1: measure
M=$(ffmpeg -hide_banner -i "$A" -af "${PRE},loudnorm=I=${LUFS}:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
val() { echo "$M" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
# Pass 2: apply linearly with measured values
AF="${PRE},loudnorm=I=${LUFS}:TP=-1.5:LRA=11:measured_I=$(val input_i):measured_TP=$(val input_tp):measured_LRA=$(val input_lra):measured_thresh=$(val input_thresh):offset=$(val target_offset):linear=true,aresample=48000"

ffmpeg -y -loglevel error -i "$V" -i "$A" -map 0:v -map 1:a -c:v copy "${ACODEC[@]}" -af "$AF" -shortest "$OUT"
echo "→ $OUT"
