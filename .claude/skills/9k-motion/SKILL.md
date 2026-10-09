---
name: 9k-motion
description: Use for any motion graphic in the 9k house style (ismail9k / 9k / the9klabs) — animation, animated segment, title card, lower third, intro, outro, end card, launch video, product promo, ad, showreel or explainer clip, whether it goes inside a 9k video or promotes a product. Also use when someone says "animate this", "make a promo", or "motion design" in a 9k project. Runs before hyperframes, remotion-create or motion-design. When existing footage of the creator is handed over to edit (montage, captions, cuts), use 9k-montage instead.
---

# 9k Motion

## Overview

You run a small motion studio for the 9k brand. The prompt is 10% of the film; the harness is the other 90%. Every film starts with a **questionnaire**, always asks for **references**, and is styled **only** from the 9k design system (design.the9klabs.com).

**These three are the user's standing order. They are not ceremony.** Following them to the letter is following them in spirit.

## The Iron Rules

1. **Questionnaire first.** Before any file, fetch, storyboard or code, run the questionnaire in `references/questionnaire.md`: three batched rounds, recommended options listed first. Urgency ("need it today"), a detailed first message, and the memory note about asking fewer questions **do not** skip it. If the first message already answers a question, show that answer as the pre-selected first option instead of dropping the question.
2. **Always ask for references.** Round 3 always asks for references. "None" is a valid answer, and then the 9k house style is the reference. Never assume there are none.
3. **9k style guide only.** Take every color, font, radius, shadow and easing from `references/brand.md`. Never fall back to Inter, violet, teal, a generic gradient or a stock palette. References set **pacing, transitions, camera and composition**. 9k sets **color, type and shape**. When they conflict, 9k wins.

## Workflow

1. **Questionnaire** (`references/questionnaire.md`): Round 1 covers what we're making, Round 2 branches on video segment vs product promo, and Round 3 collects references and content.
2. **Brief.** Copy `templates/brief.md` to `docs/brief.md` and fill it in from the answers.
3. **Scaffold.** Run `bash <skill>/scripts/new-film.sh <dir>`. It copies the engine, brand tokens, house rules (`CLAUDE.md`) and fonts.
4. **References → `docs/style_guide.md`.** Extract frames from each video reference (`ffmpeg -i ref.mp4 -vf fps=2 refs/frames/%03d.png`) and look at them. Write down its grammar: shot lengths, transitions, camera, how text enters and exits. Then restate every color and type decision in 9k tokens.
5. **Assets.** For a promo, capture the real product UI with Playwright into `assets/` and list what you found. Never redraw UI from imagination.
6. **Sound.** Measure a supplied track (`python3 lib/beats.py track.wav > beats.json`) or plan synthesized music and SFX on a BPM grid.
7. **Shot list on the beat grid → `docs/shotlist.md`.** Show it. **This is the only approval gate.** Wait for OK.
8. **Build** `index.html` with `window.seek(t)` using `lib/motion.js` and `lib/brand.js`. Use route A by default. Use HyperFrames or Remotion only if the user asked for it, and still use the `brand.md` tokens.
9. **Critique loop** (`references/engine.md#critique`): run `bash scripts/review.sh`, look at the sheets and score them. Fix the 3 worst problems. Do at least 2 rounds, and continue until every score is 8 or higher.
10. **Render and deliver** every requested format, plus `contact.png` and `poster.png`. Give one line on what you'd improve next.

## Quick Reference

| Need | Where |
|---|---|
| Questions, branching, defaults | `references/questionnaire.md` |
| Colors, type, shapes, motion language, Nino, glow, wordmark | `references/brand.md` |
| seek(t) engine, springs, sound, overlays, formats, critique | `references/engine.md` |
| Engine files | `templates/` (copied by `scripts/new-film.sh`) |

## Red Flags: stop and go back to the questionnaire

- "They said it's urgent, so I'll pick defaults and build."
- "Memory says to stop asking questions." That note is about design-review gates. This questionnaire is what the user explicitly asked for, so run it, batched.
- "I'll ask about references later or skip it." Ask in Round 3, every time.
- "I'll sample colors from the product site." Use 9k tokens. Product UI screenshots stay as they are, inside 9k frames.
- "Inter / a violet accent / a `back.out` bounce looks good." It isn't 9k, so don't use it.
- "I'll render the full film, then check it." Run the contact sheet and critique first.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Centered title on a gradient, everything fading in | Kinetic type with springs. Something new every 2–4 s. |
| Two accents in one shot | Each shot gets either green or orange. The glow is the only blend of the two. |
| Orange button with white text | `--on-accent-color` is black. |
| Bouncy text | No overshoot on type. Tiny overshoot on UI only. |
| `Math.random`, CSS transitions, timers | Use seeded `M.rng` and pure functions of `t`. |
| Cropping 16:9 down to 9:16 | Lay out against `W`/`H` and re-render each format. |
| Arabic in Plex Sans | Use `FONTS.arSans` / `FONTS.arDisplay`, mirror the layout, and set `dir: 'rtl'`. |
