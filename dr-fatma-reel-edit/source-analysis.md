# Source analysis — rawreel

Status: **inspection complete · transcript verified** (ElevenLabs Scribe v1, approved by the user).

## ffprobe — original (`../rawreel.mp4`, copy of uploaded `VID-20261005-WA0004.mp4`)

| Field | Value |
| --- | --- |
| Duration | 85.057 s |
| Size | 7,741,972 bytes (728 kb/s) |
| Coded size | 1024 × 576, rotation side-data −90° → **displays 576 × 1024 (vertical 9:16)** |
| Frame rate | VFR (WhatsApp): r_frame_rate 600/19, avg ≈ 29.99 fps, 2551 frames → treated as **30 fps** |
| Video codec | H.264 |
| Audio codec | AAC, 44.1 kHz, 2 channels |

Vertical: **yes**. Native 576 × 1024 is exactly 9:16, so it maps to 1080 × 1920 with no crop
(1.875× upscale). Resolution is low (WhatsApp-compressed); punch-ins above ~1.15× will look soft —
keep emphasis crops at 1.07–1.13× and use the strongest crop sparingly.

## Working copy (`assets/rawreel_1080.mp4`)

Upright 1080 × 1920, Lanczos upscale, CFR 30 fps (2552 frames), H.264 CRF 15, GOP 15 (seek-friendly),
AAC 256k 48 kHz. Colour untouched (natural skin tone kept).
Audio chain (`work/audio_chain.txt`): `highpass 70 Hz → acompressor 2.2:1 @ −24 dB → +3.1 dB → alimiter 0.83`.

| | Integrated | True peak | LRA |
| --- | --- | --- | --- |
| Source | −23.1 LUFS | −4.4 dBTP | 6.8 LU |
| Working copy | **−13.9 LUFS** | **−1.6 dBTP** | 3.9 LU |

Noise floor ≈ −41 dB (quiet room, light reverb) — no denoise needed.

## Framing (contact sheets `work/contact/sheet_all.png`, `sheet_12_24.png`)

- Static locked-off medium shot: Dr. Fatma seated at a wooden desk, white shirt, beige hijab,
  black office chair behind, plain warm-grey wall. Large clean headroom (top ~25% of frame) — usable
  negative space for small labels, not for captions.
- Face centre ≈ x 0.50, y 0.27–0.33 of frame (drifts ±6% horizontally as she leans).
  Eyes ≈ y 0.27. Chin ≈ y 0.36. Hands rest on the desk ≈ y 0.62–0.72.
- ~14–17 s: she leans forward / gestures with both hands (strong emphasis moment candidate).
- She holds a small orange object in her hands for much of the take (prop/marker) — avoid caption
  placement over hands at y 0.62–0.70 when she gestures; caption band → y ≈ 0.66–0.74 with the doctor
  pushed in, or above the desk line otherwise.
- Push-in anchor for 1.07–1.13× crops: transform-origin ≈ 50% 30% (protects eyes + chin + hands).

## Waveform / pauses (`work/contact/wave.png`; silencedetect −35 dB, ≥ 0.22 s)

Speech is continuous and well paced — only short breaths. Pauses ≥ 0.22 s (start → duration):

```
0.000 0.39 | 3.286 0.34 | 6.456 0.34 | 7.886 0.52 | 10.344 0.22 | 12.386 0.25
15.108 0.23 | 17.018 0.51 | 17.532 0.24 | 23.713 0.40 | 33.121 0.24 | 36.962 0.23
41.300 0.33 | 43.399 0.39 | 44.618 0.26 | 47.598 0.23 | 51.119 0.30 | 58.540 0.84
62.305 0.23 | 63.327 0.30 | 68.999 0.27 | 76.354 0.40 | 76.893 0.30 | 77.296 0.43
78.858 0.52 | 82.549 0.29 | 82.835 2.22 (dead tail)
```

Candidate trims (to be validated against words + mouth + gesture once the transcript exists):
dead head 0.00–0.33, dead tail ≥ 82.9, and the longer gaps at 7.89, 17.02, 58.54, 76.35–78.86.
**Not cut yet** — the brief forbids cutting from numeric silence alone.

## Transcription history (resolved)

Required: accurate Egyptian-Arabic word-level transcript (`transcript.json`) reviewed against audio.

1. `npx hyperframes transcribe … --engine whisper --model large-v3 --language ar` built whisper.cpp
   but the model download failed: `{"ok":false,"error":"Download failed: HTTP 403"}`.
2. Network policy blocks every ASR-model host tried: huggingface.co, cdn-lfs.huggingface.co,
   hf-mirror.com, openaipublic.azureedge.net (OpenAI Whisper), modelscope.cn, alphacephei.com (Vosk),
   download.pytorch.org, dl.fbaipublicfiles.com, kaggle.com. No Whisper weights exist on npm/PyPI.
3. Parakeet (the other HyperFrames engine) doesn't support Arabic.
4. Sending the audio to the connected ElevenLabs Scribe connector was refused by the session's
   permission policy (it counts as sending data to an outside service), so that route is closed unless the user allows it.

5. **Resolved:** the user approved ElevenLabs. Scribe v1 returned 169 words with per-word timestamps
   (language `ara`, p = 0.966). Audio was uploaded as a 128 kbps mono MP3 of the source.

## Transcript review

- Content: a patient success story. «عم حسن», 55, pre-diabetic with insulin resistance. His only hope
  was to tie his shoes. He couldn't climb stairs, was badly breathless, choked during sleep, couldn't pray
  standing and felt 65. After lab tests and 3–4 months he went from 140 kg to about 87–86 kg. He now
  prays every prayer standing, walks 1–2 km a day at the club and says he feels 45.
- Corrections: «حدودة» → «حدوتة» (Egyptian "tale"); "pre diabetic" kept as the English medical
  term she says (displayed "Pre-diabetic", glossed «مرحلة ما قبل السكري»); «آآآ» tagged filler;
  «بيح--» tagged false start.
- Medical wording is unambiguous: «pre diabetic», «مقاومة إنسولين», «اختناق أثناء النوم» (kept as her
  wording; no apnea diagnosis added), «تحاليلنا». Numbers 55 / 65 / 45, 140 → «حوالي 87… أو 86», 3–4 months
  and 1–2 km are shown exactly as spoken, with «حوالي» and «أو 86» preserved.
- Timestamp audit: every cut was snapped to a 10 ms RMS minimum. Scribe places «مش» (w66) at 31.64,
  but the energy profile shows «النوم» decaying to −42 dB at 31.72 with the next onset at ~31.77, so the
  s08 out-point (31.727) holds only the tail of «النوم». w66 is excluded from the edit.
