// node scripts/cut.mjs [--preview]
// Applies edit.json → cut to the source: tightens pauses between words, drops retakes/flubs, and writes
//   work/keep.json   [[srcIn, srcOut], …]           the segments kept, in source seconds
//   work/cuts.json   [outT, …]                        where the jump cuts land in OUTPUT time
//   work/cut.mov     the cut footage, CFR, sized with zoom headroom (≈1.33× the output) + work/cut.proxy.mp4 for overlay.html
//   work/words.cut.json + work/transcript.cut.md     the words remapped to output time
// Every later step (captions, graphics, camera, SFX) works in OUTPUT time.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { silences } from '../lib/media.mjs';

const cfg = JSON.parse(readFileSync('montage.json', 'utf8'));
const edit = JSON.parse(readFileSync('edit.json', 'utf8'));
const probe = JSON.parse(readFileSync('work/probe.json', 'utf8'));
const words = JSON.parse(readFileSync('work/words.json', 'utf8'));
const C = { maxPause: 0.35, padIn: 0.08, padOut: 0.1, minKeep: 0.25, drop: [], keepAll: false, ...(edit.cut || {}) };
const F = { w: 1080, h: 1920, fps: 30, ...(edit.format || {}) };
const DUR = probe.duration;
const TAIL = +(edit.tail || 0); // seconds of held last frame after the speech, for an end card

// ---- 1. tighten pauses: every SILENT stretch longer than maxPause shrinks to padOut + padIn ----------------
// Measured from the audio, not from word gaps (whisper can skip speech; a word gap is not proof of silence).
let keep = [[0, DUR]];
const sil = silences('work/audio16k.wav', C.silenceDb ?? -35, 0.2);
const remove = (a, b) => { keep = keep.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [a > s ? [s, a] : null, b < e ? [b, e] : null].filter(Boolean))); };
if (!C.keepAll && !C.keep) {
  for (const [a, b] of sil) {
    const head = a <= 0.05, tail = b >= DUR - 0.05;
    if (!head && !tail && b - a <= C.maxPause) continue;
    remove(head ? 0 : a + C.padOut, tail ? DUR : b - C.padIn);
  }
} else if (C.keep) keep = C.keep;
// ---- 2. drops (retakes, flubs, off-topic): [[srcIn, srcOut, "reason"], …] ----------------------
for (const [a, b] of C.drop) remove(a, b);
keep = keep.filter(([s, e]) => e - s >= C.minKeep).map(([s, e]) => [+s.toFixed(3), +e.toFixed(3)]);
if (!keep.length) { console.error('nothing kept — check edit.json cut'); process.exit(1); }

// ---- 3. remap words + cut points to output time -------------------------------------------------
const offs = []; let acc = 0;
for (const [s, e] of keep) { offs.push(acc - s); acc += e - s; }
const outWords = words.map((w) => {
  let i = keep.findIndex(([a, b]) => w.e > a && w.s < b);   // a word straddling a cut keeps its kept part
  if (i < 0) {
    // Whisper sometimes stamps a word inside a silence the cut removed; the word itself is in the kept audio
    // right after. Snap it to the next kept segment (unless it was dropped on purpose).
    const j = keep.findIndex(([a]) => a >= w.e && a - w.e < 0.6);
    if (j < 0 || C.drop.some(([a, b]) => w.s >= a && w.e <= b)) return null;
    const s = keep[j][0] + offs[j], d = Math.min(0.3, w.e - w.s);
    return { w: w.w, s: +s.toFixed(3), e: +(s + d).toFixed(3) };
  }
  const s = Math.max(w.s, keep[i][0]) + offs[i], e = Math.min(w.e, keep[i][1]) + offs[i];
  return { w: w.w, s: +s.toFixed(3), e: +Math.max(e, s + 0.04).toFixed(3) };
}).filter(Boolean);
const OUT_DUR = acc + TAIL;
const cuts = []; acc = 0;
for (let i = 0; i < keep.length - 1; i++) { acc += keep[i][1] - keep[i][0]; cuts.push(+acc.toFixed(3)); }
// Cuts already in the source (scene changes found by ingest) land in the same list, so the camera treats them alike.
const scenes = existsSync('work/scenes.json') ? JSON.parse(readFileSync('work/scenes.json', 'utf8')) : [];
for (const sc of scenes) {
  const i = keep.findIndex(([a, b]) => sc > a + 0.05 && sc < b - 0.05);
  if (i >= 0) { const o = sc + offs[i]; if (!cuts.some((c) => Math.abs(c - o) < 0.3)) cuts.push(+o.toFixed(3)); }
}
cuts.sort((a, b) => a - b);
writeFileSync('work/keep.json', JSON.stringify(keep));
writeFileSync('work/cuts.json', JSON.stringify(cuts));
writeFileSync('work/words.cut.json', JSON.stringify(outWords));

