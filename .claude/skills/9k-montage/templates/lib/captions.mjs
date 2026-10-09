// Caption chunking for montage overlays. Pure Node: render-overlay.mjs calls it and writes work/captions.json,
// so the exact chunks are reviewable before anything renders.  node lib/captions.mjs  → prints the chunks.
//
// edit.json → captions: {
//   style: "word" | "phrase" | "off",  maxWords: 4, maxChars: 24, gap: 0.3,
//   fixes: { "كريستيان": "كريستيانو", "even you": "Evan You" },   // whisper mishearings; keys may span words
//   keywords: ["Vue.js", "React", "90%"],                           // get the accent when spoken
//   hide: [[0, 5.4]],                                               // output-time ranges with no captions
//   override: [{ "s": 12.3, "e": 14.0, "text": "…", "at": [12.3, 12.7, …]? }] // replace the WORDS in [s, e); chunked normally
// }
import { readFileSync, writeFileSync } from 'node:fs';

const AR = /[\u0621-\u064A\u0671-\u06D3]/, LATIN = /[A-Za-z0-9]/; // letters only: '،' or '؟' don't make a Latin word Arabic
const bare = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%.+#]/gu, '').replace(/\.$/, '');
const PUNCT_END = /[.?!،؟…:]$/;

export function applyFixes(words, fixes = {}) {
  let out = words.map((w) => ({ ...w }));
  for (const [from, to] of Object.entries(fixes)) {
    const pat = from.split(/\s+/).map(bare), rep = to.split(/\s+/);
    const next = [];
    for (let i = 0; i < out.length; i++) {
      if (pat.every((p, k) => out[i + k] && bare(out[i + k].w) === p)) {
        const s = out[i].s, e = out[i + pat.length - 1].e, step = (e - s) / rep.length;
        // keep the original trailing punctuation if the replacement has none
        const tail = (out[i + pat.length - 1].w.match(/[.?!،؟…,]+$/) || [''])[0];
        rep.forEach((r, k) => next.push({ w: k === rep.length - 1 && !PUNCT_END.test(r) ? r + tail : r, s: s + k * step, e: s + (k + 1) * step }));
        i += pat.length - 1;
      } else next.push(out[i]);
    }
    out = next;
  }
  // Degenerate timings (several words on one timestamp, common at whisper seams) → spread them evenly
  // between the run's start and the next good word.
  for (let i = 0; i < out.length; i++) {
    let j = i; while (j + 1 < out.length && out[j + 1].s - out[i].s < 0.03 * (j + 1 - i)) j++;
    if (j > i) {
      const a = out[i].s, b = Math.max(out[j].e, out[j + 1]?.s ?? out[j].e), step = (b - a) / (j - i + 1);
      for (let k = i; k <= j; k++) { out[k].s = a + (k - i) * step; out[k].e = a + (k - i + 1) * step; }
      i = j;
    }
  }
  // "كReactivity" / "وDeveloper": whisper glues Arabic proclitics to Latin words. Split them so the
  // Latin word gets the Latin font and its own LTR run.
  return out.flatMap((w) => {
    const m = w.w.match(/^([؀-ۿ]{1,2})([A-Za-z].*)$/);
    if (!m) return [w];
    const mid = w.s + (w.e - w.s) * 0.25;
    return [{ w: m[1], s: w.s, e: mid }, { w: m[2], s: mid, e: w.e }];
  });
}

