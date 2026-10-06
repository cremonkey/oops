#!/usr/bin/env python3
"""Build the Dr. Fatma reel timeline from the verified transcript + EDL.

Writes: transcript.json, captions.srt, timing-map.json, index.html,
compositions/captions.html and compositions/<scene>.html (from tools/templates/).
Run from the project root:  python3 tools/build.py
"""
import json, math, os, re

FPS = 30
SRC = "assets/rawreel_1080.mp4"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

def fq(t):  # quantize to frame grid
    return round(round(t * FPS) / FPS, 4)

# ---------------------------------------------------------------- transcript
raw = json.load(open("tools/data/scribe_words_raw.json"))["words"]  # ElevenLabs Scribe v1 output
CORRECTIONS = {  # index: (text, type, note)
    7: ("حدوتة", "word", "ASR 'حدودة' -> Egyptian 'حدوتة' (tale)"),
    23: ("Pre-", "word", "English medical term, said as 'pre diabetic'"),
    24: ("diabetic", "word", "English medical term"),
    62: ("آآآ", "filler", "hesitation"),
    144: ("بيح--", "false_start", "false start, abandoned word"),
}
words = []
for i, w in enumerate(raw):
    text, typ, note = CORRECTIONS.get(i, (w["text"], "word", None))
    d = {"i": i, "text": text, "start": round(w["start"], 3), "end": round(w["end"], 3), "type": typ}
    if note:
        d["note"] = note
    words.append(d)

def clean(t):
    return t.rstrip(".،؟?!").replace("--", "")

# ---------------------------------------------------------------- EDL (energy-snapped, see work/edl_snapped.json)
EDL = [
    ("s01", 15.23, 21.63, "hook"),
    ("s02", 7.05, 7.93, "context"),
    ("s03", 8.43, 10.46, "context"),
    ("s04", 10.49, 12.30, "context"),
    ("s05", 12.57, 15.11, "context"),
    ("s06", 24.02, 26.91, "problem"),
    ("s07", 27.04, 28.95, "problem"),
    ("s08", 30.16, 31.72, "problem"),
    ("s09", 33.93, 43.22, "problem"),
    ("s10", 43.72, 47.27, "turn"),
    ("s11", 48.09, 51.02, "journey"),
    ("s12", 51.37, 58.70, "proof"),
    ("s13", 59.82, 63.49, "payoff"),
    ("s14", 63.56, 69.13, "payoff"),
    ("s15", 73.07, 76.34, "payoff"),
    ("s16", 77.70, 78.91, "payoff"),
    ("s17", 79.28, 83.52, "cta"),
]
segs, F = [], 0
for sid, a, b, beat in EDL:
    a = round(round(a * FPS) / FPS, 4)  # media-start on the source frame grid (frame-exact extraction)
    n = round((b - a) * FPS)
    st, en = round(F / FPS, 4), round((F + n) / FPS, 4)
    segs.append({"id": sid, "src_in": a, "src_out": round(a + n / FPS, 4), "out_start": st, "duration": round(en - st, 4), "frames": n, "beat": beat})
    F += n
TOTAL = round(F / FPS, 4)

EXCLUDE = {66: "Scribe places «مش» at 31.64 but the energy onset is ~31.77, after the s08 out-point (31.727)"}

def seg_of_word(i):
    if i in EXCLUDE:
        return None
    w = words[i]
    for s in segs:
        mid = (w["start"] + w["end"]) / 2
        if s["src_in"] - 0.02 <= mid <= s["src_out"]:
            return s
    return None

def wout(i, key="start"):
    s = seg_of_word(i)
    assert s, f"word {i} not in edit"
    rel = min(max(words[i][key] - s["src_in"], 0.0), s["duration"])
    return round(s["out_start"] + rel, 3)

def seg_start(sid):
    return next(s["out_start"] for s in segs if s["id"] == sid)

for w in words:
    s = seg_of_word(w["i"])
    if s and w["type"] == "word":
        w["kept"] = True
        w["out_start"] = wout(w["i"])
        w["out_end"] = wout(w["i"], "end")
        w["segment"] = s["id"]
    else:
        w["kept"] = False

# ---------------------------------------------------------------- visual windows
# kind A = Dr. Fatma (crop states), G = full-screen graphic sub-composition
def W(i, off=-0.05):
    return fq(wout(i) + off)

