# Montage craft

These are the judgment calls the scripts can't make. Read this before you write the plan.

## 1. Read the footage before you edit it

Open `work/contact.png` and note these four things in the plan:

1. **Face box.** Where the head sits at base zoom (a seated talking head is usually 0.12–0.45 H). The graphics band starts below the chin, and `camera.focus` goes between the eyes.
2. **Burned-in text.** A hook caption or subtitles already in the export. Find its rect and time range by grabbing stills (`node lib/sheet.mjs work/cut.mov /tmp/x.png --at 0.5,2,4,6`). Then hide it with a `hook` that has `cover`, or with a `mask`. Add to `captions.hide` only the stretch where the burned text says the same words he is speaking, because captions would just repeat it. Once he moves past that line, captions run as normal: they sit at 0.72 H, below the cover panel.
3. **Inserts already in the source.** Photos, screenshots and b-roll the creator placed. A 1-per-second sheet finds them: `node lib/sheet.mjs work/cut.mov /tmp/s.png --every 1 --cols 14 --tile 128`. Put their ranges in `captions.hide` and keep your graphics off them.
4. **Framing changes.** A rough cut often alternates framings already. Ingest finds those cuts (`work/scenes.json`), and the camera alternates on them too.

## 2. The cut (raw takes)

`ingest.json.kind` gives a first verdict. A raw take has long pauses, retakes (`⟲` in the transcript) or a slate.

- **Retakes:** keep the **last** complete take of a sentence. Drop from just before the first take's first word to just before the kept take's first word.
- **Flubs and restarts** ("يعني… يعني"): drop the false start and keep the clean run.
- **Off-topic tangents** in a short: drop them and name each one in the plan. If you're unsure, keep it and flag it.
- **Pauses:** `maxPause` 0.3 for shorts. Never drop a breath that leads into a punchline: give that cut `padIn` 0.15.
- **⚠ holes:** ingest already re-transcribes non-silent gaps and piled-up words (`‹word›` in the transcript). Anything still marked `⚠` is speech without words. Listen to the range (`ffplay -ss A -t B work/audio16k.wav`) and caption it with `captions.override` (`{s, e, text}` replaces the words in that range, and they're chunked normally).
- Check every `‹…›` region's edges in the transcript: the second Whisper pass can lose a word or two where its window starts or ends. Restore them with `captions.override`.
- After `cut.mjs`, every time you plan is OUTPUT time. Re-read `work/transcript.cut.md`.

## 3. Fix the transcript (captions are only as good as this)

Whisper medium is weak on Egyptian Arabic mixed with English tech terms. Go through every chunk that `node lib/captions.mjs` prints and fix mishearings in `captions.fixes`. These are typical:

| Whisper wrote | Meant |
|---|---|
| كريستيان / كريسيانو | كريستيانو |
| even you | Evan You |
| الممري | الميموري |
| تريد زوف | Trade-offs |
| ويجة نظر | وجهة نظر |
| أنه framework | أنهي framework |
| react / node (lowercase) | React / Node |
| نود / راست (spoken names) | Node / Rust |

Write tech names the way the brand writes them: `Vue.js`, `Node.js`, `TypeScript`, `Next.js`. Leave the dialect alone: `ملوش`, `عشان` and `هقوله` stay as they are. Fix spelling, not his voice. If more than ~8 % of words need fixing, use a bigger model: if `large-v3-turbo` isn't in `~/.cache/hyperframes/whisper/models/` and you have no standing permission to download it, fix by hand now and recommend the download in the plan's "needs you" line. With permission, download it once (`curl -L -o ~/.cache/hyperframes/whisper/models/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin`); ingest picks the best model it finds.

## 4. Graphics: what goes where

- **Density.** Shorts get one beat every 3–5 s and long-form one every 8–15 s. Never more than one graphic plus the caption on screen at once. Leave 1–2 s gaps so the face carries the line.
- **Trigger on the word.** A graphic's `t` is the start of the word that names it, from `work/words.cut.json` (or 0.1 s before it). Elements inside it (`pointsAt`, `list.at`, `versus.at`, `pickAt`) also land on their words.
- **Choose by what is said:**
  - names a tool → `chips`
  - compares two → `versus`
  - says a number → `stat`
  - lists reasons → `list`
  - asks the audience a question → `card` with a badge
  - "not X but Y" → `retype`
  - a punchline or insult → `emoji` (`^_^ x_x o_o >‿<`, not `-_-`), beside the head
  - "think about it" → `nino thinking`
  - the thesis line, once → `band`
- **Climax.** One `band` (green, ≤ 1.2 s) on the single most important word, with a camera `snap` to 1.25–1.32 on the same frame and a `cut` back on the next jump cut.
- **Hook.** The first 2 s must show something that isn't just the face. If the export already has a burned hook line, restyle it with `hook` + `cover`. Otherwise type the strongest line of the video at the top.
- **End.** Use `tail: 3.2` and an `endcard` (CTA + handle) unless the video ends on a punchline that should cut to black.
- **Placement.** Use the `mid` zone (below the chin) by default. Use `top` only when the face is low or the camera is pushed out. Never put a graphic over the mouth.
- **16:9 placement.** A centred talking head fills the middle of a landscape frame, and every component centres on it by default. Put graphics in a side column instead (`x: 0.79, w: 0.34` beside the head, with `y` ≈ 0.4) and keep one side for the whole film. The lower third, Nino, the band and the end card place themselves.
- **Assets next to the source** (`montage.json.assets`): use them when they fit. A notification sound goes on "someone asked me", a screenshot goes in an `image` card. List any unused ones in the plan.

## 5. Camera rhythm

- `camera.auto` handles jump cuts. Add `snap` keys only on emphasis words, about one every 15–20 s, so they keep their force.
- A `push` (slow 1.0→1.08 over 3–4 s) suits the reflective close of a video.
- Check the punch-in framing doesn't crop the head: `focus[1]` sits near the eyes, and `punch` stays ≤ 1.15 when the head is already near the top.

## 6. Sound

- **SFX** come from the components. Keep them under the voice: when the review sheet says SFX feel loud, lower `sfx.gain` to 0.6 rather than removing them.
- **Music:** none by default under a talking head. If a track is supplied or sits next to the source, use `music` with ducking at gain 0.10–0.16, and never synthesized music.
- **Loudness:** −14 LUFS integrated, true peak ≤ −1.5 dB. `compose.mjs` prints both, so quote them in the delivery.

## 7. Review rubric (score 1–10, fix the 3 worst, at least 2 rounds)

Look at `out/contact.png`, `out/phone.png` and `out/strip.png` and score:

- hook in the first 2 s
- caption accuracy (read every chunk)
- caption readability at phone size
- graphic timing against the words
- face never covered
- 9k brand accuracy
- pacing (no dead stretch over 6 s)
- audio (loudness, SFX not louder than the voice)

Hunt specifically for:

- a burned-in caption peeking out
- Latin text running out of its panel in RTL
- two accents in one chunk or graphic
- a graphic on the mouth
- a caption over a source insert
- a band longer than 1.2 s
- a punch-in that crops the forehead
- whisper words left unfixed

Log each round in `docs/review_log.md`. Re-render a preview of only the broken range with `node scripts/compose.mjs --from A --to B --half`.
