// node lib/audio.mjs cues.json out/audio.wav
// Synthesizes a minimal score + SFX on the same timeline as the picture. Deterministic (seeded noise).
// cues.json: { "dur": 10, "bpm": 120, "music": true, "root": 57,
//              "sfx": [{ "t": 0.1, "type": "type", "text": "Ismail9k", "cps": 14 }, { "t": 2.6, "type": "whoosh" }] }
// sfx types: click · pop · thump · whoosh · tick · type (one tick per character at cps) · ding
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SR = 48000;
const cue = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || 'out/audio.wav';
// Two buses: the music fade-out must never swallow SFX that land after musicTo (an end-card ding).
const LEN = Math.ceil((cue.dur + 1) * SR);
const sfxBus = new Float32Array(LEN), musBus = new Float32Array(LEN);
let seed = 42; const noise = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2147483648 - 1;
const TAU = 2 * Math.PI, mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function add(bus, t0, len, fn, gain = 1) {
  const s = Math.floor(t0 * SR);
  for (let i = 0; i < len * SR && s + i < bus.length; i++) if (s + i >= 0) bus[s + i] += fn(i / SR) * gain;
}

// ---- SFX ---------------------------------------------------------------------
const VOICES = {
  click: [0.05, (t) => Math.sin(TAU * 1800 * t) * Math.exp(-t * 90) * 0.5],
  tick: [0.03, (t) => { const n = noise(); return (n * 0.6 + Math.sin(TAU * 3200 * t) * 0.4) * Math.exp(-t * 160) * 0.35; }],
  pop: [0.15, (t) => Math.sin(TAU * (600 + 900 * t) * t) * Math.exp(-t * 30) * 0.4],
  thump: [0.5, (t) => Math.sin(TAU * (90 - 60 * t) * t) * Math.exp(-t * 9) * 0.9],
  whoosh: [0.35, (t) => noise() * Math.sin(Math.PI * Math.min(1, t / 0.35)) * 0.22],
  ding: [0.9, (t) => (Math.sin(TAU * 1318.5 * t) + 0.4 * Math.sin(TAU * 2637 * t)) * Math.exp(-t * 6) * 0.22],
};
for (const c of cue.sfx || []) {
  if (c.type === 'type') {                       // typing: one tick per visible character, slight seeded jitter
    const n = [...(c.text || '')].length || c.count || 8, cps = c.cps || 16;
    for (let i = 0; i < n; i++) add(sfxBus, c.t + i / cps + noise() * 0.006, ...VOICES.tick, c.gain ?? 1);
  } else if (VOICES[c.type]) add(sfxBus, c.t, ...VOICES[c.type], c.gain ?? 1);
}

// ---- Music: kick, hats, bass, plucked arpeggio. No pads. ----------------------
// The beat grid is anchored at t = 0, not at musicFrom: a late start still puts bar lines (and chord
// changes) on multiples of 4 beats, so they land on the picture's act seams.
if (cue.music) {
  const bpm = cue.bpm || 120, beat = 60 / bpm, root = cue.root || 57; // A3
  const prog = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];      // i – VI – III – VII, one chord per bar
  const start = cue.musicFrom || 0, end = Math.min(cue.dur, cue.musicTo || cue.dur);
  for (let b = Math.ceil(start / beat - 1e-9); b * beat < end; b++) {
    const t = b * beat, chord = prog[Math.floor(b / 4) % prog.length];
    add(musBus, t, 0.45, (x) => Math.sin(TAU * (55 + 70 * Math.exp(-x * 30)) * x) * Math.exp(-x * 8), 0.55);            // kick
    add(musBus, t + beat / 2, 0.06, (x) => { const n = noise(); return n * Math.exp(-x * 70); }, 0.08);                 // off-beat hat
    add(musBus, t, beat * 0.9, (x) => { const f = mtof(root - 12 + chord[0]); return (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x)) * Math.exp(-x * 3); }, 0.22); // bass
    for (let k = 0; k < 2; k++) {                                                                                         // 8th-note pluck arp
      const note = root + 12 + chord[(b * 2 + k) % 3], f = mtof(note);
      add(musBus, t + k * beat / 2, 0.4, (x) => { const tri = 2 / Math.PI * Math.asin(Math.sin(TAU * f * x)); return tri * Math.exp(-x * 9); }, 0.1);
    }
  }
  const fade = Math.min(1.5, end - start), fs = Math.floor((end - fade) * SR), fe = Math.floor(end * SR);
  for (let i = Math.max(0, fs); i < LEN; i++) musBus[i] *= i < fe ? 1 - (i - fs) / (fe - fs) : 0;  // music bus only
}

// ---- mix + 16-bit mono WAV ---------------------------------------------------
const buf = new Float32Array(LEN); for (let i = 0; i < LEN; i++) buf[i] = sfxBus[i] + musBus[i];
const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, norm = peak > 0.95 ? 0.95 / peak : 1;
const n = buf.length, b = Buffer.alloc(44 + n * 2);
b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8);
b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * norm)) * 32767), 44 + i * 2);
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, b);
console.log(`→ ${out}`);
