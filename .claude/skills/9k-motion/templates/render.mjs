// node render.mjs [--w 1080 --h 1920] [--fps 60] [--sub 4] [--from 0 --to DUR] [--theme dark] [--dir ltr] [--alpha] [--out out/silent.mp4]
// Walks time, calls window.seek(t), pipes PNG frames into ffmpeg. --sub blends subframes for motion blur.
// --alpha keeps transparency and writes ProRes 4444 (.mov) for overlays on footage.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv;
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const W = +arg('w', 1080), H = +arg('h', 1920), FPS = +arg('fps', 60);
const ALPHA = has('alpha'), SUB = +arg('sub', ALPHA ? 1 : 4);
const THEME = arg('theme', 'dark'), DIR = arg('dir', 'ltr');
const OUT = arg('out', ALPHA ? `out/overlay-${W}x${H}.mov` : `out/silent-${W}x${H}.mp4`);
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(`file://${process.cwd()}/index.html?w=${W}&h=${H}&theme=${THEME}&dir=${DIR}&alpha=${ALPHA ? 1 : 0}`);
await page.evaluate(() => window.ready);
const DUR = +arg('dur', await page.evaluate(() => window.DUR));
const FROM = +arg('from', 0), TO = +arg('to', DUR);

// tmix averages SUB consecutive subframes; select keeps one per group
const vf = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : 'null';
const codec = ALPHA
  ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
  : ['-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-',
  '-vf', vf, '-r', String(FPS), ...codec, OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = page.locator('#c');
const total = Math.round((TO - FROM) * FPS * SUB);
for (let i = 0; i < total; i++) {
  const t = FROM + i / (FPS * SUB);
  await page.evaluate((t) => window.seek(t), t);
  const png = await canvas.screenshot({ type: 'png', omitBackground: ALPHA });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % (FPS * SUB) === 0) console.log(`rendered ${t.toFixed(1)}s / ${TO}s`);
}
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));
await browser.close();
if (code) { console.error(`ffmpeg exited ${code}`); process.exit(code); }
console.log(`→ ${OUT}`);
