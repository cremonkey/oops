#!/usr/bin/env python3
"""Nexus CRM promo — sound design, voice-over placement and final mix.

usage:
  python3 build/audio.py measure   # measure audio/vo1..7 and write real durations into src/timeline.js
  python3 build/audio.py mix       # build stems + audio/mix.wav (48 kHz stereo, 60.000 s)

Inputs (optional, used when present):
  audio/vo1..vo7.(mp3|wav)  Egyptian Arabic voice-over, one file per scene
  audio/music.(mp3|wav)     licensed / generated music track
Without music.* a synthesized placeholder bed is used; without vo* the mix has no narration.
"""
import json, os, re, subprocess, sys, glob
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AUD = os.path.join(ROOT, 'audio')
SR = 48000
DUR = 60.0
N = int(SR * DUR)
FPS = 30
FF = os.environ.get('FFMPEG', 'ffmpeg')
rng = np.random.default_rng(42)


def decode(path):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'pcm_s24le', path], input=x.astype(np.float32).tobytes(), check=True)


def find(stem):
    for ext in ('wav', 'mp3', 'm4a', 'ogg'):
        p = os.path.join(AUD, f'{stem}.{ext}')
        if os.path.exists(p):
            return p
    return None


def timeline():
    src = open(os.path.join(ROOT, 'src', 'timeline.js'), encoding='utf-8').read()
    return src


def trim_silence(x, thr=0.004):
    e = np.abs(x).max(1)
    idx = np.where(e > thr)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(0.02 * SR)); b = min(len(x), idx[-1] + int(0.08 * SR))
    return x[a:b]


# windows each VO line must fit in: (start_s, latest_end_s)
SCENE_END = [7.0, 15.0, 26.0, 36.0, 47.0, 55.0, 59.6]


def load_vo():
    src = timeline()
    starts = [float(m) for m in re.findall(r"scene: \d, start: ([\d.]+)", src)]
    out = []
    for i in range(7):
        p = find(f'vo{i + 1}')
        if not p:
            out.append(None); continue
        x = trim_silence(decode(p))
        room = SCENE_END[i] - starts[i] - 0.15
        d = len(x) / SR
        if d > room:  # gently speed up to fit its scene (never more than 12 %)
            tempo = min(1.12, d / room)
            raw = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                                  '-af', f'atempo={tempo:.4f}', '-f', 'f32le', '-'],
                                 input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
            x = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
            print(f'vo{i + 1}: {d:.2f}s > {room:.2f}s window, atempo {tempo:.3f}')
        out.append((starts[i], x))
    return out


def cmd_measure():
    vo = load_vo()
    path = os.path.join(ROOT, 'src', 'timeline.js')
    src = open(path, encoding='utf-8').read()
    for i, v in enumerate(vo):
        if v is None:
            continue
        d = len(v[1]) / SR
        src = re.sub(rf"(scene: {i + 1}, start: [\d.]+, dur: )[\d.]+", rf"\g<1>{d:.2f}", src)
        print(f'vo{i + 1}: {d:.2f}s')
    open(path, 'w', encoding='utf-8').write(src)


# ---------------------------------------------------------------- synthesis helpers
def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * t / max(r, 1e-4))
    return e


def lp_fast(x, fc):
    # vectorised FFT brick-ish low-pass for long signals
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=len(x), axis=0)


def bp_noise(d, f0, f1, q=6):
    n = int(d * SR)
    w = rng.standard_normal(n)
    X = np.fft.rfft(w); f = np.fft.rfftfreq(n, 1 / SR)
    fc = np.sqrt(f0 * f1); bw = abs(f1 - f0) + fc / q
    X *= np.exp(-((f - fc) / bw) ** 2)
    return np.fft.irfft(X, n)


def stereo(m, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l * 1.414, m * r * 1.414], 1)


def s_pop(f=900, d=0.12, drop=0.5):
    t = t_(d); fr = f * (1 - drop * t / d)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.002, 0.05)


