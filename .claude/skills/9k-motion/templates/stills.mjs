// node stills.mjs [--every 0.5 | --at 0.4,1.2,3] [--w 1080 --h 1920] [--theme dark] [--dir ltr]
// Renders single frames to out/stills/ and tiles them into out/contact.png. Use before any full render.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const W = +arg('w', 1080), H = +arg('h', 1920), THEME = arg('theme', 'dark'), DIR = arg('dir', 'ltr');
rmSync('out/stills', { recursive: true, force: true }); mkdirSync('out/stills', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`file://${process.cwd()}/index.html?w=${W}&h=${H}&theme=${THEME}&dir=${DIR}`);
await page.evaluate(() => window.ready);
const DUR = await page.evaluate(() => window.DUR);
const every = +arg('every', 0.5);
const times = arg('at') ? arg('at').split(',').map(Number) : Array.from({ length: Math.floor(DUR / every) }, (_, i) => +(i * every + every / 2).toFixed(3));

let n = 0;
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t);
  await page.locator('#c').screenshot({ path: `out/stills/${String(n++).padStart(3, '0')}_${t.toFixed(2)}s.png` });
}
await browser.close();

const cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols), tw = W > H ? 480 : 270;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', 'out/stills/*.png',
  '-vf', `scale=${tw}:-1,tile=${cols}x${rows}:padding=4`,
  '-frames:v', '1', 'out/contact.png']);
console.log(`${times.length} stills → out/contact.png`);
