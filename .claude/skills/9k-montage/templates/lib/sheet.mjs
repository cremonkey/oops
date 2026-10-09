// Labelled contact sheets without ffmpeg drawtext (Homebrew ffmpeg often ships without freetype).
//   node lib/sheet.mjs <video> <out.png> [--every 2 | --at 1.2,3.4 | --n 30] [--cols 6] [--tile 270] [--from 10]
// Frames come from ffmpeg; Chromium tiles them and stamps each with its timestamp.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// video + times → frames are grabbed from the video; or files: [{ t, file }] → existing PNG/JPGs are tiled.
export async function sheet(video, out, { times, files, cols = 6, tile = 270 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
  // Every frame is downscaled to a small JPEG first: full-size PNGs as data URLs can crash Chromium.
  const imgs = (files || times.map((t) => ({ t }))).map(({ t, file }, i) => {
    const f = join(dir, `${i}.jpg`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...(file ? ['-i', file] : ['-ss', String(t), '-i', video]), '-frames:v', '1', '-vf', `scale=${tile * 2}:-2`, '-q:v', '3', f]);
    return { t, src: 'data:image/jpeg;base64,' + readFileSync(f).toString('base64') };
  });
  rmSync(dir, { recursive: true, force: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = await page.evaluate(async ({ imgs, cols, tile }) => {
    const els = await Promise.all(imgs.map((x) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = x.src; })));
    const th = Math.round(tile * els[0].height / els[0].width), pad = 4, rows = Math.ceil(els.length / cols);
    const c = document.createElement('canvas'); c.width = cols * (tile + pad) + pad; c.height = rows * (th + pad) + pad;
    const g = c.getContext('2d'); g.fillStyle = '#0F0F0F'; g.fillRect(0, 0, c.width, c.height);
    els.forEach((im, i) => {
      const x = pad + (i % cols) * (tile + pad), y = pad + Math.floor(i / cols) * (th + pad);
      g.drawImage(im, x, y, tile, th);
      const t = imgs[i].t, label = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
      g.font = '600 15px ui-monospace, monospace'; const w = g.measureText(label).width + 10;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x + 4, y + 4, w, 21); g.fillStyle = '#fff'; g.fillText(label, x + 9, y + 20);
    });
    return c.toDataURL('image/png');
  }, { imgs, cols, tile });
  await browser.close();
  writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  return out;
}

export function duration(video) {
  return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv, arg = (k, d) => { const i = a.indexOf('--' + k); return i > 0 ? a[i + 1] : d; };
  const [video, out] = [a[2], a[3]];
  const D = duration(video), from = +arg('from', 0);
  let times;
  if (arg('at')) times = arg('at').split(',').map(Number);
  else if (arg('every')) { const e = +arg('every'); times = Array.from({ length: Math.floor((D - from) / e) }, (_, i) => +(from + i * e + e / 2).toFixed(2)); }
  else { const n = +arg('n', 30); times = Array.from({ length: n }, (_, i) => +(from + ((D - from) * (i + 0.5)) / n).toFixed(2)); }
  await sheet(video, out, { times, cols: +arg('cols', 6), tile: +arg('tile', 270) });
  console.log(`${times.length} frames → ${out}`);
}