def s_tick(f=3200, d=0.04):
    t = t_(d)
    return (np.sin(2 * np.pi * f * t) * 0.6 + rng.standard_normal(len(t)) * 0.4) * env(len(t), 0.0005, 0.008)


def s_chime(f=1318.5, d=1.2, parts=(1, 2.01, 3.0, 4.2)):
    t = t_(d); x = np.zeros(len(t))
    for k, p in enumerate(parts):
        x += np.sin(2 * np.pi * f * p * t) * (0.6 ** k) * np.exp(-t * (3 + k * 2))
    return x * env(len(t), 0.002, 10, 0)


def s_ping():
    a = s_chime(1567.98, 0.5); b = s_chime(2093.0, 0.6)
    x = np.zeros(int(0.7 * SR)); x[:len(a)] += a; o = int(0.09 * SR); x[o:o + len(b)] += b[:len(x) - o]
    return x * 0.6


def s_whoosh(d=0.6, f0=300, f1=4000, up=True):
    n = int(d * SR); w = rng.standard_normal(n)
    # sweeping band via short-time filtering in chunks
    out = np.zeros(n); ch = 1024
    for i in range(0, n, ch // 2):
        seg = w[i:i + ch]
        if len(seg) < 8: break
        p = i / n; fc = f0 * (f1 / f0) ** (p if up else 1 - p)
        X = np.fft.rfft(seg * np.hanning(len(seg))); f = np.fft.rfftfreq(len(seg), 1 / SR)
        X *= np.exp(-((f - fc) / (fc * 0.6)) ** 2)
        out[i:i + len(seg)] += np.fft.irfft(X, len(seg))
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * e / (np.abs(out).max() + 1e-9)


def s_impact(d=2.5):
    t = t_(d)
    sub = np.sin(2 * np.pi * np.cumsum(60 * np.exp(-t * 3) + 32) / SR) * np.exp(-t * 1.6)
    nz = lp_fast(rng.standard_normal(len(t)), 1800) * np.exp(-t * 7) * 0.8
    return (sub + nz) * env(len(t), 0.002, 10, 0)


def s_riser(d=1.2):
    t = t_(d)
    nz = bp_noise(d, 800, 6000) ; nz /= np.abs(nz).max()
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / d) ** 2) / SR) * 0.3
    return (nz * 0.7 + tone) * (t / d) ** 2


def s_shimmer(d=1.6):
    t = t_(d); x = np.zeros(len(t))
    for f in (1760, 2217.5, 2637, 3520):
        x += np.sin(2 * np.pi * f * t + rng.random() * 6) * (0.5 + 0.5 * np.sin(2 * np.pi * (7 + rng.random() * 4) * t))
    return x * np.exp(-t * 2.2) * np.minimum(1, t / 0.05) * 0.25


def s_thump():
    t = t_(0.35)
    return np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 18) + 55) / SR) * np.exp(-t * 12)


def reverb(x, sec=1.6, mix=0.22):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.5 / sec)[:, None]
    ir[:, 0] = lp_fast(ir[:, 0], 6000); ir[:, 1] = lp_fast(ir[:, 1], 6000)
    L = len(x) + n; nfft = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft, axis=0) * np.fft.rfft(ir, nfft, axis=0), nfft, axis=0)[:len(x)]
    y /= (np.abs(y).max() + 1e-9) / (np.abs(x).max() + 1e-9)
    return x * (1 - mix) + y * mix


def place(buf, clip, t, gain=1.0, pan=0.0):
    c = stereo(clip, pan) if clip.ndim == 1 else clip
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(c)); buf[i:j] += c[:j - i] * gain


