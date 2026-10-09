# 9k style guide for motion

Source: https://design.the9klabs.com (`@9klabs/design` 0.1.0, snapshot 2026-10-05). Every value below is also in `templates/brand.js` as `BRAND`. **Use the tokens; never type a raw hex into a scene.**

To refresh after a design-system release, read `https://design.the9klabs.com/llms.txt` and the Tokens section of the site. If a value changed, update this file and `brand.js` together.

## Color

### Brand (the same in every theme)

| Token | Hex | Use in motion |
|---|---|---|
| `--primary-color` | `#166434` | The 9k green. Green bands, primary buttons, solid badges, Nino's body |
| `--on-primary-color` | `#FFFFFF` | Text on green |
| `--accent-color` | `#E85A02` | The orange. One hit per shot: an underline, cursor, highlight, key number or Nino's eyes |
| `--on-accent-color` | `#000000` | Text on orange. **Black, not white.** |
| `--dark-color` | `#0A111A` | Brand ink. Nino's screen and deep backgrounds |
| `--dark-color-lighten-30` | `#2A486F` | Rare, cool secondary in diagrams |
| `--gray-color` / `--dark-gray-color` | `#CCCCCC` / `#757575` | Neutral strokes |

### Theme

| Token | Dark | Light |
|---|---|---|
| bg | `#0F0F0F` | `#FAFAFA` |
| text | `#F5F5F5` | `#1A1A1A` |
| text-light (muted) | `#999999` | `#666666` |
| primary-text (green for text) | `#2FB161` | `#166434` |
| surface / raised / sunken | `#1A1A1A` / `#242424` / `#141414` | `#FFFFFF` / `#FFFFFF` / `#F5F5F5` |
| border | `#404040` | `#D6D6D6` |
| focus | `#5ED48B` | `#166434` |
| selected-bg | `#1F3327` | `#EAF5EE` |
| success / error / warning | `#72DA9A` / `#F39191` / `#F4C871` | `#166434` / `#A02222` / `#885207` |

**Green band** (`I9kSection variant="primary"`): a full-bleed `#166434` with white text, translucent-white borders (`#FFFFFF33`) and translucent-white panels (`#FFFFFF26`). The green is identical in light and dark. Use it for climaxes, CTAs and title cards. Keep error, warning and success colors off the green, because they are not re-mapped and disappear on it.

### The glow (the only gradient allowed)

`I9kGlow` is a big soft circle that sits half off-screen at an edge or corner. It has a linear gradient from green `#88D29B` (25%) through amber `#FAC871` (62%) to orange `#FF9363` (92%). It is masked by `radial-gradient(closest-side, #000 45%, transparent)`, overlaid with fractal-noise grain (blend mode `overlay`), and drawn at opacity 0.5 (0.35 in dark, where the colors become green-led: `#499B56` → green → `#E85A02`). It drifts over 20 s, ease-in-out, alternating: `translate(-4%, 6%) scale(1.08)`.

The alternative is `I9kBlurredCircles`: four circles with blur(80px) at opacity 0.1 (green 500px, orange 400px, amber `#F2C069` 300px, green 350px), floating on 15–25 s loops. Use one of the two, never both. It is always background and never sits behind small text.

## Type

| Role | Family | Notes |
|---|---|---|
| Headlines, UI, kinetic type | **IBM Plex Sans** 700 (600 for UI) | Normal tracking. Web H1 is 32/48 and H2 24/36. Video scales up, see below |
| Display, editorial, quotes | **IBM Plex Serif** | Page hero is display-scale (`clamp(…, 4rem)`). Use it for the one big line |
| Code, terminal, numbers in UI | **IBM Plex Mono** (system: `ui-monospace`) | |
| Arabic body / UI | **Thmanyah Sans** (fallback: IBM Plex Sans Arabic) | RTL. Mirror the layout |
| Arabic display | **Thmanyah Serif Display** | |
| Badges | Plex Sans, uppercase, small (web 0.7rem) | `solid` (green fill), `outline` (bordered) or `tag` (subtle chip with a leading `#`) |

Use one display face and one UI face per film. Never use Inter, Roboto, Poppins, Space Grotesk or system defaults.

