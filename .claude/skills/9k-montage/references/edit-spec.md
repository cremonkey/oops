# edit.json reference

One file holds every edit decision. `cut.*` is in **source** seconds (from `work/transcript.md`). Everything else is in **output** seconds (from `work/transcript.cut.md`, after the cut). Re-run only the step whose keys changed:

| Keys changed | Re-run |
|---|---|
| `cut`, `tail`, `format` | `cut.mjs` → `render-overlay.mjs` → `compose.mjs` (every output time can shift: re-read transcript.cut.md). Set `tail` before the first cut |
| `captions`, `graphics`, `theme`, `dir` | `render-overlay.mjs` → `compose.mjs` |
| `camera`, `grade`, `broll`, `audio` | `compose.mjs` |

## Top level

| Key | Default | Notes |
|---|---|---|
| `format` | `{w:1080,h:1920,fps:30}` | 9:16 Shorts. Long-form 16:9: `{w:1920,h:1080}`. Match the source fps |
| `dir` | `ltr` | `rtl` for Arabic films. It mirrors layouts, and every text still gets its own direction |
| `theme` | `dark` | The theme for panels. The footage is the background |
| `tail` | `0` | Seconds of held last frame after the speech. Use it for an `endcard` (3–3.5 s) |

## cut

| Key | Default | Notes |
|---|---|---|
| `maxPause` | `0.35` | Silences longer than this shrink to `padOut + padIn`. Use 0.25 for punchy shorts and 0.5 for calm long-form |
| `padIn` / `padOut` | `0.08` / `0.1` | Air kept before and after speech. Raise `padOut` if word tails sound clipped |
| `silenceDb` | `-35` | Raise to `-30` in a noisy room, lower to `-40` for a quiet voice |
| `drop` | `[]` | `[[srcIn, srcOut, "reason"], …]`. Retakes, flubs, off-topic tangents. Cut from just before the first word to just before the kept take |
| `keepAll` | `false` | `true` keeps the source untouched (no tightening) |
| `keep` | — | An explicit `[[in,out],…]` list that replaces the automatic one |

Pauses come from measured audio silence, never from word gaps. Whisper skips speech, so a word gap can be real talking.

## camera

| Key | Default | Notes |
|---|---|---|
| `auto` | `true` | Each jump cut (both your cuts and the cuts already in the source) alternates `base` ↔ `punch` |
| `base` / `punch` | `1.0` / `1.12` | Punch between 1.08 and 1.18. Above 1.2 a 1080p source gets soft |
| `focus` | `[0.5, 0.35]` | The point that stays centred when zoomed, as fractions of the footage. Put it between the eyes (read it off `work/contact.png`) |
| `keys` | `[]` | `{t, z, ease, dur?, focus?}`. `ease`: `snap` (≈0.3 s spring punch on a word), `cut` (hard), `push` (slow smoothstep over `dur`) |

## captions

| Key | Default | Notes |
|---|---|---|
| `style` | `word` | `word` (word by word, keyword pill), `phrase` (calm, 7 words), `off` |
| `maxWords` / `maxChars` / `gap` | `4` / `24` / `0.3` | A chunk breaks at any of these limits, or at punctuation |
| `fixes` | `{}` | `{ "whisper text": "correct text" }`. A key can span several words (`"even you": "Evan You"`). It applies everywhere, so keep keys specific |
| `keywords` | `[]` | Words that get the orange pill while spoken. Numbers like `90%` get it automatically. One accent per chunk |
| `hide` | `[]` | `[[a,b],…]` output ranges with no captions: burned-in text, image inserts already in the source, the hook. A chunk spoken just before a range also stops at its start, so it never spills onto the insert |
| `override` | `[]` | `{s, e, text, at?}` replaces whisper's WORDS in `[s, e)` with `text`, timed evenly or at `at: [t…]`. They're chunked by the normal rules. Use it for missed or garbled speech |
| `size` / `y` | `2.05 rem` / `0.72` | `y` is the caption centre as a fraction of H. Landscape default: 0.84 |

Arabic proclitics glued to Latin words (`كReactivity`, `وDeveloper`) split by themselves. Connectors (`و`, `في`, `من`…) never end a chunk. Check with `node lib/captions.mjs`.