# ---------------------------------------------------------------- SFX track
def build_sfx():
    b = np.zeros((N, 2)); F = lambda f: f / FPS
    # Scene 1 — chaos
    spawns = [4, 13, 20, 29, 34, 38, 47, 55, 62, 70, 78, 87, 95, 103]
    for k, f in enumerate(spawns):
        place(b, s_pop(700 + (k % 5) * 90, 0.1), F(f), 0.16, pan=(k % 5 - 2) * 0.3)
    for f in (13, 38, 62, 87):
        place(b, s_ping(), F(f), 0.10, pan=0.4 if f % 2 else -0.4)
    place(b, s_pop(420, 0.25, 0.3), F(128), 0.18)               # "no response" tag
    place(b, s_riser(1.4), F(150), 0.22)
    place(b, s_whoosh(0.8, 400, 5000), F(166), 0.35)             # organising line
    place(b, s_whoosh(0.7, 3000, 200, up=False), F(186), 0.28)   # converge
    # Scene 2 — reveal
    place(b, s_impact(), F(212), 0.55)
    place(b, s_shimmer(2.0), F(248), 0.35)
    for f in (360, 366, 372):
        place(b, s_tick(2400, 0.05), F(f), 0.2)
    for k in range(18):
        place(b, s_tick(3000 + (k % 3) * 400, 0.03), F(380 + k * 3), 0.06, pan=(k % 3 - 1) * 0.5)
    for k, f in enumerate((386, 395, 404)):
        place(b, s_whoosh(0.35, 600, 3000), F(f), 0.18, pan=0.0)
    place(b, s_whoosh(0.6, 300, 3000), F(430), 0.3)
    # Scene 3 — organise & assign
    for k, f in enumerate((460, 469, 478, 487)):
        place(b, s_tick(2600 + k * 200, 0.04), F(f + 16), 0.2)
    place(b, s_whoosh(0.5, 500, 3500), F(504), 0.22)
    place(b, s_chime(987.8, 0.8), F(526), 0.16)                   # phone match
    place(b, s_thump(), F(566), 0.45); place(b, s_chime(1318.5, 1.0), F(568), 0.14)  # merge
    place(b, s_whoosh(0.7, 300, 3000), F(600), 0.3)
    for k in range(5):
        place(b, s_tick(2200, 0.03), F(616 + k * 4), 0.12)
    place(b, s_whoosh(0.5, 800, 4000), F(642), 0.25)
    place(b, s_chime(1567.98, 1.2), F(672), 0.22); place(b, s_pop(1200, 0.08), F(672), 0.1)  # assigned
    place(b, s_whoosh(0.6, 300, 2500), F(700), 0.25)
    for k in range(9):
        place(b, s_tick(1800, 0.035), F(712 + k * 7.5), 0.16)   # SLA timer ticks
    for f in (740, 748, 756):
        place(b, s_pop(880, 0.1, 0.1), F(f), 0.14)                # alert badges
    # Scene 4 — conversations
    place(b, s_whoosh(0.7, 3000, 300, up=False), F(776), 0.3)
    place(b, s_whoosh(0.6, 300, 2500), F(822), 0.3)
    for f in (844, 872, 902):
        place(b, s_pop(1100, 0.09, 0.2), F(f), 0.2); place(b, s_tick(4000, 0.02), F(f), 0.08)
    place(b, s_whoosh(0.5, 400, 2000), F(896), 0.22)
    place(b, s_tick(3000, 0.05), F(936), 0.15)
    place(b, s_whoosh(0.7, 300, 3500), F(982), 0.3)
    place(b, s_ping(), F(1020), 0.24)                             # push notification
    place(b, s_whoosh(0.6, 3000, 300, up=False), F(1048), 0.3)
    # Scene 5 — pipeline
    for h in (30, 80, 130, 180):
        place(b, s_whoosh(0.45, 600, 3000), F(1080 + h), 0.24)
        place(b, s_tick(2000, 0.05), F(1080 + h + 19), 0.2); place(b, s_thump(), F(1080 + h + 19), 0.15)
    place(b, s_chime(1046.5, 1.6), F(1282), 0.22); place(b, s_chime(1568, 1.6), F(1285), 0.16); place(b, s_shimmer(1.5), F(1284), 0.2)
    place(b, s_whoosh(0.9, 300, 3000), F(1378), 0.3)
    # Scene 6 — dashboard
    for k in range(4):
        place(b, s_pop(900 + k * 120, 0.08), F(1416 + k * 5), 0.14)
    for k in range(4):
        place(b, s_whoosh(0.5, 400, 2500), F(1450 + k * 5), 0.08)
    place(b, s_riser(1.2), F(1520), 0.12)
    place(b, s_chime(1318.5, 1.0), F(1556), 0.18)
    place(b, s_tick(2400, 0.05), F(1590), 0.22)
    place(b, s_riser(1.1), F(1616), 0.25)
    # Scene 7 — brand
    place(b, s_impact(3.0), F(1668), 0.55)
    place(b, s_shimmer(2.4), F(1672), 0.35)
    place(b, s_pop(660, 0.2, 0.1), F(1714), 0.14)
    place(b, s_whoosh(0.5, 2000, 8000), F(1740), 0.1)
    return reverb(b, 1.4, 0.2)