**Video scale:** `rem = min(W, H) / 1080 * 32`. One web rem becomes 32 px on a 1080-wide frame. A headline at phone size needs ≥ 3 rem (96 px) and body text ≥ 1.5 rem.

## Shape and space

- Radius: sm 8, md 12, lg 16 (× video scale ÷ 16), pill 999, circle 50%.
- Panels: a 1 px border on an opaque surface. The **feature** panel has a raised surface, shadow `0 8px 25px rgba(0,0,0,.1)` and an orange-accented border, and is always radius lg.
- Spacing scale (web rem): .125, .25, .375, .5, .75, 1, 1.25, 2, 3.25. Use it for padding and gaps.
- Layout follows the site: one shared column with generous gutters. No frame borders or corner labels.

## Motion language

The 9k personality is **calm, precise, typed, a little playful in the details**. It is not flashy.

| Thing | Spec |
|---|---|
| UI state changes (hover, toggle, color) | 160 ms `ease`, or 200–300 ms `cubic-bezier(0.4, 0, 0.2, 1)` (`M.ease9k`) |
| Containers, cards, camera | `M.sp(t, 'default')`, a closed-form spring with almost no overshoot |
| Big type, logo lockups | `'heavy'` spring, **zero** overshoot |
| Buttons, toggles, leading edges | `'snappy'` spring |
| Nino only | `'playful'` (visible overshoot is allowed on the mascot) |
| Text reveal | **Typed**, character by character with a caret (`M.typed`). It's the wordmark's signature, so use it for at least one key line per film |
| Ambient | Glow drifts over 20 s. Grain is static per frame and seeded |

Banned: bouncy text, elastic or back easing on type, everything fading in, a centered title on a gradient, glow on UI chrome, particle bursts, neon, lens flares, gradients on UI, more than one accent per shot, and dead beats longer than 4 s.

## Signature elements (helpers in `brand.js`)

- **Wordmark** `B.wordmark(g, t, opts)`: types "Ismail9k", then backspaces down to "9k". At rest it can "wink" into an ASCII face (`^_^`) for 2 s and type back. Use it in intros and end cards. The end card is the bare **9k**.
- **Nino** `B.nino(g, x, y, size, {expression, t, look})` is the 9k pixel mascot on a 16×16 grid (64-unit viewBox, crisp edges): green body, `#0A111A` screen, orange eyes, green mouth. Expressions are `idle`, `happy`, `thinking`, `worried`, `surprised` and `eyes-closed`. Motion: a blink every 5.4 s (eyes scaleY 0.15 for 3% of the cycle), a ±2 unit bob over 2.4 s when thinking, and a ±1 unit shiver over 0.6 s when worried. Snap him to whole pixels and never blur or rotate him. **On the green band, pass `colors: { body: B.C.white }`**, because his green body disappears on green.
- **ASCII emoji** `^_^ ·ᴗ· ◡̈ >‿< x_x o_o -_-` in primary, accent or muted color. Use them as reactions, punctuation beats and winks.
- **Tags** `#ai #vue #design-systems` as tag-badges.
- **Stat** is a big value with a small label and an optional source (`480k+ / monthly downloads`). Use it for proof numbers.
- **YouTube brand kit (channel videos only):** the illustrated avatar and "9K" mark live in `~/…/Studio/2026/__higgsfield/resources/9k youtube intro/`. Use them only when the user picks the avatar in Round 3.

## Themes and direction

Every film picks exactly one theme (dark, light or green band), and the green band can appear as a climax inside dark. For Arabic, set `dir: 'rtl'`. Logical start and end swap, text aligns right, Nino's `look: 'start'` looks right, and the glow position `'end'` moves to the left edge.

- Position from the reading start with `B.sx(x)`, which is the left edge in LTR and the right edge in RTL. Use `textAlign = 'start'`. Badges take their logical start edge.
- Inside a panel, the content start is `x + pw - inset` in RTL and `x + inset` in LTR.
- `B.font(g, w, size, 'sans')` maps to Thmanyah in RTL. For a Latin run inside an Arabic film (a product name or a number), pass `B.FONTS.sans` to keep Plex.
- Check every RTL film's stills for Latin punctuation flipping (`.that ship`). Keep Latin phrases as separate draw calls.