WINDOWS = [
    dict(kind="A", start=0.0, crop=dict(push=[1.00, 1.12, 0.72])),
    dict(kind="G", start=W(33), scene="g01-hope"),
    dict(kind="A", start=W(38, -0.06), crop=dict(set=1.00, punch=[42, 1.08, 0.28])),
    dict(kind="A", start=seg_start("s02"), crop=dict(set=1.06)),
    dict(kind="A", start=seg_start("s03"), crop=dict(set=1.00)),
    dict(kind="G", start=seg_start("s04"), scene="g02-patient"),
    dict(kind="A", start=seg_start("s06"), crop=dict(set=1.08)),
    dict(kind="G", start=W(53), scene="g03-limits"),
    dict(kind="A", start=seg_start("s09"), crop=dict(drift=[1.00, 1.04])),
    dict(kind="G", start=W(79), scene="g04-age"),
    dict(kind="A", start=W(89), crop=dict(set=1.15)),
    dict(kind="A", start=seg_start("s10"), crop=dict(drift=[1.00, 1.04])),
    dict(kind="G", start=seg_start("s11"), scene="g05-journey"),
    dict(kind="A", start=seg_start("s12"), crop=dict(set=1.10)),
    dict(kind="G", start=W(112), scene="g06-weight"),
    dict(kind="A", start=seg_start("s13"), crop=dict(push=[1.00, 1.09, 0.85])),
    dict(kind="A", start=seg_start("s14"), crop=dict(set=1.06)),
    dict(kind="G", start=W(129), scene="g07-track"),
    dict(kind="A", start=seg_start("s15"), crop=dict(set=1.00)),
    dict(kind="G", start=W(151), scene="g08-age45"),
    dict(kind="A", start=seg_start("s16"), crop=dict(set=1.13)),
    dict(kind="A", start=seg_start("s17"), crop=dict(outro=[1.06, 1.00])),
]
for k, win in enumerate(WINDOWS):
    win["end"] = WINDOWS[k + 1]["start"] if k + 1 < len(WINDOWS) else TOTAL
    win["duration"] = round(win["end"] - win["start"], 4)
CTA_START = W(165, -0.12)

# ---------------------------------------------------------------- text behind Dr. Fatma (matte over typography)
# (A-window start, kicker, main phrase, word index that triggers it, tone)
BEHIND_SPEC = [
    (0.0, "كان عنده", "أمل واحد", 30, "teal"),
    (seg_start("s09"), "مش بيقدر يقف", "يصلي", 75, "ink"),
    (W(89), "ده", "عجز", 90, "warm", 230),  # shifted so the head never hides the dot of ج
    (seg_start("s12"), "من وزن", "140 كيلو", 110, "ink"),
    (seg_start("s13"), "بقى يقف يصلي", "كل الفروض", 122, "teal"),
    (seg_start("s16"), "حياته", "اتغيرت", 159, "teal"),
]
BEHIND = []
for k, (wst, kicker, main, wi, tone, *dx) in enumerate(BEHIND_SPEC):
    win = next(w for w in WINDOWS if w["kind"] == "A" and abs(w["start"] - wst) < 1e-3)
    seg = next(sg for sg in segs if sg["out_start"] - 1e-3 <= win["start"] < sg["out_start"] + sg["duration"] - 1e-3)
    f0 = round((seg["src_in"] + win["start"] - seg["out_start"]) * FPS)
    BEHIND.append({"id": f"b{k + 1}", "start": win["start"], "duration": win["duration"], "src_frame": f0,
                   "frames": round(win["duration"] * FPS), "kicker": kicker, "main": main, "tone": tone, "dx": dx[0] if dx else 0,
                   "at": round(max(0.0, wout(wi) - win["start"] - 0.08), 3)})

# scene-local cues (seconds from scene start), consumed by the templates
def local(scene, i, key="start", off=0.0):
    win = next(w for w in WINDOWS if w.get("scene") == scene)
    return round(wout(i, key) - win["start"] + off, 3)