const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
let md = `# Transcript (OUTPUT time, after the cut)\n\n${DUR.toFixed(1)} s → ${OUT_DUR.toFixed(1)} s · ${keep.length} segments · ✂ = jump cut\n\n`;
let line = [], ls = 0, ci = 0;
outWords.forEach((w, i) => {
  const cutHere = ci < cuts.length && w.s >= cuts[ci] - 0.01;
  if (line.length && (cutHere || w.s - outWords[i - 1].e > 0.3 || line.length >= 12)) { md += `[${fmt(ls)}–${fmt(outWords[i - 1].e)}] ${line.join(' ')}\n`; line = []; }
  if (cutHere) { while (ci < cuts.length && w.s >= cuts[ci] - 0.01) ci++; md += `  ✂ ${fmt(cuts[ci - 1])}\n`; }
  if (!line.length) ls = w.s;
  line.push(w.w);
});
if (line.length) md += `[${fmt(ls)}–${fmt(outWords.at(-1).e)}] ${line.join(' ')}\n`;
writeFileSync('work/transcript.cut.md', md);

// ---- 4. render the cut: trim+concat with 10 ms audio fades so no cut clicks -------------------------
// Size: cover the output with ~1.33× headroom so punch-ins stay sharp, never upscaling past the source.
const head = 1.34, ar = probe.w / probe.h, outAr = F.w / F.h;
let cw = ar > outAr ? F.h * head * ar : F.w * head, ch = cw / ar;
const shrink = Math.min(1, probe.w / cw); cw = Math.round((cw * shrink) / 2) * 2; ch = Math.round((ch * shrink) / 2) * 2;
const lines = keep.map(([s, e], i) => {
  const d = (e - s).toFixed(3), fo = Math.max(0, e - s - 0.01).toFixed(3);
  return `[0:v]trim=${s}:${e},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${s}:${e},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${fo}:d=0.01[a${i}];`;
});
const graph = lines.join('\n') + '\n' + keep.map((_, i) => `[v${i}][a${i}]`).join('') +
  `concat=n=${keep.length}:v=1:a=1[cv][ca0];[cv]fps=${F.fps},scale=${cw}:${ch}:flags=lanczos,setsar=1` +
  (TAIL ? `,tpad=stop_mode=clone:stop_duration=${TAIL}[vout];[ca0]apad=pad_dur=${TAIL}[ca]` : '[vout];[ca0]anull[ca]');
writeFileSync('work/cut.graph', graph);
const preview = process.argv.includes('--preview');
console.log(`cutting ${keep.length} segments → ${cw}x${ch} @ ${F.fps} fps…`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', cfg.source, '-/filter_complex', 'work/cut.graph',
  '-map', '[vout]', '-map', '[ca]', '-c:v', 'libx264', '-preset', preview ? 'ultrafast' : 'fast', '-crf', preview ? '23' : '15',
  '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', '48000', 'work/cut.mov'], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'work/cut.mov', '-vf', `scale=${F.w / 2}:${F.h / 2}:force_original_aspect_ratio=increase,crop=${F.w / 2}:${F.h / 2}`,
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k', 'work/cut.proxy.mp4']);
const outDur = OUT_DUR;
writeFileSync('work/cut.json', JSON.stringify({ w: cw, h: ch, fps: F.fps, duration: +outDur.toFixed(3), segments: keep.length, removed: +(DUR - (outDur - TAIL)).toFixed(2), tail: TAIL }, null, 1));
console.log(`→ work/cut.mov  ${DUR.toFixed(1)} s → ${outDur.toFixed(1)} s (${keep.length} segments, ${cuts.length} jump cuts)`);
console.log('→ work/transcript.cut.md — plan graphics and captions against THIS file (output time).');