# ---------------------------------------------------------------- placeholder music bed (used only without audio/music.*)
def build_music():
    bpm = 118; beat = 60 / bpm; t = np.arange(N) / SR
    m = np.zeros((N, 2))
    # chord roots (Hz) per 2 bars: Dm Bb F C ; final resolve to D major-ish
    prog = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (174.61, 220.0, 261.63), (130.81, 164.81, 196.0)]
    bar2 = beat * 8
    pad = np.zeros(N)
    for i in range(int(DUR / bar2) + 1):
        ch = prog[i % 4]
        if i * bar2 >= 47: ch = (146.83, 185.0, 220.0) if i % 2 == 0 else (196.0, 246.94, 293.66)
        a = int(i * bar2 * SR); bnd = min(N, int((i + 1) * bar2 * SR) + int(0.3 * SR))
        tt = np.arange(bnd - a) / SR
        seg = np.zeros(bnd - a)
        for f in ch:
            for det in (-0.12, 0.0, 0.12):
                ph = 2 * np.pi * f * (1 + det / 100) * tt
                seg += (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph))
        e = np.minimum(1, tt / 0.6) * np.minimum(1, (tt[::-1]) / 0.3)
        pad[a:bnd] += seg * e
    pad = lp_fast(pad, 1600) / 9
    # pad level automation
    lvl = np.interp(t, [0, 6.8, 7.0, 15, 36, 47, 55, 58.5, 60], [0.25, 0.45, 0.9, 0.55, 0.65, 0.8, 0.9, 0.5, 0.0])
    pad *= lvl
    # pulse bass 8ths
    bass = np.zeros(N)
    for k in range(int(DUR / (beat / 2))):
        st = k * beat / 2
        if st < 0.5 or st > 58.8: continue
        root = prog[int(st / bar2) % 4][0] / 2
        if st >= 47: root = 73.42 if int(st / bar2) % 2 == 0 else 98.0
        n = int(0.22 * SR); a = int(st * SR); tt = np.arange(n) / SR
        v = np.sin(2 * np.pi * root * tt) * np.exp(-tt * 9) * (1.0 if k % 2 == 0 else 0.6)
        bass[a:a + n] += v[:N - a]
    bass *= np.interp(t, [0, 7, 15, 36, 47, 55, 60], [0.5, 0.6, 0.8, 1.0, 0.9, 0.6, 0.0])
    # drums
    dr = np.zeros(N)
    kick = s_thump() * 1.4; hat = s_tick(8000, 0.03); clap = bp_noise(0.15, 1000, 2500) * env(int(0.15 * SR), 0.001, 0.05)
    for k in range(int(DUR / beat)):
        st = k * beat
        if 15 <= st < 55 or (7 <= st < 15 and k % 2 == 0):
            place_m(dr, kick, st, 0.9)
        if 15 <= st < 55 and k % 2 == 1:
            place_m(dr, clap / (np.abs(clap).max() + 1e-9), st, 0.25 if st < 36 else 0.35)
    for k in range(int(DUR / (beat / 2))):
        st = k * beat / 2
        if (15 <= st < 55) or (st < 7 and k % 2 == 1):
            place_m(dr, hat, st + (beat / 4 if st >= 36 and k % 2 else 0), 0.18 if st < 36 else 0.24)
    # arp (15–47s)
    arp = np.zeros(N); notes = [587.33, 698.46, 880.0, 698.46]
    for k in range(int(DUR / (beat / 4))):
        st = k * beat / 4
        if not (15 <= st < 47): continue
        f = notes[k % 4] * (0.8909 if int(st / bar2) % 4 == 1 else 1)
        n = int(0.12 * SR); tt = np.arange(n) / SR
        place_m(arp, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 30), st, 0.12 if st < 36 else 0.16)
    mono = pad + bass * 0.55 + dr * 0.5
    m = stereo(mono)
    m += np.stack([np.roll(arp, int(0.011 * SR)), arp], 1)
    m[:, 0] += pad * 0.1; m[:, 1] -= pad * 0.1
    m = reverb(m, 2.2, 0.25)
    # final sonic signature at 55.2 s
    place(m, s_impact(3.5) * 0.7, 55.2, 0.9)
    fade = np.interp(t, [0, 0.3, 58.6, 60], [0, 1, 1, 0])
    return m * fade[:, None] / (np.abs(m).max() + 1e-9) * 0.8


