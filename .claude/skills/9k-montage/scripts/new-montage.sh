#!/usr/bin/env bash
# bash <skill>/scripts/new-montage.sh <video> [project-dir]
# Scaffolds a montage project for one video: pipeline scripts, 9k engine + brand (from the sibling 9k-motion
# skill), overlay components, house rules, local fonts, Playwright, simple-icons. Links the source and any
# usable assets that sit next to it (sounds, images, music) into assets/.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
MOTION_DIR="$(cd "$SKILL_DIR/../9k-motion" 2>/dev/null && pwd -P || true)"
[ -d "$MOTION_DIR/templates/lib" ] || MOTION_DIR="$(cd ~/.claude/skills/9k-motion && pwd -P)"
SRC="$(cd "$(dirname "${1:?usage: new-montage.sh <video> [project-dir]}")" && pwd -P)/$(basename "$1")"
[ -f "$SRC" ] || { echo "no such video: $SRC"; exit 1; }
SLUG="$(basename "$(dirname "$SRC")" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')"
DIR="${2:-$HOME/films/montage-$SLUG}"

mkdir -p "$DIR"/{docs,assets,work,out,lib,scripts}
cp "$SKILL_DIR"/scripts/{ingest,cut,render-overlay,compose}.mjs "$SKILL_DIR"/scripts/review.sh "$DIR/scripts/"
cp "$MOTION_DIR"/templates/lib/{motion.js,brand.js,audio.mjs} "$DIR/lib/"
cp "$SKILL_DIR"/templates/lib/* "$DIR/lib/"
cp -n "$SKILL_DIR"/templates/overlay.html "$DIR/" 2>/dev/null || true
[ -f "$DIR/CLAUDE.md" ] || sed "s|{{SKILL_DIR}}|$SKILL_DIR|g" "$SKILL_DIR"/templates/CLAUDE.md > "$DIR/CLAUDE.md"
cp -n "$SKILL_DIR"/templates/plan.md "$DIR/docs/plan.md" 2>/dev/null || true
cp -n "$SKILL_DIR"/templates/edit.json "$DIR/edit.json" 2>/dev/null || true

# Usable assets next to the source: sounds, music, images. Raw takes (.mov/.mp4) are listed, not linked.
ASSETS=(); OTHER=()
while IFS= read -r -d '' f; do
  case "$(echo "${f##*.}" | tr '[:upper:]' '[:lower:]')" in
    mp3|wav|m4a|aac|png|jpg|jpeg|webp|gif|svg) ln -sfn "$f" "$DIR/assets/$(basename "$f")"; ASSETS+=("assets/$(basename "$f")") ;;
    mov|mp4|m4v) [ "$f" != "$SRC" ] && OTHER+=("$f") ;;
  esac
done < <(find "$(dirname "$SRC")" -maxdepth 1 -type f ! -name '.*' -print0)

json_list() { local first=1; printf '['; for x in "$@"; do [ $first = 1 ] || printf ','; first=0; printf '"%s"' "$x"; done; printf ']'; }
[ -f "$DIR/montage.json" ] || cat > "$DIR/montage.json" <<EOF
{
  "source": "$SRC",
  "lang": "auto",
  "prompt": "",
  "assets": $(json_list ${ASSETS[@]+"${ASSETS[@]}"}),
  "otherVideos": $(json_list ${OTHER[@]+"${OTHER[@]}"})
}
EOF

cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm i -D --silent playwright simple-icons \
  @fontsource/ibm-plex-sans @fontsource/ibm-plex-serif @fontsource/ibm-plex-mono @fontsource/ibm-plex-sans-arabic
npx playwright install chromium >/dev/null
command -v whisper-cli >/dev/null || echo "note: whisper-cli missing — brew install whisper-cpp"
echo "montage project in $DIR"
echo "next: cd \"$DIR\" && node scripts/ingest.mjs"
