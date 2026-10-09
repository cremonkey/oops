# 9k montage — house rules

Source + assets: `montage.json` · Edit decisions: `edit.json` · Plan (the one gate): `docs/plan.md` · Review log: `docs/review_log.md`
Schema and component list: `{{SKILL_DIR}}/references/edit-spec.md` · Craft: `{{SKILL_DIR}}/references/craft.md`

## Pipeline (re-run only what changed)
1. `node scripts/ingest.mjs` → work/transcript.md, words.json, contact.png, ingest.json (raw vs rough verdict)
2. `node scripts/cut.mjs` (edit.json `cut`) → work/cut.mov, transcript.cut.md (OUTPUT time), cuts.json
3. `node lib/captions.mjs` → prints caption chunks; fix `captions.fixes` until every chunk reads right
4. `bash scripts/review.sh` → overlay-over-footage stills every 2 s → out/contact.png. LOOK at it.
5. `node scripts/render-overlay.mjs` → work/overlay/*.png (full transparent overlay)
6. `node scripts/compose.mjs` → out/final-1080x1920.mp4 (`--from a --to b --half` for a quick preview)
7. `bash scripts/review.sh out/final-1080x1920.mp4 <fast-t>` → contact, phone, strip, loudness

## Look: 9k design system only (tokens in lib/brand.js)
- Colors from `B.C` / `B.F.theme`; one accent per shot; text on orange is black; the glow never sits behind captions.
- Arabic: IBM Plex Sans Arabic / Thmanyah. Latin: IBM Plex Sans. Code + wordmark: Plex Mono.
- Springs: snappy (chips, captions), default (cards), heavy (hook, stat), playful (Nino only). No bouncy text.
- Keep everything inside the Shorts safe area: top 8 %, bottom 22 %, right 12 % are covered by platform UI.

## Edit rules
- Every jump cut changes the framing (camera.auto). Never two identical framings across a cut.
- Something new on screen every 2–4 s, but never more than one graphic plus the caption at a time.
- Graphics land ON the word that triggers them (use the word's start time from transcript.cut.md).
- The face stays visible: graphics go in a zone that misses the face (check contact.png), or use `dim`.
