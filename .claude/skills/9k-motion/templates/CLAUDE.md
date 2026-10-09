# 9k motion studio — house rules

Brief: `docs/brief.md` · Reference grammar: `docs/style_guide.md` · Shots: `docs/shotlist.md` · Review log: `docs/review_log.md`

## Render contract
- The film is a pure function of time: `window.seek(t)` paints frame t. Layout against `W`/`H`, never fixed pixels.
- No CSS transitions, setTimeout, requestAnimationFrame in render mode, or state carried between frames.
- Seeded noise only (`M.rng`), never `Math.random`.
- Stills: `node stills.mjs`. Full: `node render.mjs --w W --h H` (`--alpha` for overlays, `--from/--to` to re-render a range).
- Audio: `node lib/audio.mjs cues.json out/audio.wav`, then `bash scripts/mux.sh out/silent-WxH.mp4 out/audio.wav`.

## Look: the 9k design system, nothing else
- Colors only from `B.C` / `B.F.theme` (lib/brand.js). Never type a raw hex in a scene.
- Fonts: IBM Plex Sans (UI and kinetic type), IBM Plex Serif (one display line), IBM Plex Mono (code and wordmark).
  Arabic uses Thmanyah Sans / Serif Display. Never use Inter, Roboto, Poppins or system defaults.
- Green `#166434` and orange `#E85A02`: only one accent per shot. Text on orange is black.
- The glow is the only gradient, and it is always background. Grain is on by default and seeded.
- Banned: a centered title on a gradient, everything fading in, corner labels or frame borders, glow on UI chrome,
  particle bursts, bouncy or elastic text, neon, and any dead beat longer than 4 s.
- At least one line per film is typed with a caret (`M.typed` / `B.wordmark`). It's the 9k signature.
- Springs: `snappy` for UI, `default` for containers and camera, `heavy` for type and logo, `playful` for Nino only.

## Sound
- Synthesize in code unless a track is supplied (then measure it with `lib/beats.py` → beats.json).
- Typed text gets `type` ticks. Cuts land on beats, and big moments land on downbeats.
- Mix to -14 LUFS, or -20 LUFS for SFX that sit under the user's voiceover.

## Loop before showing anything
1. `bash scripts/review.sh` (stills) or `bash scripts/review.sh out/final.mp4 <fast-action-t>`. **Open the PNGs and look at them.**
2. Score each 1–10: hook in the first 2 s · readability at phone size · motion quality · variety · composition · 9k brand accuracy · sound sync.
3. Log the scores and the 3 worst problems, with timestamps, in `docs/review_log.md`. Fix them and re-render only the affected seconds.
4. Repeat until every score is 8 or higher (minimum 2 rounds, 3 for a flagship). Then do the full render in every format.
