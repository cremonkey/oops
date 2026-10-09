# Engine, sound, formats, critique

Adapted from Movez's course "How to build a motion design studio with Opus 5.5" (x.com/0xMovez, Sep 2026). Opus can't emit an MP4. It writes a program, and a headless browser plus ffmpeg turn that program into frames.

## Routes

- **Route A (default):** `index.html` with a canvas and `window.seek(t)`. Playwright captures each frame and ffmpeg encodes it. Zero framework, deterministic, and a fix is a one-line edit plus a re-render. Every file is in `templates/`.
- **Route B:** use this only if the user asks for HyperFrames (HTML + GSAP, via the `hyperframes` skill) or Remotion (React, via `remotion-create`). The questionnaire, references, critique loop and **every token in `brand.md`** still apply. Port the `motion.js` springs and `brand.js` helpers instead of using the framework's default easings.

## Effort

| Job | Effort |
|---|---|
| Small fixes, re-renders | medium |
| A new film | xhigh |
| A flagship launch, where the first 3 s carry it | max |

## Building scenes

- Add one object per shot to `SCENES` (`{from, to, draw(t)}`), with `t` local to the shot.
- Something new happens every 2–4 s, and there is a hook in the first 2 s.
- **A value with several targets** (a cursor, a container's width) is a `M.track(t, [[t0,v0],[t1,v1],…])`: one spring per change. That keeps motion continuous, and you can still render frame 812 without simulating 0–811.
- **UI morph** (the "one shape, never cut" pattern): one container morphs size, radius and fill between product states. Content swaps behind it with `M.swapAlpha`, a cursor (`B.cursor`) drives every change, and the last frame equals the first so it loops.
- **Text inside a morphing box** enters after the morph starts and leaves before the next one.
- Never use `will-change` or CSS scaling on text the camera zooms. Redraw it at the target size.
- **Real product UI only.** Capture it with Playwright (`page.screenshot({clip})`) into `assets/`, load it with `new Image()`, and wait for it in `window.ready`. Crop and animate the real thing inside 9k panels.

## Prompt patterns worth stealing

- **Reference → grammar:** "Take the grammar of the reference, never its content, logos or characters." Extract frames every 0.5 s, then write the palette, type, shot lengths, transitions, camera, texture and text in/out. Then restate color and type in 9k tokens.
- **State-list spec** for UI films, written as `<inputs> <direction> <structure> <build> <gotchas>`. The structure line is a list of states on the beat grid: `logo → CTA → field (typed) → loader → success → card → chart → toast → logo`.
- **Director's brief** for long or overnight films: a one-line logline, references, tools and keys in `.env`, a beat sheet with timestamps, text-on-screen rules, gates (plan → stills → animatic at 960×540 → full → polish → audio → render), the critique loop, and deliverables. Split chapters across subagents only after writing `docs/ANIMATION_GUIDE.md`, so every subagent codes the same style.

## Sound

- **Supplied track:** `python3 lib/beats.py audio/track.wav > beats.json`. Put state changes on `beats`, big moments on `downbeats` and SFX on `hits`. Start on a downbeat.
- **Synthesized:** edit `cues.json` (bpm, sfx list) and run `node lib/audio.mjs cues.json out/audio.wav`. Every typed string gets a `type` cue with the same `cps` the picture uses. Music and SFX sit on separate buses: the music fade before `musicTo` never touches SFX, so an end-card ding after it stays audible. The beat grid is anchored at t = 0, not at `musicFrom`: a late music start still puts bar lines on multiples of 4 beats (every 2 s at 120 BPM), so chord changes land on the act seams.
- **Voice:** if `ELEVENLABS_API_KEY` is in `.env`, generate the VO first and lay the beat grid around it. Never paste keys in prompts.
- **Mix:** `bash scripts/mux.sh out/silent-1080x1920.mp4 out/audio.wav out/final.mp4` (-14 LUFS). For overlays under the user's VO, use `LUFS=-20`.

## Formats

| Format | Size |
|---|---|
| 9:16 | 1080×1920 |
| 16:9 | 1920×1080 |
| 1:1 | 1080×1080 |
| 4:5 | 1080×1350 |

Render each one from the same timeline, with `node render.mjs --w … --h …`. Lay out with `W`, `H`, `rem()` and `portrait` and reframe type per format. Never crop.

**Overlays for the user's videos** (lower thirds, callouts):
1. Render with `node render.mjs --w 1920 --h 1080 --alpha` to get ProRes 4444 `.mov` with transparency, which drops straight into the editor's timeline.
2. Preview it over footage: `ffmpeg -i footage.mp4 -i out/overlay-1920x1080.mov -filter_complex overlay -t 10 out/preview.mp4`.
3. Keep text inside the 90% title-safe area. Lower thirds sit in the bottom-start third, and on the bottom-end third in RTL.

## Critique

Opus reads images, so look at your own frames. Iteration is the method, not a failure.

1. **Before the full render:** run `bash scripts/review.sh`, which gives `out/contact.png` with one still every 0.5 s.
2. **After the render:** run `bash scripts/review.sh out/final.mp4 4.2`, which gives the contact sheet, a phone-size sheet, a 12-frame strip around 4.2 s, the loop check and the poster.
3. **Determinism:** render `--from 2 --to 3` twice and `md5` both outputs. They must match.

Use this prompt on yourself:

> Open out/contact.png, out/phone.png and out/strip.png and look at them properly. Be a harsh motion director, not a proud author.
> Score 1–10 on: hook in the first 2 s · readability at phone size · motion quality · variety · composition · 9k brand accuracy · sound sync.
> List the 3 biggest problems with timestamps.
> Hunt specifically for:
> - text overlapping during swaps
> - anything sliding instead of springing
> - corner labels or frame borders
> - centered-on-gradient shots
> - off-token colors, or two accents in one shot
> - white text on orange
> - blurry scaled text
> - a dead beat
> - a stutter at the loop seam
>
> Fix them, re-render only the affected seconds, and show the new sheet and scores.

Log every round in `docs/review_log.md`.

## Deliver

- `out/final*.mp4`, or `.mov` for overlays, in every format.
- `out/contact.png` and `out/poster.png`.
- The clean source (`index.html`, `lib/`, `cues.json`).
- One line on what you'd improve next.
