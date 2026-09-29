// Render frames with headless Chromium and pipe them into ffmpeg.
// usage: node build/render.mjs <out.mp4> [--no-captions] [--frames a-b] [--stills 0,120,...] [--workers N]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args[0];
const noCap = args.includes('--no-captions');
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const stills = opt('--stills');
const workers = +(opt('--workers') || 4);
let [a, b] = (opt('--frames') || '0-1799').split('-').map(Number);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(root, 'src/index.html'));
  await p.waitForFunction(() => window.NEXUS_READY === true, null, { timeout: 60000 });
  if (noCap) await p.evaluate(() => setCaptions(false));
  return p;
}
async function grab(p, f) {
  await p.evaluate(f => renderFrame(f), f);
  return p.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
if (stills) {
  const p = await page(browser);
  fs.mkdirSync(out, { recursive: true });
  for (const f of stills.split(',').map(Number)) fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.jpg`), await grab(p, f));
  await browser.close(); process.exit(0);
}
// parallel workers each render a contiguous chunk to a temp dir, then encode in order
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'nexus-frames-'));
const n = b - a + 1, per = Math.ceil(n / workers);
const t0 = Date.now(); let done = 0;
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const p = await page(browser);
  for (let f = a + w * per; f <= Math.min(b, a + (w + 1) * per - 1); f++) {
    fs.writeFileSync(path.join(tmp, `${String(f).padStart(5, '0')}.jpg`), await grab(p, f));
    if (++done % 100 === 0) console.log(`${done}/${n} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}));
await browser.close();
await new Promise((res, rej) => {
  const ff = spawn(ffmpeg, ['-y', '-framerate', '30', '-start_number', String(a), '-i', path.join(tmp, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', '30', out], { stdio: 'inherit' });
  ff.on('exit', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out);
