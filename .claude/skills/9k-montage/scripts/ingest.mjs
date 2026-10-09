// node scripts/ingest.mjs [--lang ar|en|auto] [--model medium]
// Reads montage.json → probes the source, transcribes it word by word (whisper.cpp), finds pauses and
// likely retakes, and writes everything the edit needs into work/:
//   probe.json · audio16k.wav · words.json [{w,s,e}] · transcript.md · contact.png · ingest.json (the verdict)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sheet } from '../lib/sheet.mjs';
import { silences, silentShare, ffLog } from '../lib/media.mjs';

const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 && argv[i + 1] ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync('montage.json', 'utf8'));
const SRC = cfg.source;
mkdirSync('work', { recursive: true });
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

// ---- probe (ffmpeg auto-rotates on decode, so report the displayed size) ----
const pj = JSON.parse(sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', SRC]));
const vs = pj.streams.find((s) => s.codec_type === 'video'), as = pj.streams.find((s) => s.codec_type === 'audio');
const rot = Math.abs(+(vs.side_data_list || []).find((d) => d.rotation != null)?.rotation || +vs.tags?.rotate || 0);
const [fn, fd] = vs.r_frame_rate.split('/').map(Number);
const probe = {
  w: rot % 180 ? vs.height : vs.width, h: rot % 180 ? vs.width : vs.height,
  fps: Math.round((fn / fd) * 1000) / 1000, duration: +pj.format.duration, codec: vs.codec_name, audio: !!as,
};
writeFileSync('work/probe.json', JSON.stringify(probe, null, 1));

// ---- audio + transcription ----------------------------------------------------
sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', SRC, '-vn', '-ac', '1', '-ar', '16000', 'work/audio16k.wav']);
const MODELS = join(homedir(), '.cache/hyperframes/whisper/models');
const pick = arg('model', null);
const avail = existsSync(MODELS) ? readdirSync(MODELS).filter((f) => /^ggml-.*\.bin$/.test(f)) : [];
// Multilingual only (no .en) unless the film is English; best first.
const pref = ['large-v3-turbo', 'large-v3', 'medium', 'small'];
const lang = arg('lang', cfg.lang || 'auto');
const model = pick ? `ggml-${pick}.bin`
  : (lang === 'en' && avail.includes('ggml-medium.en.bin')) ? 'ggml-medium.en.bin'
  : pref.map((p) => `ggml-${p}.bin`).find((f) => avail.includes(f));
if (!model) {
  console.error(`No whisper model in ${MODELS}. Download one:\n  curl -L -o ~/.cache/hyperframes/whisper/models/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin`);
  process.exit(1);
}
const dtw = { 'ggml-medium.bin': 'medium', 'ggml-medium.en.bin': 'medium.en', 'ggml-large-v3.bin': 'large.v3', 'ggml-large-v3-turbo.bin': 'large.v3.turbo', 'ggml-small.bin': 'small' }[model];
console.log(`transcribing with ${model} (lang ${lang})…`);
const whisper = (wav, of) => {
  sh('whisper-cli', ['-m', join(MODELS, model), '-l', lang, '-f', wav, '-ml', '1', '-sow', '-oj', '-of', of, '-np', '-t', '8',
    ...(dtw ? ['--dtw', dtw] : []), ...(cfg.prompt ? ['--prompt', cfg.prompt] : [])], { stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(readFileSync(of + '.json', 'utf8')).transcription
    .map((x) => ({ w: x.text.trim().replace(/["“”«»]/g, ''), s: x.offsets.from / 1000, e: x.offsets.to / 1000 }))
    .filter((x) => x.w && !/^\[.*\]$/.test(x.w));
};
let words = whisper('work/audio16k.wav', 'work/whisper');

// ---- holes: whisper drops whole sentences on long files. A word gap that is NOT silent is missed speech:
// re-transcribe just that window and splice the words in.
const sil = silences('work/audio16k.wav', cfg.silenceDb ?? -35, 0.2);
writeFileSync('work/silences.json', JSON.stringify(sil));
const norm = (w) => w.replace(/[^\p{L}\p{N}]/gu, '').replace(/^(و|ف|ب|ك|ل)(?=\p{L}{3,})/u, '');
const repaired = [];
// Bad regions: (a) a word gap ≥ 1 s that is not silent, (b) ≥ 3 words piled on one timestamp (DTW seam).
const bad = [];
const bounds = [0, ...words.flatMap((w) => [w.s, w.e]), probe.duration];
for (let i = 0; i < bounds.length; i += 2) { const [a, b] = [bounds[i], bounds[i + 1]]; if (b - a >= 1 && silentShare(sil, a, b) < 0.6) bad.push([a, b]); }
for (let i = 0; i + 2 < words.length; i++) {
  let j = i; while (j + 1 < words.length && words[j + 1].s - words[i].s < 0.06 * (j + 1 - i)) j++;
  if (j - i >= 2) { bad.push([words[i].s, words[j].e]); i = j; }
}
// Widen each region to the nearest silences (≤ 3 s away) so the re-transcribed window starts and ends between words
const silEndBefore = (t) => sil.filter(([, e]) => e <= t && t - e < 3).map(([, e]) => e).pop() ?? Math.max(0, t - 0.3);
const silStartAfter = (t) => sil.find(([s]) => s >= t && s - t < 3)?.[0] ?? Math.min(probe.duration, t + 1.5);
const regions = bad.map(([a, b]) => [silEndBefore(a), silStartAfter(b)]).sort((x, y) => x[0] - y[0])
  .reduce((acc, r) => { const l = acc.at(-1); if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else acc.push([...r]); return acc; }, []);
for (const [A, B] of regions) {
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(A), '-to', String(B), '-i', 'work/audio16k.wav', 'work/hole.wav']);
  // A word belongs to the region if it STARTS inside it — same rule for old and new, so edges never double up
  const add = whisper('work/hole.wav', 'work/hole').map((w) => ({ ...w, s: +(w.s + A).toFixed(3), e: +Math.min(w.e + A, B).toFixed(3), fixed: true }))
    .filter((w) => w.s < B - 0.02);
  if (!add.length) continue;
  // Replace only the span the second pass actually covered; originals outside it (a window that ended
  // mid-sentence) stay. Then drop a duplicated word at either seam.
  const a0 = add[0].s, a1 = add.at(-1).e;
  const old = words.filter((w) => w.s >= Math.min(A, a0) - 0.02 && w.s < B && w.s < a1 - 0.05);
  const keepW = words.filter((w) => !old.includes(w));
  const prev = keepW.filter((w) => w.s < a0).at(-1), next = keepW.find((w) => w.s >= a1 - 0.05);
  const same = (x, y) => x && y && norm(x.w) === norm(y.w);
  if (same(prev, add[0]) && a0 - prev.e < 0.6) add.shift();
  if (same(next, add.at(-1)) && next.s - a1 < 0.6) add.pop();
  if (add.length >= old.length * 0.7) { // only replace when the second pass heard at least as much
    words = keepW.concat(add);
    repaired.push({ from: +A.toFixed(2), to: +B.toFixed(2), words: add.length, replaced: old.length });
  }
}
words.sort((x, y) => x.s - y.s);
if (repaired.length) console.log(`re-transcribed ${repaired.length} region(s) whisper skipped or piled up:`, repaired.map((r) => `${r.from}–${r.to}s`).join(', '));
writeFileSync('work/words.json', JSON.stringify(words));

// ---- cuts already in the source (a rough cut has its own jump cuts): the camera alternates on these too
const sceneLog = ffLog(['-i', SRC, '-vf', `scale=180:-2,select='gt(scene,${+(cfg.sceneThreshold ?? 0.22)})',showinfo`, '-an', '-f', 'null', '-']);
const scenes = (sceneLog.match(/pts_time:[0-9.]+/g) || []).map((l) => +l.split(':')[1]).filter((t) => t > 0.3 && t < probe.duration - 0.3).map((t) => +t.toFixed(3));
writeFileSync('work/scenes.json', JSON.stringify(scenes));

// ---- pauses and retakes ---------------------------------------------------------
const gaps = sil.filter(([a, b]) => b - a >= 0.5).map(([a, b]) => ({ at: a, len: +(b - a).toFixed(2) }));
// A retake: the same 3-word run spoken twice within 25 s. The first take is usually the one to drop.
const retakes = [];
for (let i = 0; i + 3 <= words.length; i++) {
  const k = words.slice(i, i + 3).map((x) => norm(x.w)).join(' ');
  if (k.replace(/ /g, '').length < 6) continue;
  for (let j = i + 3; j + 3 <= words.length && words[j].s - words[i].s < 25; j++) {
    if (words.slice(j, j + 3).map((x) => norm(x.w)).join(' ') === k) {
      if (!retakes.some((r) => Math.abs(r.first - words[i].s) < 2)) retakes.push({ first: +words[i].s.toFixed(2), again: +words[j].s.toFixed(2), phrase: words.slice(i, i + 3).map((x) => x.w).join(' ') });
      break;
    }
  }
}
const pauseTotal = gaps.reduce((a, g) => a + g.len, 0);
const speech = words.reduce((a, w) => a + (w.e - w.s), 0);
const kind = retakes.length >= 2 || pauseTotal / probe.duration > 0.12 || gaps.some((g) => g.len > 2.5) ? 'raw' : 'rough';

// ---- readable transcript: one line per phrase, pauses and retakes marked -------------
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
let md = `# Transcript (source time)\n\n${probe.w}x${probe.h} · ${probe.fps} fps · ${probe.duration.toFixed(1)} s · verdict: **${kind}** · ‹word› = re-transcribed region\n\n`;
let line = [], ls = 0;
const flush = (i) => { if (line.length) md += `[${fmt(ls)}–${fmt(words[i - 1].e)}] ${line.join(' ')}\n`; line = []; };
words.forEach((w, i) => {
  const gap = i ? w.s - words[i - 1].e : 0;
  if (i && (gap >= 0.35 || line.length >= 14)) {
    flush(i);
    if (gap >= 0.5) md += silentShare(sil, words[i - 1].e, w.s) > 0.6 ? `    ── ${gap.toFixed(1)} s pause ──\n` : `    ⚠ ${gap.toFixed(1)} s of speech with no words (whisper missed it — listen, then add captions.override)\n`;
  }
  if (!line.length) ls = w.s;
  const rt = retakes.find((r) => Math.abs(r.again - w.s) < 0.01);
  if (rt) { flush(i); ls = w.s; md += `    ⟲ possible retake of ${fmt(rt.first)} “${rt.phrase}”\n`; }
  line.push(w.fixed ? `‹${w.w}›` : w.w);
});
flush(words.length);
writeFileSync('work/transcript.md', md);

// ---- contact sheet with timestamps: 24 frames over the whole video ---------------------------
const land = probe.w > probe.h;
await sheet(SRC, 'work/contact.png', { times: Array.from({ length: 24 }, (_, i) => +((probe.duration * (i + 0.5)) / 24).toFixed(2)), cols: land ? 4 : 8, tile: land ? 400 : 220 });

const verdict = {
  kind, duration: +probe.duration.toFixed(2), words: words.length, wpm: Math.round(words.length / (speech / 60 || 1)),
  pauses: gaps.length, pauseSeconds: +pauseTotal.toFixed(1), longestPause: Math.max(0, ...gaps.map((g) => g.len)),
  sourceCuts: scenes.length, retakes, repaired, model, lang,
};
writeFileSync('work/ingest.json', JSON.stringify(verdict, null, 1));
console.log(JSON.stringify({ ...verdict, retakes: retakes.length }, null, 1));
console.log('→ work/transcript.md · work/words.json · work/contact.png — read the transcript and LOOK at the contact sheet.');
