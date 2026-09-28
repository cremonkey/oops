# Nexus CRM — "From Leads to Revenue" (60 s vertical promo)

A 1080×1920, 30 fps, 60.0 s (1,800 frames) motion graphics film. It is rendered entirely from code, so every frame is reproducible and editable.

| Scene | Time | Frames | Content |
|---|---|---|---|
| 01 The Problem | 00:00–00:07 | 0–209 | Lead cards, messages, and alerts pile up. The hero lead gets buried. A blue line organizes the chaos. |
| 02 Enter Nexus | 00:07–00:15 | 210–449 | White logo reveal. META LEADS / WEBSITE FORMS / LEAD IMPORT stream into the hub and come out as clean customer cards. |
| 03 Organize & Assign | 00:15–00:26 | 450–779 | The profile builds from fragments. A phone-match duplicate merges in. Round-robin routing assigns the lead to Omar K. An SLA timer and an at-risk lead appear, with the manager notified. |
| 04 Conversation Workspace | 00:26–00:36 | 780–1079 | Three-column inbox establishing shot, then a zoom into the WhatsApp chat. Messenger and Instagram are shown as **inbound only**. Customer-context sheet, linked follow-up task, mobile Sales Desk with a push notification. |
| 05 Sales Pipeline | 00:36–00:47 | 1080–1409 | The opportunity moves NEW → WORKING → PROPOSAL → COMMITTED → WON, with a follow-up task per stage. Other deals stay in other stages, including a LOST one. The lanes then morph into a funnel. |
| 06 Business Visibility | 00:47–00:55 | 1410–1649 | KPIs, lead sources, stage funnel, team activity, a Meta Lead Ads → WON attribution path, and an export button. Tagged "Illustrative data". |
| 07 Final Brand Reveal | 00:55–01:00 | 1650–1799 | White logo lockup, Arabic tagline, "Organize. Connect. Grow.", and the CTA «اكتشف NEXUS CRM». |

All names and numbers are fictitious. The film makes no revenue, ROI, or AI claims.

## Layout

```
src/index.html     page + fonts (open with ?preview to scrub/play in a browser)
src/timeline.js    scene table + voice-over timing + caption chunks
src/nexus.js       the renderer (renderFrame(f))
assets/            white logo, icon, and wordmark (extracted from the supplied logo)
fonts/             Cairo (Arabic), Inter (English UI)
build/render.mjs   headless Chromium → JPEG frames → H.264
build/audio.py     SFX synthesis, VO placement, ducking, -14 LUFS master
build/mux.sh       video + audio/mix.wav → final MP4
audio/             vo1..vo7.*, music.* (inputs); mix.wav, stems/ (outputs)
out/               rendered deliverables
```

## Build

```bash
npm i                                   # playwright (uses the preinstalled Chromium)
python3 build/audio.py measure          # only when audio/vo*.mp3 exist: fits captions to real VO length
node build/render.mjs out/video_captions.mp4
node build/render.mjs out/video_nocaptions.mp4 --no-captions
python3 build/audio.py mix              # writes audio/mix.wav + audio/stems/*
build/mux.sh out/video_captions.mp4   out/nexus-crm-promo.mp4
build/mux.sh out/video_nocaptions.mp4 out/nexus-crm-promo-nocaptions.mp4
```

`audio.py mix` uses `audio/music.*` if present. Otherwise it synthesizes a placeholder bed that follows the brief's music arc. Each `audio/voN.*` file is placed at its scene start. It is sped up by at most 12 % if it overruns its scene, and the music is ducked under it.
