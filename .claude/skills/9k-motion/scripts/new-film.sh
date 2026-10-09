#!/usr/bin/env bash
# bash <skill>/scripts/new-film.sh <film-dir>
# Scaffolds a 9k film project: seek(t) engine, brand tokens, house rules, local fonts, Playwright.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?usage: new-film.sh <film-dir>}"

mkdir -p "$DIR"/{docs,refs/frames,assets,audio,out,scripts}
cp -n "$SKILL_DIR"/templates/index.html "$SKILL_DIR"/templates/render.mjs "$SKILL_DIR"/templates/stills.mjs \
      "$SKILL_DIR"/templates/cues.json "$DIR"/ 2>/dev/null || true
mkdir -p "$DIR/lib" && cp -n "$SKILL_DIR"/templates/lib/* "$DIR/lib/" 2>/dev/null || true
cp -n "$SKILL_DIR"/templates/CLAUDE.md "$DIR/CLAUDE.md" 2>/dev/null || true
cp -n "$SKILL_DIR"/templates/brief.md "$DIR/docs/brief.md" 2>/dev/null || true
cp "$SKILL_DIR"/scripts/review.sh "$SKILL_DIR"/scripts/mux.sh "$DIR/scripts/"

cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm i -D --silent playwright \
  @fontsource/ibm-plex-sans @fontsource/ibm-plex-serif @fontsource/ibm-plex-mono @fontsource/ibm-plex-sans-arabic
npx playwright install chromium >/dev/null

# Thmanyah (Arabic) is not on npm: use it if installed, otherwise IBM Plex Sans Arabic is the fallback.
if ! ls ~/Library/Fonts /Library/Fonts 2>/dev/null | grep -qi thmanyah; then
  echo "note: Thmanyah fonts not installed — Arabic will use IBM Plex Sans Arabic."
fi
python3 -c "import librosa" 2>/dev/null || echo "note: for supplied tracks run: pip install numpy librosa soundfile"
echo "film scaffolded in $DIR — open index.html for a live preview."
