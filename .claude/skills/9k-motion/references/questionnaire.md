# Questionnaire

There are three rounds. Rounds 1 and 2 each go in one `AskUserQuestion` call (four questions maximum, recommended option first, labelled "(Recommended)"). Round 3 is a single plain-text message, because references and copy are free text. Don't add a fourth round. Anything still open after Round 3 gets a 9k default, which you note in `docs/brief.md`.

If the user's first message already answers a question, keep the question and make their answer the first option, labelled "(from your message)". They confirm it with one click.

## Round 1: what are we making

| # | header | question | options (first = recommended) | multi |
|---|---|---|---|---|
| 1 | Purpose | What is this motion graphic for? | **Video segment**: a piece that goes inside one of my videos · **Product promo**: launch film, ad or teaser for a product · **Brand piece**: channel intro, sting or showreel · **Explainer**: a data or process story that stands alone | no |
| 2 | Format | Where will it play? | 16:9 YouTube/landscape · 9:16 Shorts/Reels/TikTok · 1:1 feed · 4:5 feed | yes |
| 3 | Length | How long? | 15–20 s · ≤10 s sting · 30–45 s · 60 s+ | no |
| 4 | Sound | What about sound? | **Synthesize** the score and SFX in code · I'll supply a track · SFX only, under my voiceover · Silent | no |

For **Video segment**, recommend "SFX only" for Sound, because the segment sits under the voiceover.

## Round 2: branch on Purpose

### Video segment (or Explainer)

| # | header | question | options |
|---|---|---|---|
| 1 | Segment | Which kind of segment? | Title / chapter card · Lower third or callout over footage · Explainer insert (diagram, data, steps) · Outro / end card |
| 2 | Background | How does it sit in the video? | **Transparent overlay** on my footage (ProRes 4444 with alpha) · Full frame, dark · Full frame, light · Green band (`--primary-color` full bleed) |
| 3 | Language | Which language is on screen? | English (LTR) · Arabic (RTL) · Bilingual |
| 4 | Brand bits | Which 9k elements should appear? (multi) | Typing wordmark Ismail9k → 9k · Nino mascot · Ambient glow / grain · `#tags` and badges |

For a lower third, recommend "Transparent overlay". For a title card, recommend "Full frame, dark".

### Product promo (or Brand piece)

| # | header | question | options |
|---|---|---|---|
| 1 | Structure | Which story shape? | **Classic**: hook → product → 3 features → proof number → CTA · **UI morph loop**: one shape that never cuts and morphs through product states · **Feature showcase**: one feature per beat · **Teaser**: hook and logo only |
| 2 | Theme | Which canvas? | Dark (`#0F0F0F`) · Light (`#FAFAFA`) · Green band · Mixed: dark, with a green-band climax |
| 3 | Language | Which language is on screen? | English (LTR) · Arabic (RTL) · Bilingual |
| 4 | Brand bits | Which 9k elements should appear? (multi) | Typing wordmark · Nino mascot (can talk or react) · Ambient glow / grain · Cursor driving real UI |

## Round 3: references and content (plain text, always asked)

Send one message that asks for everything below at once, numbered so the user can answer quickly:

1. **References (required to ask).** Send frames, video files or links, a folder, a whatships.com, Dribbble or competitor launch film, or say "none". Also say what to take from each (pacing, transitions, type behaviour, camera) and what to leave out.
2. **Content.**
   - *Segment:* the script or VO line it sits under, the exact on-screen text, data or numbers, and timestamps if it goes into existing footage, plus the footage path.
   - *Promo:* product name and URL, the hook (≤6 words), 3 features, one proof number, the CTA, and the API keys available in `.env` (for example `ELEVENLABS_API_KEY`) for voice. Never ask for a key in chat.
3. **Assets.** Point to the logo or screenshots folder, a track file if one was chosen, and the brand-kit avatar if it should appear.
4. **Deadline / effort.** Ask whether this is a draft today or a polished flagship. A draft does 2 critique rounds. A flagship does 3 or more, renders at max effort, and tests the hook in the first 2 s hardest.

If the user answers only some items, continue with the ones you have. If no references were given, `docs/style_guide.md` says "Reference: 9k house style".

## After the questionnaire

Fill in `docs/brief.md` (`templates/brief.md`) and continue the workflow. The next stop is the shot-list gate. Don't ask anything else before it.
