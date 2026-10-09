---
name: 9k-montage
description: Use when a creator hands over a video of themselves to edit in the 9k house style (ismail9k / 9k) — "do the montage", "edit this video", "مونتاج", "cut this", "add captions / motion graphics / zooms / SFX to my video", "package my short" — whether it's raw takes or a rough cut, a 9:16 short or 16:9 long-form. Use this instead of 9k-motion, talking-head-recut or hyperframes whenever existing talking-head footage is the input.
---

# 9k Montage

## Overview

You are the editor. A video goes in, and a finished 9k montage comes out: tightened cut, jump-cut punch-ins, word-by-word captions, 9k motion graphics on the right words, SFX, loudness, end card. The pipeline is scripted. Your job is the judgment: what to cut, what the words really are, which graphic goes on which word, and an honest critique of your own frames.

**One gate only.** You ask the user nothing before the plan. Read the footage, decide, write `docs/plan.md`, and wait for "OK". After the OK, render, self-review, fix, and deliver without asking again.

Styling comes from 9k-motion (`references/brand.md` there: colors, type, springs). This skill does not run 9k-motion's questionnaire: a montage has its brief inside the footage.

## Workflow

1. **Scaffold:** `bash <skill>/scripts/new-montage.sh "<video>" [project-dir]` (`<skill>` is this skill's base directory) creates the project (default `~/films/montage-<folder-slug>/`). Then `cd` into it. It links sounds and images found next to the video into `assets/`. Never write into the source folder until delivery.
2. **Ingest:** `node scripts/ingest.mjs` (add `--lang ar` for Arabic). Read `work/transcript.md` and `work/ingest.json`, and **look at** `work/contact.png`. Follow `references/craft.md` §1: face box, burned-in text, inserts already in the source, framing.
3. **Cut:** write `edit.json` → `cut` (drops for retakes and flubs on raw takes; just tightening on rough cuts) and `tail` (3.2 for an end card, decided now because cut.mjs applies it), then run `node scripts/cut.mjs`. From here on, every time is OUTPUT time from `work/transcript.cut.md`.
4. **Transcript:** run `node lib/captions.mjs`, fix every misheard word in `captions.fixes`, and set `keywords`. Repeat until every chunk reads right (craft §3).
5. **Design the edit:** fill in `camera`, `graphics` (with the `endcard` at the start of the tail) and `audio`. Schema: `references/edit-spec.md`. Choices: craft §4–6. Then run `bash scripts/review.sh` for overlay-over-footage stills every 2 s, look at them, and fix anything obvious.
6. **Plan → GATE:** fill in `docs/plan.md` with source facts, cut summary, transcript fixes, and the beat table (time · words · caption accent · graphic · camera · sound). Show it, together with `out/contact.png`. **Wait for OK.** Apply any notes, then continue without asking again.
7. **Render:** `node scripts/render-overlay.mjs`, then `node scripts/compose.mjs`.
8. **Critique loop:** run `bash scripts/review.sh out/final-1080x1920.mp4 <climax-t>`. Open contact, phone and strip, score them with the rubric in craft §7, fix the 3 worst problems, and re-render. Do at least 2 rounds. Log each round in `docs/review_log.md`.
9. **Deliver:** copy the final next to the source as `<name>-9k.mp4`. Never overwrite the source. Report the path, duration (before → after), LUFS, what you fixed in critique, and one line on what you'd improve next.

## Quick reference

| Need | Where |
|---|---|
| Every edit.json key, all 16 graphic types | `references/edit-spec.md` |
| Cut rules, whisper fixes, graphic choice and placement, sound, review rubric | `references/craft.md` |
| 9k colors, type, springs, Nino, wordmark | `<skill>/../9k-motion/references/brand.md` |
| Live preview of overlay over footage | open `overlay.html` in Chrome (scrub the video) |
| Quick preview of one range | `node scripts/compose.mjs --from 15 --to 25 --half` |
| Labelled frames from any video | `node lib/sheet.mjs <video> out.png --every 1` |

Timing: on Apple Silicon, ingest takes ~20 s and cut ~60 s per 100 s of 4K. Overlay takes ~6 s, and compose ~50 s.

## Red flags: stop

| Thought | Reality |
|---|---|
| "Let me run the 9k-motion questionnaire / ask about music, captions, CTA first" | No questions before the plan. Defaults and the evidence in the footage decide, and the plan gate is where he corrects you |
| "A 4 s gap in the words means a pause I can cut" | Whisper skips speech. Cuts come from measured silence (`cut.mjs` does this). Read the `⚠` lines |
| "The transcript is close enough" | Every misheard tech name ends up on screen in orange. Fix every chunk |
| "I'll put captions where they always go" | Burned-in text and source photos are already on screen there. Hide those ranges, or cover them |
| "Graphics at the top look clean" | His face is at the top. Use the band below the chin |
| "More graphics = more motion" | One graphic plus the caption at a time, a beat every 3–5 s, one band per film |
| "I'll build captions by hand in a canvas scene" | `captions.mjs` + `overlay.js` already do RTL/LTR runs, proclitic splits and keyword pills |
| "I rendered it, so it's done" | It isn't done until you've looked at the review sheets for 2 rounds |
| "Sample the logo's colours / use Inter" | 9k tokens only. Logos are monochrome by default (`iconColor: 'brand'` only if he asks) |

## Common mistakes

| Mistake | Fix |
|---|---|
| Planning graphics in source time, then cutting | Cut first. Plan from `transcript.cut.md` |
| A graphic lands before or after its word | Use the word's `s` from `work/words.cut.json` |
| Latin label overflowing a panel in an RTL film | Components fit labels automatically. Shorten the label if it still overflows |
| The burned-in hook line peeks out under the new hook | `hook.cover` = the exact rect, padded by 1–2 % |
| Synth music under his voice | No music unless a track is supplied, and then ducked |
| 16:9 graphics centred on his chest | Give them a side column: `x: 0.79, w: 0.34` (craft §4) |
| Editing edit.json and re-running only compose | Check the re-run table in edit-spec.md (captions/graphics need `render-overlay.mjs`) |