CUES = {
    "g01-hope": {"lace": 0.0, "word": local("g01-hope", 36), "noun": local("g01-hope", 37)},
    "g02-patient": {"row1": 0.12, "row2": local("g02-patient", 23), "row3": local("g02-patient", 26), "key": local("g02-patient", 27)},
    "g03-limits": {"row1": 0.0, "row2": 0.18, "row3": local("g03-limits", 58), "row3sub": local("g03-limits", 63)},
    "g04-age": {"age": local("g04-age", 81), "feltLabel": local("g04-age", 83), "felt": local("g04-age", 87)},
    "g05-journey": {"path": 0.0, "n3": local("g05-journey", 102), "n4": local("g05-journey", 104), "months": local("g05-journey", 105)},
    "g06-weight": {"count": 0.0, "land": local("g06-weight", 114), "alt": local("g06-weight", 117)},
    "g07-track": {"n2": local("g07-track", 131), "day": local("g07-track", 134), "club": local("g07-track", 136), "lap1": local("g07-track", 139), "lap2": local("g07-track", 140)},
    "g08-age45": {"felt": local("g08-age45", 156)},
    "cta": {"word": round(wout(167) - CTA_START, 3), "end": round(wout(168, "end") - CTA_START, 3)},
}

# ---------------------------------------------------------------- captions (A-roll only)
CHUNKS = [  # (first word, last word, highlight word or None, tone)
    (28, 29, None, ""), (30, 32, 31, "teal"),
    (38, 38, 38, "teal"), (39, 41, None, ""), (42, 43, 42, "warm"),
    (13, 14, 14, "teal"), (15, 18, 17, "teal"),
    (49, 50, None, ""), (51, 52, 52, "teal"),
    (72, 73, None, ""), (74, 75, 75, "teal"), (76, 78, 78, "teal"),
    (89, 90, 90, "warm"), (91, 92, None, ""),
    (93, 94, None, ""), (95, 96, 96, "teal"), (97, 98, 98, "teal"),
    (108, 109, None, ""), (110, 111, 110, "teal"),
    (119, 121, 121, "teal"), (122, 123, None, ""), (124, 125, 125, "teal"),
    (126, 126, None, ""), (127, 128, 128, "teal"),
    (146, 148, None, ""), (149, 150, None, ""),
    (158, 159, 159, "green"),
    (160, 161, None, ""), (162, 163, 163, "teal"), (164, 164, None, ""),
]
CHUNKS.sort(key=lambda c: wout(c[0]))
caps = []
for k, (a, b, hl, tone) in enumerate(CHUNKS):
    start = fq(wout(a) - 0.04)
    end_natural = wout(b, "end") + 0.30
    nxt = fq(wout(CHUNKS[k + 1][0]) - 0.04) if k + 1 < len(CHUNKS) else TOTAL
    # never let a caption run into a graphic window or the CTA
    limit = min([w["start"] for w in WINDOWS if w["kind"] == "G" and w["start"] > start] + [CTA_START, nxt])
    end = fq(min(end_natural, limit))
    toks = []
    for i in range(a, b + 1):
        if words[i]["type"] != "word":
            continue
        toks.append({"t": clean(words[i]["text"]), "hl": i == hl, "at": round(wout(i) - start, 3)})
    caps.append({"id": f"cap{k:02d}", "start": start, "end": end, "tone": tone, "words": toks})

# ---------------------------------------------------------------- SFX cues (absolute)
def scene_start(scene):
    return next(w["start"] for w in WINDOWS if w.get("scene") == scene)

SFX = []
for w in WINDOWS:
    if w["kind"] == "G":
        SFX.append(("whoosh", fq(w["start"] - 0.02), 0.20))
for scene, keys, snd, vol in [
    ("g01-hope", ["noun"], "lock", 0.22),
    ("g02-patient", ["row2", "row3"], "tick", 0.20),
    ("g02-patient", ["key"], "lock", 0.18),
    ("g03-limits", ["row2", "row3"], "tick", 0.20),
    ("g04-age", ["felt"], "lock", 0.22),
    ("g05-journey", ["months"], "lock", 0.20),
    ("g06-weight", ["land"], "lock", 0.24),
    ("g07-track", ["lap1", "lap2"], "tick", 0.20),
    ("g08-age45", ["felt"], "lock", 0.22),
]:
    for key in keys:
        SFX.append((snd, fq(scene_start(scene) + CUES[scene][key]), vol))
SFX.append(("lock", fq(CTA_START + 0.30), 0.20))
SFX.sort(key=lambda s: s[1])