## graphics

Every graphic: `{type, t, dur, …}`. A graphic that would grow into the caption band is lifted above it, unless it has `captions: false`. Optional on any of them: `zone` (`top` | `mid` | `center` | `low`), or `y` (the graphic's top or centre as a fraction of H), `x` / `w` (the graphic's centre and width as fractions of W, e.g. `x: 0.79, w: 0.34` for a side column in 16:9, where the default centred 0.6 W panel lands on his chest), `dim` (0–0.6, darkens the footage), `sfx: false`, `captions: false` (hides captions while it shows).

| type | Props | Use |
|---|---|---|
| `hook` | `text`, `sub?`, `cover?: [x,y,w,h]`, `size?` | The first-2-seconds line, typed with a caret. `cover` puts an opaque panel exactly over burned-in text |
| `chips` | `items: [{label, icon?, pick?}]`, `stagger?` | Tech names with logos. `icon` = simple-icons slug (`react`, `vuedotjs`, `nodedotjs`, `rust`, `typescript`, `docker`…) |
| `versus` | `a`, `b`: `{label, icon?, points?, pointsAt?}`, `at: [aT,bT]`, `pick?: 'a'\|'b'`, `pickAt?`, `pointSize?` (0.78 of `size`) | X vs Y. Each side enters when it is named. `pick` turns that side's border orange |
| `stat` | `value: "90%"`, `label`, `count?: true` | Any number he says. It counts up |
| `card` | `title`, `body?`, `badge?` | A question or claim worth reading. The title is typed |
| `list` | `items: []`, `title?`, `at?: [t…]` | Reasons and steps. Each item lands on its word |
| `retype` | `from`, `to`, `hold?` | "Not X, it's Y": strike, backspace, retype |
| `emoji` | `text: '^_^'`, `x?`, `y?`, `color?` | ASCII reaction on a punchline: `^_^ x_x o_o >‿<`. Beside the head, never over the mouth |
| `nino` | `expression`, `corner: 'start'\|'end'` | Mascot reaction: `thinking`, `happy`, `worried`, `surprised` |
| `band` | `text`, `y?` (0.6), `height?` (0.15), `size?` (3.4 rem, shrinks to fit) | Green band climax, ≤ 1.2 s. One per film. Keep it below the mouth when the camera snaps in |
| `quote` | `text` | One serif line on a dimmed frame. Captions hide |
| `code` | `code`, `title?` | A typed code panel |
| `image` | `src`, `fit: 'card'\|'full'`, `caption?` | A b-roll still from `assets/`. `full` hides captions |
| `lowerThird` | `name`, `title?` | Long-form 16:9 only |
| `endcard` | `cta`, `handle` | Green band, Nino, the wordmark retyped to 9k. Pair it with `tail` |
| `mask` | `rect: [x,y,w,h]`, `color?` | A bare opaque box over burned-in text, when no hook sits there |

Every component asks for its own SFX (pop, whoosh, type ticks, ding), timed to its animation. They are collected in `work/cues.auto.json`.

## grade, broll

- `grade`: `{contrast: 1.04, saturation: 1.05, gamma: 1, brightness: 0}`, or `false` to disable. Keep it light: skin must not shift.
- `broll`: `[{t, dur, src, from}]` places full-frame video inserts from `assets/`. Captions keep running over them.

## audio

| Key | Default | Notes |
|---|---|---|
| `lufs` | `-14` | The Shorts/YouTube target, measured over the final mix |
| `voice.clean` | `true` | Highpass 75 Hz, light denoise (afftdn −28), 3:1 compression |
| `sfx.auto` / `sfx.gain` | `true` / `1` | Component cues, plus a whoosh on each camera snap of ≥ 0.08 |
| `cues` | `[]` | Extra synth cues `{t, type, gain}`: `click pop thump whoosh tick ding type` |
| `extra` | `[]` | Sound files `{t, src, gain}`, e.g. `assets/notification.mp3` on "someone asked me" |
| `music` | `null` | `{src, gain: 0.14, duck: true, fadeOut: 1.5}`. Sidechain-ducked under the voice. Never use synthesized music under speech |
