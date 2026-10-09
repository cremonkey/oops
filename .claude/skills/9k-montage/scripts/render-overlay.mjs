// node scripts/render-overlay.mjs [--from 0 --to DUR] [--stills 0.5 | --at 1.2,4.8] [--workers 4]
// 1. Builds work/edit.data.js (edit.json + caption chunks + icon paths) for overlay.html.
// 2. Writes work/captions.json and work/cues.auto.json (the SFX every graphic asks for).
// 3. Renders the transparent overlay as a PNG sequence → work/overlay/000000.png … (one per output frame),
//    or with --stills/--at: overlay-over-footage stills → out/stills/ + out/contact.png (no full render).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { chunk } from '../lib/captions.mjs';
import { events, cameraFilterAt } from '../lib/camera.mjs';
import { sheet } from '../lib/sheet.mjs';

const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const edit = JSON.parse(readFileSync('edit.json', 'utf8'));
const cut = JSON.parse(readFileSync('work/cut.json', 'utf8'));
const words = JSON.parse(readFileSync('work/words.cut.json', 'utf8'));
const F = { w: 1080, h: 1920, fps: 30, ...(edit.format || {}) };
const DUR = cut.duration;

// ---- data ---------------------------------------------------------------------------
const capOpts = edit.captions || {};
const chunks = chunk(words, capOpts, DUR);
writeFileSync('work/captions.json', JSON.stringify(chunks));
const icons = {};
const slugs = new Set();
for (const x of edit.graphics || []) { if (x.icon) slugs.add(x.icon); for (const it of [...(x.items || []), x.a, x.b].filter(Boolean)) if (it.icon) slugs.add(it.icon); }
if (slugs.size) {
  const si = await import('simple-icons');
  for (const s of slugs) {
    const key = 'si' + s.replace(/[^a-z0-9]/gi, '').replace(/^./, (c) => c.toUpperCase());
    const ic = si[key] || Object.values(si).find((v) => v?.slug === s);
    if (ic) icons[s] = { path: ic.path, hex: ic.hex, title: ic.title };
    else console.warn(`icon "${s}" not in simple-icons — check the slug at simpleicons.org`);
  }
}
// Images go in as data URLs: a file:// image taints the canvas and the frame can't be exported.
const images = {};
for (const x of edit.graphics || []) if (x.src && !images[x.src]) {
  const ext = x.src.split('.').pop().toLowerCase(), mime = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif', svg: 'svg+xml' }[ext] || 'png';
  images[x.src] = `data:image/${mime};base64,` + readFileSync(x.src).toString('base64');
}
const data = {
  format: F, dir: edit.dir || 'ltr', theme: edit.theme || 'dark', duration: DUR,
  captions: capOpts.style === 'off' ? null : chunks, captionStyle: { size: capOpts.size, y: capOpts.y },
  graphics: (edit.graphics || []).map((x) => ({ dur: 2.5, ...x })), icons, images,
  cuts: JSON.parse(readFileSync('work/cuts.json', 'utf8')),
};
writeFileSync('work/edit.data.js', 'window.EDIT = ' + JSON.stringify(data) + ';\n');

// ---- browser ------------------------------------------------------------------------
const browser = await chromium.launch();
async function openPage() {
  const page = await browser.newPage({ viewport: { width: F.w, height: F.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`file://${process.cwd()}/overlay.html`);
  await page.evaluate(() => window.ready);
  return page;
}
const first = await openPage();
writeFileSync('work/cues.auto.json', JSON.stringify(await first.evaluate(() => window.cues()), null, 0));

const grab = (page, t) => page.evaluate((t) => { const n = window.seek(t); return n ? document.getElementById('c').toDataURL('image/png') : null; }, t);

// ---- stills mode: overlay composited on the cut footage, for the critique loop -------------------
const every = arg('stills', null), at = arg('at', null);
if (every || at) {
  const times = at ? at.split(',').map(Number) : Array.from({ length: Math.floor(DUR / +every) }, (_, i) => +(i * +every + +every / 2).toFixed(2));
  rmSync('out/stills', { recursive: true, force: true }); mkdirSync('out/stills', { recursive: true });
  const cam = events(edit.camera, data.cuts);
  let n = 0; const files = [];
  for (const t of times) {
    const name = `out/stills/${String(n++).padStart(3, '0')}_${t.toFixed(2)}s`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', 'work/cut.mov', '-frames:v', '1',
      '-vf', cameraFilterAt(cam, t, cut.w, cut.h, F.w, F.h), name + '_bg.png']);
    const png = await grab(first, t);
    if (png) {
      writeFileSync(name + '_ov.png', Buffer.from(png.split(',')[1], 'base64'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', name + '_bg.png', '-i', name + '_ov.png', '-filter_complex', 'overlay', name + '.png']);
      rmSync(name + '_ov.png'); rmSync(name + '_bg.png');
    } else execFileSync('mv', [name + '_bg.png', name + '.png']);
    files.push({ t, file: name + '.png' });
  }
  await sheet(null, 'out/contact.png', { files, cols: F.w > F.h ? 4 : 6, tile: F.w > F.h ? 480 : 300 });
  console.log(`${times.length} stills → out/stills/ · out/contact.png (with camera zoom)`);
  await browser.close(); process.exit(0);
}

// ---- full render: N pages in parallel, transparent PNG per frame ---------------------------
const FROM = +arg('from', 0), TO = Math.min(DUR, +arg('to', DUR));
const f0 = Math.round(FROM * F.fps), f1 = Math.round(TO * F.fps);
mkdirSync('work/overlay', { recursive: true });
if (FROM === 0 && TO === DUR) { rmSync('work/overlay', { recursive: true, force: true }); mkdirSync('work/overlay', { recursive: true }); }
const EMPTY = 'work/overlay.empty.png';
if (!existsSync(EMPTY)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${F.w}x${F.h},format=rgba`, '-frames:v', '1', EMPTY]);
const N = +arg('workers', 4);
const pages = [first, ...(await Promise.all(Array.from({ length: N - 1 }, openPage)))];
let done = 0; const t0 = Date.now();
await Promise.all(pages.map(async (page, w) => {
  for (let f = f0 + w; f < f1; f += N) {
    const png = await grab(page, f / F.fps), file = `work/overlay/${String(f).padStart(6, '0')}.png`;
    if (png) writeFileSync(file, Buffer.from(png.split(',')[1], 'base64')); else copyFileSync(EMPTY, file);
    if (++done % (F.fps * 5) === 0) console.log(`overlay ${(done / F.fps).toFixed(0)} s / ${((f1 - f0) / F.fps).toFixed(0)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
  }
}));
await browser.close();
// Pad to the full frame count so compose always finds a frame
for (let f = 0; f < Math.round(DUR * F.fps); f++) { const file = `work/overlay/${String(f).padStart(6, '0')}.png`; if (!existsSync(file)) copyFileSync(EMPTY, file); }
console.log(`→ work/overlay/ (${f1 - f0} frames) · work/captions.json (${chunks.length} chunks) · work/cues.auto.json`);