# ---------------------------------------------------------------- outputs: transcript / srt / timing map
json.dump({
    "source": "../rawreel.mp4",
    "engine": "ElevenLabs Scribe v1 (eleven_scribe_v1), language ara (p=0.966); manually reviewed",
    "language": "ar-EG",
    "duration": 85.057,
    "words": [{k: w[k] for k in ("text", "start", "end", "type") if k in w} | ({"note": w["note"]} if "note" in w else {}) for w in words],
    "edited_words": [{"text": w["text"], "start": w["out_start"], "end": w["out_end"], "source_start": w["start"], "source_end": w["end"], "segment": w["segment"]} for w in sorted([w for w in words if w.get("kept")], key=lambda w: w["out_start"])],
}, open("transcript.json", "w"), ensure_ascii=False, indent=1)

def srt_time(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

kept = sorted([w for w in words if w.get("kept")], key=lambda w: w["out_start"])

def join(ws):
    out = ""
    for x in ws:
        t = clean(x["text"]) if not x["text"].endswith("-") else x["text"]
        out += t if (not out or out.endswith("-")) else " " + t
    return out
lines, cur = [], []
for w in kept:
    cur.append(w)
    end_sentence = w["text"].endswith((".", "؟", "?"))
    if len(cur) >= 4 or end_sentence:
        lines.append(cur); cur = []
if cur:
    lines.append(cur)
with open("captions.srt", "w") as f:
    for n, ln in enumerate(lines, 1):
        a = ln[0]["out_start"]; b = ln[-1]["out_end"] + 0.15
        if n < len(lines):
            b = min(b, lines[n][0]["out_start"] - 0.01)
        f.write(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{join(ln)}\n\n")

removed, prev = [], 0.0
for s in sorted(segs, key=lambda s: s["src_in"]):
    if s["src_in"] - prev > 0.005:
        removed.append([round(prev, 3), round(s["src_in"], 3)])
    prev = max(prev, s["src_out"])
removed.append([round(prev, 3), 85.057])
json.dump({
    "fps": FPS, "source": "../rawreel.mp4", "working_media": SRC,
    "source_duration": 85.057, "output_duration": TOTAL,
    "segments": [{**s, "out_end": fq(s["out_start"] + s["duration"]),
                  "text": join([w for w in kept if w["segment"] == s["id"]])} for s in segs],
    "reordered": [s["id"] for k, s in enumerate(segs) if k and s["src_in"] < segs[k - 1]["src_in"]],
    "removed_source_ranges": removed,
    "visual_windows": [{k: v for k, v in w.items()} for w in WINDOWS],
    "cta": {"start": CTA_START, "end": TOTAL},
    "behind_text": BEHIND,
    "scene_cues": CUES,
    "sfx": [{"sound": s, "at": a, "volume": v} for s, a, v in SFX],
}, open("timing-map.json", "w"), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- HTML generation
BRAND = open("tools/templates/_brand.css").read()

def render_template(name, dest, cues, duration, extra=None):
    html = open(f"tools/templates/{name}").read()
    html = html.replace("/*__BRAND__*/", BRAND).replace("__CUES__", json.dumps(cues)).replace("__DUR__", str(duration))
    for k, v in (extra or {}).items():
        html = html.replace(k, v)
    open(dest, "w").write(html)

for w in WINDOWS:
    if w["kind"] == "G":
        render_template(f"{w['scene']}.html", f"compositions/{w['scene']}.html", CUES[w["scene"]], w["duration"])
render_template("cta.html", "compositions/cta.html", CUES["cta"], fq(TOTAL - CTA_START))
render_template("behind.html", "compositions/behind.html", {"total": TOTAL}, TOTAL,
                {"__ITEMS__": json.dumps(BEHIND, ensure_ascii=False)})
render_template("captions.html", "compositions/captions.html", {"total": TOTAL}, TOTAL,
                {"__CAPS__": json.dumps(caps, ensure_ascii=False)})

def automation(d):
    pts = [{"t": 0, "v": 0}, {"t": 0.02, "v": 1}, {"t": round(d - 0.02, 3), "v": 1}, {"t": d, "v": 0}]
    return json.dumps({"version": 1, "lanes": [{"target": "volume", "points": pts}]})

videos = "\n".join(
    f'      <video id="v-{s["id"]}" class="clip arole" src="{SRC}" data-start="{s["out_start"]}" '
    f'data-duration="{s["duration"]}" data-media-start="{s["src_in"]}" data-track-index="{k % 2}" '
    f"playsinline data-has-audio=\"true\" data-automation='{automation(s['duration'])}'></video>"
    for k, s in enumerate(segs))

hosts = "\n".join(
    f'    <div id="host-{w["scene"]}" class="clip scene-host" data-composition-id="{w["scene"]}" '
    f'data-composition-src="compositions/{w["scene"]}.html" data-start="{w["start"]}" data-duration="{w["duration"]}" '
    f'data-track-index="2" data-track-kind="graphics" data-width="1080" data-height="1920"></div>'
    for w in WINDOWS if w["kind"] == "G")

SFX_LEN = {"whoosh": 0.45, "tick": 0.09, "lock": 0.32}
sfx_html = "\n".join(
    f'    <audio id="sfx-{k:02d}-{s}" src="assets/sfx/{s}.wav" data-start="{a}" data-duration="{SFX_LEN[s]}" data-track-index="{5 if s == 'whoosh' else 6}" data-volume="{v}"></audio>'
    for k, (s, a, v) in enumerate(SFX))

# crop / camera tweens on the #cam wrapper (never on the timed clips)
cam = []
for w in WINDOWS:
    if w["kind"] != "A":
        continue
    c, st, du = w["crop"], w["start"], w["duration"]
    if "set" in c:
        cam.append(f'tl.set(CAMS, {{ scale: {c["set"]} }}, {st});')
    if "push" in c:
        a, b, d = c["push"]
        cam.append(f'tl.fromTo(CAMS, {{ scale: {a} }}, {{ scale: {b}, duration: {d}, ease: "power3.out", immediateRender: false }}, {st});')
    if "punch" in c:
        i, b, d = c["punch"]
        cam.append(f'tl.to(CAMS, {{ scale: {b}, duration: {d}, ease: "power2.out" }}, {fq(wout(i) - 0.04)});')
    if "drift" in c:
        a, b = c["drift"]
        cam.append(f'tl.fromTo(CAMS, {{ scale: {a} }}, {{ scale: {b}, duration: {du}, ease: "none", immediateRender: false }}, {st});')
    if "outro" in c:
        a, b = c["outro"]
        hold = fq(wout(168, "end") - st)
        cam.append(f'tl.set(CAMS, {{ scale: {a} }}, {st});')
        cam.append(f'tl.to(CAMS, {{ scale: {b}, duration: {fq(du - hold + 0.6)}, ease: "power2.inOut" }}, {fq(st + hold - 0.6)});')

# Render guard: the renderer can miss the very first decoded frames of the opening clip, so the
# exact source frames 457/458 (s01 in-point) sit under the video for frames 0-1 only.
f0 = round(segs[0]["src_in"] * FPS)
stills = "\n".join(
    f'        <img id="still-f{f0 + k}" class="clip arole-still" src="assets/stills/s01_f{f0 + k}.jpg" data-start="{round(k / FPS, 4)}" '
    f'data-duration="{round(1 / FPS, 4)}" data-track-index="7" alt="" />'
    for k in range(2))
videos = stills + "\n" + videos

mattes = "\n".join(
    f'        <video id="matte-{b["id"]}" class="clip" src="assets/mattes/{b["id"]}.webm" data-start="{b["start"]}" '
    f'data-duration="{b["duration"]}" data-media-start="0" data-track-index="8" muted playsinline></video>'
    for b in BEHIND)

index = open("tools/templates/index.html").read()
index = (index.replace("__TOTAL__", str(TOTAL)).replace("__VIDEOS__", videos).replace("__HOSTS__", hosts)
         .replace("__SFX__", sfx_html).replace("__MATTES__", mattes).replace("__CAM__", "\n      ".join(cam))
         .replace("__CTA_START__", str(CTA_START)).replace("__CTA_DUR__", str(fq(TOTAL - CTA_START))))
open("index.html", "w").write(index)

a_time = sum(w["duration"] for w in WINDOWS if w["kind"] == "A")
print(f"total {TOTAL}s | A-roll {a_time:.2f}s ({a_time / TOTAL * 100:.1f}%) | graphics {TOTAL - a_time:.2f}s ({(TOTAL - a_time) / TOTAL * 100:.1f}%)")
for w in WINDOWS:
    print(f'  {w["kind"]} {w["start"]:7.3f} → {w["end"]:7.3f} ({w["duration"]:5.2f}) {w.get("scene", "")} {w.get("crop", "")}')
print("CTA", CTA_START, "captions", len(caps), "sfx", len(SFX))
print(json.dumps(CUES, ensure_ascii=False))