def place_m(buf, clip, t, gain):
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(clip)); buf[i:j] += clip[:j - i] * gain


def cmd_mix():
    os.makedirs(os.path.join(AUD, 'stems'), exist_ok=True)
    sfx = build_sfx()
    mp = find('music')
    if mp:
        music = decode(mp)[:N]
        if len(music) < N:
            music = np.concatenate([music, np.zeros((N - len(music), 2))])
        t = np.arange(N) / SR
        music *= np.interp(t, [0, 0.05, 58.4, 60], [0, 1, 1, 0])[:, None]
        music /= np.abs(music).max() + 1e-9
        print('music:', os.path.basename(mp))
    else:
        music = build_music(); print('music: synthesized placeholder bed')
    vo = np.zeros((N, 2)); have_vo = False
    for item in load_vo():
        if item is None: continue
        st, x = item; have_vo = True
        x = x / (np.abs(x).max() + 1e-9) * 0.9
        place(vo, x, st, 1.0)
    # ducking: envelope follower on the voice
    if have_vo:
        e = np.abs(vo).max(1)
        k = int(0.25 * SR)
        e = np.convolve(e, np.ones(k) / k, 'same')
        duck = 1 - 0.6 * np.clip(e / 0.12, 0, 1)
        music_d = music * duck[:, None]; sfx_d = sfx * (1 - 0.35 * np.clip(e / 0.12, 0, 1))[:, None]
    else:
        music_d, sfx_d = music, sfx
    write_wav(os.path.join(AUD, 'stems', 'music.wav'), music * 0.5)
    write_wav(os.path.join(AUD, 'stems', 'sfx.wav'), sfx / (np.abs(sfx).max() + 1e-9) * 0.7)
    if have_vo:
        write_wav(os.path.join(AUD, 'stems', 'voiceover.wav'), vo)
    mix = music_d * 0.42 + sfx_d * 0.9 + vo * 1.0
    raw = os.path.join(AUD, 'mix_raw.wav'); write_wav(raw, mix / (np.abs(mix).max() + 1e-9) * 0.9)
    # master: loudness normalise for social (-14 LUFS, -1 dBTP)
    subprocess.run([FF, '-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.2:LRA=9', '-ar', str(SR),
                    '-t', f'{DUR:.3f}', '-c:a', 'pcm_s24le', os.path.join(AUD, 'mix.wav')], check=True)
    os.remove(raw)
    print('wrote audio/mix.wav', '(with voice-over)' if have_vo else '(no voice-over files found)')


if __name__ == '__main__':
    {'measure': cmd_measure, 'mix': cmd_mix}[sys.argv[1]]()