export function chunk(words, opts = {}, duration = Infinity) {
  const o = { style: 'word', maxWords: 4, maxChars: 24, gap: 0.3, keywords: [], hide: [], override: [], ...opts };
  if (o.style === 'off') return [];
  if (o.style === 'phrase') { o.maxWords = Math.max(o.maxWords, 7); o.maxChars = Math.max(o.maxChars, 38); }
  const kw = new Set(o.keywords.map(bare));
  const hidden = (t) => o.hide.some(([a, b]) => t >= a && t < b);
  let ws = applyFixes(words, o.fixes);
  // Overrides work on WORDS: drop whisper's words in [s, e), insert the given text (evenly timed, or at `at`),
  // then everything is chunked by the normal rules.
  for (const ov of o.override) {
    const parts = ov.text.split(/\s+/).filter(Boolean), step = (ov.e - ov.s) / parts.length;
    ws = ws.filter((w) => w.s < ov.s || w.s >= ov.e).concat(parts.map((w, k) => {
      const s = ov.at?.[k] ?? ov.s + k * step, e = ov.at?.[k + 1] ?? Math.min(ov.e, s + step);
      return { w, s, e };
    })).sort((a, b) => a.s - b.s);
  }
  ws = ws.filter((w) => !hidden(w.s));
  const chunks = []; let cur = [];
  const push = () => { if (cur.length) chunks.push(cur); cur = []; };
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    const chars = cur.reduce((a, x) => a + [...x.w].length + 1, 0) + [...w.w].length;
    if (cur.length && (w.s - prev.e > o.gap || cur.length >= o.maxWords || chars > o.maxChars || PUNCT_END.test(prev.w))) push();
    cur.push(w);
  });
  push();
  // A chunk never ends on a connector ("و", "في", "of"): it reads as a cliff-hanger. Hand it to the next chunk.
  const WEAK = new Set(['و', 'ف', 'في', 'من', 'لو', 'عن', 'على', 'يا', 'ما', 'بس', 'اللي', 'إن', 'أن', 'and', 'the', 'of', 'to', 'a', 'in']);
  for (let i = 0; i < chunks.length - 1; i++) {
    const c = chunks[i];
    if (c.length > 1 && WEAK.has(bare(c.at(-1).w)) && chunks[i + 1][0].s - c.at(-1).e < o.gap) chunks[i + 1].unshift(c.pop());
  }
  // No one-word orphans when the next chunk follows straight on
  for (let i = chunks.length - 1; i > 0; i--) {
    if (chunks[i].length === 1 && chunks[i][0].s - chunks[i - 1].at(-1).e < 0.15 && chunks[i - 1].length < o.maxWords + 1) {
      chunks[i - 1].push(...chunks[i]); chunks.splice(i, 1);
    }
  }
  let res = chunks.map((c) => ({
    s: +c[0].s.toFixed(3), e: +c.at(-1).e.toFixed(3),
    tokens: c.map((w) => ({ w: w.w, s: +w.s.toFixed(3), e: +w.e.toFixed(3), latin: !AR.test(w.w) && LATIN.test(w.w), kw: kw.has(bare(w.w)) || /^\d+([.,]\d+)?%?$/.test(bare(w.w)) })),
  }));
  // Only one accent per chunk: the first keyword keeps it.
  for (const c of res) { let seen = false; for (const t of c.tokens) { if (t.kw && seen) t.kw = false; if (t.kw) seen = true; } }
  res.sort((a, b) => a.s - b.s);
  // Hold each chunk until the next starts (bridges breaths), max 0.6 s past its last word
  // ...and never into a hidden range (a source insert or burned text starts there)
  const nextHide = (t) => Math.min(...o.hide.map(([a]) => a).filter((a) => a > t), Infinity);
  res.forEach((c, i) => { c.end = +Math.min(res[i + 1]?.s ?? duration, c.e + 0.6, duration, nextHide(c.s)).toFixed(3); });
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const edit = JSON.parse(readFileSync('edit.json', 'utf8'));
  const words = JSON.parse(readFileSync('work/words.cut.json', 'utf8'));
  const chunks = chunk(words, edit.captions || {});
  writeFileSync('work/captions.json', JSON.stringify(chunks));
  const fmt = (t) => t.toFixed(2).padStart(6);
  for (const c of chunks) console.log(`${fmt(c.s)}–${fmt(c.end)}  ${c.tokens.map((t) => (t.kw ? `[${t.w}]` : t.w)).join(' ')}`);
  console.log(`${chunks.length} chunks → work/captions.json  ([x] = accent keyword)`);
}
