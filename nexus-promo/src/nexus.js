/* Nexus CRM — "From Leads to Revenue"
 * Deterministic canvas renderer. renderFrame(f) draws frame f (0..1799) of the
 * 1080x1920 vertical film. All data shown is fictitious and illustrative.
 */
(() => {
const W = 1080, H = 1920;
const TL = window.TIMELINE;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let SHOW_CAPTIONS = true;

// ---------------------------------------------------------------- palette
const C = {
  bg0: '#03060F', bg1: '#081231', navy: '#0B1738',
  blue: '#2F6BFF', blue2: '#1E4FD8', cyan: '#22D3EE', violet: '#7C5CFF',
  white: '#FFFFFF', t2: 'rgba(214,226,255,0.74)', t3: 'rgba(160,182,230,0.52)',
  green: '#34D399', amber: '#FBBF24', red: '#F87171',
  panel: 'rgba(14,24,52,0.80)', panel2: 'rgba(22,36,76,0.72)',
  stroke: 'rgba(130,170,255,0.22)', line: 'rgba(120,160,255,0.12)',
};
const AR = "'Cairo'", EN = "'Inter'";

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (f, s, d) => clamp((f - s) / d);
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  in: t => t * t * t,
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
// fade in over [s, s+a], out over [e-b, e]
const win = (f, s, e, a = 12, b = 12) => Math.min(E.out(P(f, s, a)), 1 - E.in(P(f, e - b, b)));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
          u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]];
};

// ---------------------------------------------------------------- assets
const IMG = {};
function loadImages() {
  const list = { logo: '../assets/logo-white.png', icon: '../assets/icon-white.png', word: '../assets/wordmark-white.png' };
  return Promise.all(Object.entries(list).map(([k, src]) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = rej; im.src = src;
  })));
}

// ---------------------------------------------------------------- primitives
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function panel(x, y, w, h, o = {}) {
  const r = o.r ?? 28, a = o.a ?? 1;
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 40; }
  rr(x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, o.fill0 ?? 'rgba(26,40,84,0.86)');
  g.addColorStop(1, o.fill1 ?? 'rgba(10,18,42,0.86)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = o.lw ?? 1.5; ctx.strokeStyle = o.stroke ?? C.stroke; ctx.stroke();
  // top sheen
  ctx.save(); rr(x, y, w, h, r); ctx.clip();
  const s = ctx.createLinearGradient(x, y, x, y + Math.min(90, h));
  s.addColorStop(0, 'rgba(255,255,255,0.07)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(x, y, w, Math.min(90, h));
  ctx.restore();
  ctx.restore();
}
function T(str, x, y, o = {}) {
  const a = o.a ?? 1; if (a <= 0 || !str) return 0;
  ctx.save(); ctx.globalAlpha *= a;
  const fam = o.ar ? AR : EN;
  ctx.font = `${o.w ?? 500} ${o.s ?? 28}px ${fam}`;
  ctx.fillStyle = o.c ?? C.white;
  ctx.textAlign = o.al ?? 'left';
  ctx.textBaseline = o.bl ?? 'middle';
  ctx.direction = o.ar ? 'rtl' : 'ltr';
  ctx.letterSpacing = (o.ls ?? 0) + 'px';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur ?? 24; }
  ctx.fillText(str, x, y);
  const wdt = ctx.measureText(str).width;
  ctx.restore();
  return wdt;
}
function measure(str, o = {}) {
  ctx.save(); ctx.font = `${o.w ?? 500} ${o.s ?? 28}px ${o.ar ? AR : EN}`;
  ctx.direction = o.ar ? 'rtl' : 'ltr'; ctx.letterSpacing = (o.ls ?? 0) + 'px';
  const m = ctx.measureText(str).width; ctx.restore(); return m;
}
function pill(x, y, label, o = {}) {
  const s = o.s ?? 22, padX = o.padX ?? 18, h = o.h ?? s * 1.9;
  const wdt = measure(label, { s, w: o.w ?? 600, ls: o.ls ?? 0.5, ar: o.ar }) + padX * 2 + (o.dot ? 20 : 0);
  const X = o.al === 'center' ? x - wdt / 2 : o.al === 'right' ? x - wdt : x;
  const a = o.a ?? 1;
  ctx.save(); ctx.globalAlpha *= a;
  rr(X, y - h / 2, wdt, h, h / 2);
  ctx.fillStyle = o.bg ?? 'rgba(47,107,255,0.16)'; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = o.border ?? 'rgba(120,170,255,0.35)'; ctx.stroke();
  let tx = X + padX;
  if (o.dot) { dot(tx + 5, y, 5, o.dot); tx += 20; }
  ctx.restore();
  T(label, o.ar ? X + wdt - padX : tx, y + 1, { s, w: o.w ?? 600, c: o.c ?? C.white, ls: o.ls ?? 0.5, a, ar: o.ar, al: o.ar ? 'right' : 'left' });
  return wdt;
}
function dot(x, y, r, c, glow = 0) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c;
  if (glow) { ctx.shadowColor = c; ctx.shadowBlur = glow; }
  ctx.fill(); ctx.restore();
}
function avatar(x, y, r, initials, c1 = C.blue, c2 = C.cyan, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
  ctx.restore();
  T(initials, x, y + 1, { s: r * 0.72, w: 700, al: 'center', a });
}
function glowLine(pts, o = {}) {
  ctx.save(); ctx.globalAlpha *= o.a ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = o.c ?? C.cyan; ctx.lineWidth = o.lw ?? 3;
  ctx.shadowColor = o.c ?? C.cyan; ctx.shadowBlur = o.blur ?? 18; ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = (o.lw ?? 3) * 0.4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.restore();
}
function bezPts(p0, p1, p2, p3, t0 = 0, t1 = 1, n = 40) {
  const out = []; for (let i = 0; i <= n; i++) out.push(bez(p0, p1, p2, p3, lerp(t0, t1, i / n))); return out;
}
function check(x, y, s, c = C.green, t = 1) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = c;
  const p = [[x - s * 0.32, y + s * 0.02], [x - s * 0.08, y + s * 0.26], [x + s * 0.36, y - s * 0.24]];
  ctx.beginPath(); ctx.moveTo(...p[0]);
  const t1 = clamp(t * 2), t2 = clamp(t * 2 - 1);
  ctx.lineTo(lerp(p[0][0], p[1][0], t1), lerp(p[0][1], p[1][1], t1));
  if (t2 > 0) ctx.lineTo(lerp(p[1][0], p[2][0], t2), lerp(p[1][1], p[2][1], t2));
  ctx.stroke(); ctx.restore();
}
function ring(x, y, r, prog, c, lw = 8, bgc = 'rgba(120,160,255,0.14)') {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = bgc; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
  ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore();
}
function withCam(sc, cx, cy, tx, ty, fn, rot = 0) {
  ctx.save(); ctx.translate(cx + tx, cy + ty); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-cx, -cy); fn(); ctx.restore();
}
// channel glyph (neutral, no third-party logos): coloured rounded square + letter
const CH = { WhatsApp: ['#25D366', 'W'], Messenger: ['#6E7BFF', 'M'], Instagram: ['#E1306C', 'I'], Meta: ['#2F6BFF', 'M'], Web: ['#22D3EE', 'W'], Import: ['#7C5CFF', 'I'] };
function chIcon(x, y, s, ch, a = 1) {
  const [c, l] = CH[ch];
  ctx.save(); ctx.globalAlpha *= a; rr(x - s / 2, y - s / 2, s, s, s * 0.3);
  ctx.fillStyle = c + '33'; ctx.fill(); ctx.strokeStyle = c + 'AA'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  T(l, x, y + 1, { s: s * 0.5, w: 800, al: 'center', c, a });
}

// ---------------------------------------------------------------- background
let BG = null;
function buildBG() {
  BG = document.createElement('canvas'); BG.width = W + 200; BG.height = H + 200;
  const b = BG.getContext('2d');
  const g = b.createLinearGradient(0, 0, 0, BG.height);
  g.addColorStop(0, '#040914'); g.addColorStop(0.5, '#060D22'); g.addColorStop(1, '#03060F');
  b.fillStyle = g; b.fillRect(0, 0, BG.width, BG.height);
  // fine grid
  b.strokeStyle = 'rgba(90,130,230,0.055)'; b.lineWidth = 1;
  for (let x = 0; x <= BG.width; x += 54) { b.beginPath(); b.moveTo(x + 0.5, 0); b.lineTo(x + 0.5, BG.height); b.stroke(); }
  for (let y = 0; y <= BG.height; y += 54) { b.beginPath(); b.moveTo(0, y + 0.5); b.lineTo(BG.width, y + 0.5); b.stroke(); }
  b.fillStyle = 'rgba(120,170,255,0.10)';
  for (let x = 0; x <= BG.width; x += 216) for (let y = 0; y <= BG.height; y += 216) b.fillRect(x - 1, y - 1, 3, 3);
}
function background(f, hue) {
  const px = Math.sin(f / 240) * 40, py = (f * 0.18) % 54;
  ctx.drawImage(BG, -100 + px, -100 - py);
  // perspective floor lines
  ctx.save(); ctx.globalAlpha = 0.5;
  const hy = 1250, vx = W / 2;
  const fl = ctx.createLinearGradient(0, hy, 0, H); fl.addColorStop(0, 'rgba(47,107,255,0)'); fl.addColorStop(1, 'rgba(47,107,255,0.22)');
  ctx.strokeStyle = fl; ctx.lineWidth = 1.2;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 14, hy); ctx.lineTo(vx + i * 260, H + 40); ctx.stroke(); }
  const off = (f * 1.2) % 60;
  for (let k = 0; k < 14; k++) { const t = (k * 60 + off) / 840; const y = hy + Math.pow(t, 2.2) * (H - hy + 60); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  // ambient light blobs
  const blobs = [
    [W * 0.15 + Math.sin(f / 90) * 60, 520 + Math.cos(f / 110) * 50, 620, hue[0]],
    [W * 0.9 + Math.cos(f / 100) * 50, 1150 + Math.sin(f / 80) * 60, 700, hue[1]],
    [W * 0.5, 1900, 900, 'rgba(47,107,255,0.10)'],
  ];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
function vignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- headline (English on-screen text)
function headline(str, f, s, e, y = 300, o = {}) {
  if (f < s || f > e) return;
  const tin = E.out5(P(f, s, 22)), tout = E.in(P(f, e - 12, 12));
  const a = tin * (1 - tout);
  const size = o.s ?? 58, ls = lerp(18, o.ls ?? 5, tin);
  const wdt = measure(str, { s: size, w: 800, ls });
  ctx.save();
  // centre-out wipe
  const rw = (wdt + 80) * tin; ctx.beginPath(); ctx.rect(W / 2 - rw / 2, y - size, rw, size * 2); ctx.clip();
  T(str, W / 2 + ls / 2, y - (1 - tin) * 10 - tout * 10, { s: size, w: 800, ls, al: 'center', a, glow: 'rgba(47,107,255,0.55)', glowBlur: 30 });
  ctx.restore();
  // accent rule
  const lw = 120 * E.out(P(f, s + 8, 20)) * (1 - tout);
  if (lw > 1) {
    const g = ctx.createLinearGradient(W / 2 - lw, 0, W / 2 + lw, 0);
    g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(0.5, C.cyan); g.addColorStop(1, 'rgba(47,107,255,0)');
    ctx.fillStyle = g; ctx.fillRect(W / 2 - lw, y + size * 0.72, lw * 2, 3);
  }
  if (o.sub) T(o.sub, W / 2, y + size * 1.25, { s: o.subS ?? 30, w: 500, c: C.t2, al: 'center', a: a * E.out(P(f, s + 10, 16)), ls: 1 });
}

// ---------------------------------------------------------------- captions (Arabic kinetic, word by word, RTL)
let CAPS = [];
function buildCaptions() {
  CAPS = [];
  for (const v of TL.vo) {
    if (!v.chunks.length) continue;
    const total = v.chunks.reduce((n, c) => n + c.length, 0);
    let t = v.start;
    for (let ci = 0; ci < v.chunks.length; ci++) {
      const text = v.chunks[ci];
      let d = v.dur * text.length / total;
      if (v.marks) { t = v.start + v.marks[ci]; d = (ci + 1 < v.marks.length ? v.marks[ci + 1] : v.dur) - v.marks[ci]; }
      // tokens: merge consecutive Latin words into one LTR run
      const raw = text.split(' '), toks = [];
      for (const w of raw) { if (/^[A-Za-z]/.test(w) && toks.length && /^[A-Za-z]/.test(toks[toks.length - 1])) toks[toks.length - 1] += ' ' + w; else toks.push(w); }
      const tl = toks.reduce((n, w) => n + w.length, 0);
      let tw = t; const words = toks.map(w => { const o = { w, t: tw }; tw += d * w.length / tl; return o; });
      CAPS.push({ t0: t, t1: t + d, words, text });
      t += d;
    }
  }
}
function captions(f) {
  if (!SHOW_CAPTIONS) return;
  const sec = f / TL.fps, y = 1470;
  for (let i = 0; i < CAPS.length; i++) {
    const c = CAPS[i], next = CAPS[i + 1];
    const end = next && next.t0 - c.t1 < 0.6 ? next.t0 : c.t1 + 0.45;
    if (sec < c.t0 - 0.12 || sec > end + 0.2) continue;
    const ain = E.out(clamp((sec - c.t0 + 0.12) / 0.25)), aout = E.in(clamp((sec - end) / 0.2));
    let size = 50; const gap = 14;
    const ws = () => c.words.map(o => measure(o.w, { s: size, w: 700, ar: true }));
    let widths = ws(); let total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    if (total > 920) { size = size * 920 / total; widths = ws(); total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1); }
    // soft backing
    ctx.save(); ctx.globalAlpha = 0.55 * ain * (1 - aout);
    const bw = total + 80, bh = size * 1.9;
    const bg = ctx.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
    bg.addColorStop(0, 'rgba(4,8,22,0.55)'); bg.addColorStop(1, 'rgba(4,8,22,0.85)');
    rr(W / 2 - bw / 2, y - bh / 2, bw, bh, bh / 2); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    let x = W / 2 + total / 2; // RTL: start at right edge
    c.words.forEach((o, k) => {
      const lit = clamp((sec - o.t) / 0.18);
      const rise = (1 - E.out(clamp((sec - c.t0 + 0.12 - k * 0.03) / 0.3))) * 18;
      const col = lit >= 1 ? C.white : `rgba(255,255,255,${0.42 + 0.58 * lit})`;
      T(o.w, x, y + 2 + rise + aout * -12, { s: size, w: 700, ar: true, al: 'right', c: col, a: ain * (1 - aout),
        glow: lit > 0 && lit < 1 ? 'rgba(34,211,238,0.8)' : null, glowBlur: 18 });
      x -= widths[k] + gap;
    });
  }
}

// ================================================================= DATA (fictitious)
const HERO = { name: 'Mariam Adel', ini: 'MA', phone: '+20 10•• ••• 4821', src: 'Meta Lead Ads', camp: 'Summer Offer', opp: 'OPP-1042', deal: 'Summer Package', val: 'EGP 45,000' };
const NAMES = ['Karim Said', 'Nour Hany', 'Youssef Tarek', 'Salma Fathy', 'Hady Mostafa', 'Laila Samir', 'Omar Nabil', 'Dina Raafat', 'Ahmed Fawzy', 'Rana Wael', 'Tamer Aly'];
const REPS = [['Omar K.', 'OK', C.blue, C.cyan], ['Sara M.', 'SM', C.violet, C.blue], ['Youssef H.', 'YH', '#0EA5E9', C.cyan], ['Nada A.', 'NA', '#6366F1', '#A78BFA']];

// generic lead / message / alert card used in chaos + flow
function leadCard(x, y, w, h, d, a = 1) {
  if (a <= 0) return;
  panel(x, y, w, h, { r: 22, a });
  const cy = y + h / 2;
  if (d.type === 'lead') {
    chIcon(x + 44, cy, 46, d.ch, a);
    T(d.name, x + 82, cy - 16, { s: 27, w: 700, a });
    T(d.sub, x + 82, cy + 18, { s: 20, w: 500, c: C.t2, a });
    pill(x + w - 20, y + 30, 'NEW', { s: 15, al: 'right', a, h: 26, padX: 10, bg: 'rgba(34,211,238,0.14)', c: C.cyan });
  } else if (d.type === 'msg') {
    chIcon(x + 44, cy, 46, d.ch, a);
    T(d.ch, x + 82, cy - 18, { s: 19, w: 600, c: C.t2, a });
    T(d.text, x + w - 26, cy + 16, { s: 26, w: 600, ar: true, al: 'right', a });
  } else if (d.type === 'alert') {
    ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x + 44, cy, 22, 0, 7); ctx.fillStyle = 'rgba(251,191,36,0.16)'; ctx.fill(); ctx.restore();
    T('!', x + 44, cy + 1, { s: 28, w: 800, c: C.amber, al: 'center', a });
    T(d.name, x + 82, cy - 16, { s: 25, w: 700, a });
    T(d.sub, x + 82, cy + 18, { s: 20, w: 500, c: C.amber, a });
  }
}

// ================================================================= SCENE 1 — THE PROBLEM (0–209)
const CHAOS = (() => {
  const r = rng(7), items = [];
  const kinds = [
    { type: 'lead', ch: 'Meta', name: 'Karim Said', sub: 'Meta Lead Ad · 2m ago' },
    { type: 'msg', ch: 'WhatsApp', text: 'السعر كام لو سمحت؟' },
    { type: 'lead', ch: 'Web', name: 'Nour Hany', sub: 'Website form · 5m ago' },
    { type: 'alert', name: 'Follow-up overdue', sub: 'Youssef Tarek · 2 days' },
    { type: 'lead', ch: 'Meta', name: HERO.name, sub: 'Meta Lead Ad · Summer Offer', hero: true },
    { type: 'msg', ch: 'Messenger', text: 'ممكن حد يكلمني؟' },
    { type: 'lead', ch: 'Import', name: 'Salma Fathy', sub: 'Sheet import · row 214' },
    { type: 'lead', ch: 'Meta', name: 'Hady Mostafa', sub: 'Meta Lead Ad · 9m ago' },
    { type: 'msg', ch: 'Instagram', text: 'فيه عرض الأسبوع ده؟' },
    { type: 'alert', name: 'No owner assigned', sub: '7 leads waiting' },
    { type: 'lead', ch: 'Web', name: 'Laila Samir', sub: 'Website form · 12m ago' },
    { type: 'msg', ch: 'WhatsApp', text: 'لسه مستني الرد…' },
    { type: 'lead', ch: 'Meta', name: 'Omar Nabil', sub: 'Meta Lead Ad · 14m ago' },
    { type: 'lead', ch: 'Import', name: 'Dina Raafat', sub: 'Sheet import · row 88' },
  ];
  kinds.forEach((d, i) => {
    const hero = !!d.hero;
    items.push({
      d, s: hero ? 34 : 4 + i * 8 + Math.floor(r() * 4),
      x: hero ? 540 : 290 + r() * 500, y: hero ? 900 : 520 + r() * 880,
      vx: (r() - 0.5) * 0.9, vy: (r() - 0.5) * 0.7, rot: hero ? -0.02 : (r() - 0.5) * 0.22, vr: (r() - 0.5) * 0.0016,
      z: hero ? 1 : 0.78 + r() * 0.3, w: 520, h: 124,
    });
  });
  // draw order: hero early, then others over it
  const hero = items.find(o => o.d.hero); const rest = items.filter(o => !o.d.hero);
  return [...rest.slice(0, 3), hero, ...rest.slice(3)];
})();
function chaosPos(o, f) {
  const t = f - o.s;
  let x = o.x + o.vx * t, y = o.y + o.vy * t, rot = o.rot + o.vr * t, sc = o.z;
  // crowding: drift toward hero position between 90–170
  const crowd = E.io(P(f, 80, 90));
  if (!o.d.hero) { x = lerp(x, 540 + (o.x - 540) * 0.45, crowd * 0.8); y = lerp(y, 900 + (o.y - 900) * 0.4, crowd * 0.8); }
  // converge to centre line (transition)
  const cv = E.io(P(f, 186, 24));
  x = lerp(x, 540, cv); y = lerp(y, 960, cv); sc = lerp(sc, 0.04, cv); rot = lerp(rot, 0, cv);
  return { x, y, rot, sc };
}
function scene1(f) {
  const push = 1 + E.io(P(f, 0, 200)) * 0.06;
  withCam(push, W / 2, 960, 0, 0, () => {
    for (const o of CHAOS) {
      if (f < o.s) continue;
      const k = E.back(P(f, o.s, 16));
      const { x, y, rot, sc } = chaosPos(o, f);
      let a = E.out(P(f, o.s, 10));
      if (o.d.hero) a *= lerp(1, 0.3, E.io(P(f, 118, 40)));
      else a *= lerp(1, 0.88, E.io(P(f, 90, 60)));
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc * lerp(0.7, 1, k), sc * lerp(0.7, 1, k));
      if (o.z < 0.9 && !o.d.hero) ctx.filter = `blur(${((0.9 - o.z) * 14).toFixed(1)}px)`;
      leadCard(-o.w / 2, -o.h / 2, o.w, o.h, o.d, a);
      ctx.filter = 'none';
      if (o.d.hero) {
        // the lead that gets lost
        const lost = E.out(P(f, 128, 16)) * (1 - E.in(P(f, 180, 10)));
        pill(o.w / 2 - 20, o.h / 2 + 10, 'No response · 3h', { s: 16, al: 'right', a: lost, h: 30, padX: 12, bg: 'rgba(248,113,113,0.16)', border: 'rgba(248,113,113,0.5)', c: C.red });
      }
      ctx.restore();
    }
  });
  headline('Leads Everywhere.', f, 14, 104, 330);
  headline('Opportunities Lost?', f, 112, 184, 330, { });
  // the organising blue line
  const lt = E.io(P(f, 168, 22)), lf = 1 - E.in(P(f, 200, 10));
  if (lt > 0 && lf > 0) {
    const x0 = lerp(540, 60, lt), x1 = lerp(540, 1020, lt);
    glowLine([[x0, 960], [x1, 960]], { c: C.blue, lw: 4, blur: 30, a: lf });
    dot(540, 960, 6 + 10 * lt, C.cyan, 40);
  }
}

// ================================================================= SCENE 2 — ENTER NEXUS (210–449)
const SRC = [
  { label: 'META LEADS', ch: 'Meta', x: 200 },
  { label: 'WEBSITE FORMS', ch: 'Web', x: 540 },
  { label: 'LEAD IMPORT', ch: 'Import', x: 880 },
];
const HUB = [540, 900];
const FLOW_CARDS = [
  { name: HERO.name, sub: 'Meta Lead Ads · Summer Offer', ch: 'Meta', hero: true },
  { name: 'Karim Said', sub: 'Website form · Contact page', ch: 'Web' },
  { name: 'Nour Hany', sub: 'Lead import · Expo list', ch: 'Import' },
];
function flowCard(x, y, w, d, a, hl = 0) {
  const h = 128;
  panel(x, y, w, h, { r: 24, a, glow: hl ? 'rgba(34,211,238,0.5)' : null, stroke: hl ? 'rgba(34,211,238,0.6)' : C.stroke });
  avatar(x + 60, y + h / 2, 34, d.name.split(' ').map(s => s[0]).join(''), C.blue, C.cyan, a);
  T(d.name, x + 112, y + 44, { s: 28, w: 700, a });
  T(d.sub, x + 112, y + 84, { s: 20, w: 500, c: C.t2, a });
  pill(x + w - 22, y + 44, 'New', { s: 16, al: 'right', a, h: 28, padX: 12, dot: C.cyan });
  chIcon(x + w - 42, y + 88, 30, d.ch, a);
}
function scene2(f) {
  const L = f - 210;
  // --- logo formation
  const core = E.out(P(L, 0, 26));
  const lockA = 1 - E.io(P(L, 118, 34));             // hero lockup → header
  const iconS = E.back(P(L, 8, 30));
  const wipe = E.io(P(L, 38, 34));                     // wordmark reveal
  // logo geometry
  const lw = lerp(780, 380, E.io(P(L, 118, 34))), lh = lw * IMG.logo.height / IMG.logo.width;
  const ly = lerp(800, 290, E.io(P(L, 118, 34)));
  const iconW = lw * (345 / IMG.logo.width); // icon share of lockup
  const cxIconOnly = W / 2 - iconW / 2;          // left of icon when icon alone centred
  const lx = lerp(cxIconOnly, W / 2 - lw / 2, wipe);
  // flare
  if (L < 60) {
    const g = ctx.createRadialGradient(540, 800, 0, 540, 800, 420 * core);
    g.addColorStop(0, `rgba(34,211,238,${0.45 * (1 - P(L, 20, 40))})`); g.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // pulse rings
  for (let k = 0; k < 2; k++) {
    const t = P(L, 6 + k * 10, 50); if (t <= 0 || t >= 1) continue;
    ctx.save(); ctx.globalAlpha = (1 - t) * 0.6; ctx.beginPath(); ctx.arc(540, 800, 60 + t * 520, 0, 7);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(47,107,255,0.9)'; ctx.shadowBlur = 40 * lockA + 10;
  // icon part (scale-in around its centre)
  const icx = lx + iconW / 2, icy = ly;
  ctx.save(); ctx.translate(icx, icy); ctx.scale(lerp(0.3, 1, iconS), lerp(0.3, 1, iconS)); ctx.translate(-icx, -icy);
  ctx.globalAlpha = core;
  ctx.beginPath(); ctx.rect(lx - 20, ly - lh, iconW + 30, lh * 2); ctx.clip();
  ctx.drawImage(IMG.logo, lx, ly - lh / 2, lw, lh);
  ctx.restore();
  // wordmark part (wipe)
  ctx.save(); ctx.beginPath(); ctx.rect(lx + iconW + 10, ly - lh, (lw - iconW) * wipe, lh * 2); ctx.clip();
  ctx.drawImage(IMG.logo, lx, ly - lh / 2, lw, lh);
  ctx.restore();
  ctx.restore();
  // subtitle
  T('CONNECTED LEAD MANAGEMENT', W / 2 + 3, 1000, { s: 32, w: 600, ls: lerp(16, 6, E.out(P(L, 60, 24))), c: C.cyan, al: 'center', a: win(L, 60, 126, 18, 14) });
  T('Leads · Customers · Pipeline · Reports', W / 2, 1058, { s: 24, w: 500, c: C.t2, al: 'center', a: win(L, 72, 126, 18, 14) });
  // header version subtitle
  T('CONNECTED LEAD MANAGEMENT', W / 2 + 2, ly + lh / 2 + 34, { s: 20, w: 600, ls: 6, c: C.cyan, al: 'center', a: E.out(P(L, 146, 16)) * (1 - E.in(P(L, 214, 16))) });

  // --- sources & streams
  const sA = E.out(P(L, 150, 20)) * (1 - E.in(P(L, 222, 14)));
  const hubA = E.back(P(L, 152, 24));
  if (L > 140) {
    // hub
    const hr = 92 * hubA;
    ctx.save(); ctx.globalAlpha = clamp(hubA) * (1 - E.in(P(L, 222, 14)));
    const hg = ctx.createRadialGradient(HUB[0], HUB[1], 0, HUB[0], HUB[1], hr * 2.4);
    hg.addColorStop(0, 'rgba(47,107,255,0.45)'); hg.addColorStop(1, 'rgba(47,107,255,0)');
    ctx.fillStyle = hg; ctx.fillRect(HUB[0] - 300, HUB[1] - 300, 600, 600);
    ctx.beginPath(); ctx.arc(HUB[0], HUB[1], hr, 0, 7); ctx.fillStyle = 'rgba(12,22,50,0.95)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(34,211,238,0.7)'; ctx.stroke();
    ctx.save(); ctx.translate(HUB[0], HUB[1]); ctx.rotate(L / 40);
    ctx.setLineDash([6, 12]); ctx.beginPath(); ctx.arc(0, 0, hr + 18, 0, 7); ctx.strokeStyle = 'rgba(120,170,255,0.35)'; ctx.stroke(); ctx.restore();
    const iw = 104, ih = iw * IMG.icon.height / IMG.icon.width;
    ctx.drawImage(IMG.icon, HUB[0] - iw / 2, HUB[1] - ih / 2, iw, ih);
    ctx.restore();
    // sources
    SRC.forEach((s, i) => {
      const a = sA * E.out(P(L, 150 + i * 6, 18)), y = 560;
      panel(s.x - 150, y - 50, 300, 100, { r: 50, a });
      chIcon(s.x - 100, y, 44, s.ch, a);
      T(s.label, s.x - 66, y + 1, { s: 21, w: 700, ls: 1.5, a });
      // stream path
      const p0 = [s.x, y + 50], p3 = [HUB[0], HUB[1] - 96], p1 = [s.x, y + 170], p2 = [HUB[0], HUB[1] - 230];
      const draw = E.io(P(L, 158 + i * 6, 26));
      if (draw > 0) {
        ctx.save(); ctx.globalAlpha = a * 0.55; ctx.strokeStyle = 'rgba(80,140,255,0.6)'; ctx.lineWidth = 2;
        const pts = bezPts(p0, p1, p2, p3, 0, draw); ctx.beginPath(); ctx.moveTo(...pts[0]); pts.forEach(p => ctx.lineTo(...p)); ctx.stroke(); ctx.restore();
        for (let k = 0; k < 5; k++) {
          const t = ((L - 170 - i * 5) / 26 + k / 5) % 1; if (L < 170 + i * 5 || t < 0) continue;
          const [px, py] = bez(p0, p1, p2, p3, t);
          dot(px, py, 5, i === 0 ? C.cyan : C.blue, 16);
        }
      }
    });
    // clean customer cards out of the hub
    FLOW_CARDS.forEach((d, i) => {
      const t = E.out5(P(L, 176 + i * 9, 24));
      if (t <= 0) return;
      const ty = 1030 + i * 136;
      const y = lerp(HUB[1], ty, t);
      const a = t * (d.hero ? 1 : 1 - E.in(P(L, 214, 14)));
      flowCard(W / 2 - 440 * lerp(0.4, 1, t), y, 880 * lerp(0.4, 1, t), d, a, d.hero ? E.out(P(L, 205, 12)) : 0);
    });
  }
}

// ================================================================= SCENE 3 — ORGANIZE & ASSIGN (450–779)
function profileCard(x, y, w, a, o = {}) {
  const h = o.h ?? 330;
  panel(x, y, w, h, { r: 30, a, glow: o.glow, stroke: o.glow ? 'rgba(34,211,238,0.55)' : C.stroke });
  avatar(x + 78, y + 78, 44, HERO.ini, C.blue, C.cyan, a);
  T(o.name ?? HERO.name, x + 142, y + 62, { s: 34, w: 700, a });
  T('Customer profile', x + 142, y + 100, { s: 20, w: 500, c: C.t3, a });
  const rows = o.rows ?? [];
  rows.forEach((r, i) => {
    const ra = a * (r.a ?? 1), ry = y + 170 + i * 50;
    T(r.k, x + 40, ry, { s: 21, w: 500, c: C.t3, a: ra });
    T(r.v, x + 250, ry, { s: 23, w: 600, c: r.c ?? C.white, a: ra });
    if (i < rows.length - 1) { ctx.save(); ctx.globalAlpha = ra * 0.5; ctx.fillStyle = C.line; ctx.fillRect(x + 40, ry + 25, w - 80, 1); ctx.restore(); }
  });
}
function scene3(f) {
  const L = f - 450;
  // continuity: hero card from scene 2 (at y 1052) grows into the profile
  const exitA = 1 - E.in(P(L, 150, 14));
  // ---------- A: profile builds from fragments (0–80)
  const ROWS = [
    { k: 'Phone', v: HERO.phone }, { k: 'Source', v: 'Meta Lead Ads · ' + HERO.camp },
    { k: 'Opportunity', v: HERO.opp + ' · ' + HERO.deal }, { k: 'Activities', v: '2 logged · 1 upcoming' },
  ];
  const r = rng(11);
  const frags = ROWS.map((row, i) => ({ row, sx: r() < 0.5 ? -200 : 1280, sy: 500 + r() * 900, s: 10 + i * 9 }));
  const pY = lerp(1030, 560, E.io(P(L, 0, 28)));
  const pW = lerp(880, 900, E.io(P(L, 0, 28)));
  const mergeT = E.io(P(L, 96, 26));
  const toBoard = E.io(P(L, 150, 30));
  if (L < 170) {
    const rows = ROWS.map((row, i) => ({ ...row, a: E.out(P(L, frags[i].s + 16, 10)) }));
    if (L > 110) rows.push({ k: 'Sources', v: 'Meta Lead Ads + Website Form', c: C.cyan, a: E.out(P(L, 118, 12)) });
    const cardH = 170 + rows.length * 50 + 10;
    const sc = lerp(1, 0.5, toBoard);
    withCam(sc, W / 2, pY, 0, lerp(0, -140, toBoard), () => {
      profileCard(W / 2 - pW / 2, pY, pW, exitA, { rows, h: L > 110 ? lerp(380, cardH, E.out(P(L, 110, 14))) : 380, glow: L > 118 && L < 150 ? 'rgba(34,211,238,0.45)' : null });
      if (L > 118) pill(W / 2 + pW / 2 - 30, pY + 62, 'Merged', { s: 18, al: 'right', h: 34, dot: C.green, a: E.out(P(L, 118, 10)) * exitA, bg: 'rgba(52,211,153,0.14)', border: 'rgba(52,211,153,0.5)', c: C.green });
    });
    // fragments flying into rows
    frags.forEach((fr, i) => {
      const t = E.io(P(L, fr.s, 18)); if (t <= 0 || t >= 1) return;
      const tx = W / 2 - pW / 2 + 250, ty = pY + 170 + i * 50;
      pill(lerp(fr.sx, tx, t), lerp(fr.sy, ty, t), fr.row.v, { s: 20, a: 1 - t * 0.6, bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.5)' });
    });
    // ---------- B: duplicate appears and merges (56–122)
    const dupIn = E.out5(P(L, 54, 22));
    if (dupIn > 0 && L < 124) {
      const dy = lerp(1160, 1060, dupIn), dx = lerp(W + 100, 90, dupIn);
      const dxm = lerp(dx, W / 2 - pW / 2, mergeT), dym = lerp(dy, pY + 40, mergeT);
      const a = dupIn * (1 - E.in(P(L, 110, 12)));
      panel(dxm, dym, 900, 150, { r: 26, a, stroke: 'rgba(251,191,36,0.55)' });
      avatar(dxm + 66, dym + 75, 36, 'MA', '#475569', '#64748B', a);
      T('Mariam A.', dxm + 122, dym + 52, { s: 28, w: 700, a });
      T('Website Form · Contact page', dxm + 122, dym + 94, { s: 20, w: 500, c: C.t2, a });
      T(HERO.phone, dxm + 870, dym + 52, { s: 22, w: 600, c: C.amber, al: 'right', a });
      pill(dxm + 870, dym + 100, 'Possible duplicate', { s: 16, al: 'right', h: 30, padX: 12, a, bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.5)', c: C.amber });
      // phone match link
      const lk = E.io(P(L, 74, 16)) * (1 - mergeT);
      if (lk > 0) {
        const x1 = W / 2 - pW / 2 + 470, y1 = pY + 196, x2 = dxm + 780, y2 = dym + 30;
        glowLine([[x1, y1], [lerp(x1, x2, lk), lerp(y1, y2, lk)]], { c: C.amber, lw: 3, a: lk });
        pill((x1 + x2) / 2 + 40, (y1 + y2) / 2, 'Phone match', { s: 17, al: 'center', h: 32, a: E.out(P(L, 84, 10)) * (1 - mergeT), bg: 'rgba(12,20,44,0.95)', border: 'rgba(251,191,36,0.6)', c: C.amber });
      }
    }
    headline('DEDUPLICATION', f, 462, 598, 330, { sub: 'One Customer. Organized Information.', subS: 30 });
  }
  // ---------- C: routing board (150–250)
  const boardA = E.out(P(L, 156, 20)) * (1 - E.in(P(L, 318, 12)));
  const zoomSLA = E.io(P(L, 250, 30));
  if (boardA > 0) {
    withCam(lerp(1, 1.0, zoomSLA), W / 2, 960, 0, 0, () => {
      // rule selector
      const ry = 520;
      panel(70, ry - 70, 940, 190, { r: 28, a: boardA * (1 - zoomSLA) });
      T('Distribution rule', 110, ry - 28, { s: 22, w: 600, c: C.t3, a: boardA * (1 - zoomSLA) });
      const rules = ['Round-robin', 'Least-active', 'Weighted', 'Skill-based', 'Manual'];
      let rx = 110;
      rules.forEach((rl, i) => {
        const on = i === 0;
        const a = boardA * (1 - zoomSLA) * E.out(P(L, 166 + i * 4, 12));
        const row2 = i >= 3; const px = row2 ? 110 + (i - 3) * 230 : rx; const py = row2 ? ry + 78 : ry + 22;
        const wdt = pill(px, py, rl, { s: 21, a, h: 46, padX: 20, dot: on ? C.cyan : null,
          bg: on ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.04)', border: on ? C.cyan : 'rgba(130,170,255,0.2)', c: on ? C.white : C.t2 });
        if (!row2) rx += wdt + 14;
      });
      // rep tiles
      REPS.forEach(([nm, ini, c1, c2], i) => {
        const ty = 760 + i * 142, a = boardA * E.out(P(L, 172 + i * 5, 14));
        const target = i === 0;
        const assigned = E.out(P(L, 222, 14));
        const tileA = a * (1 - zoomSLA);
        panel(70, ty, 940, 120, { r: 24, a: tileA, glow: target && assigned > 0 ? `rgba(52,211,153,${0.5 * assigned})` : null, stroke: target && assigned > 0 ? 'rgba(52,211,153,0.6)' : C.stroke });
        avatar(140, ty + 60, 38, ini, c1, c2, tileA);
        T(nm, 196, ty + 42, { s: 27, w: 700, a: tileA });
        const load = [4, 6, 5, 7][i] + (target && assigned > 0.5 ? 1 : 0);
        T(`${load} active leads`, 196, ty + 82, { s: 20, w: 500, c: C.t2, a: tileA });
        // load bar
        ctx.save(); ctx.globalAlpha = tileA; rr(560, ty + 52, 300, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
        rr(560, ty + 52, 300 * load / 10, 14, 7); ctx.fillStyle = c1; ctx.fill(); ctx.restore();
        T(i === 0 ? 'Next in rotation' : 'Available', 560, ty + 90, { s: 17, w: 600, c: i === 0 ? C.cyan : C.t3, a: tileA });
        if (target && assigned > 0 && tileA > 0) { ctx.save(); ctx.globalAlpha = tileA; dot(950, ty + 60, 24 * E.back(assigned), 'rgba(52,211,153,0.2)'); check(950, ty + 60, 30, C.green, assigned); ctx.restore(); }
      });
      // lead chip travelling into Omar's tile
      const mv = E.io(P(L, 192, 32));
      if (L > 180 && L < 232) {
        const x = lerp(540, 800, mv), y = lerp(640, 820, mv), s = lerp(1, 0.6, mv);
        const a = E.out(P(L, 180, 8)) * (1 - E.in(P(L, 222, 10)));
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        pill(0, 0, HERO.name + ' · New lead', { s: 24, al: 'center', h: 58, padX: 24, dot: C.cyan, a, bg: 'rgba(20,34,74,0.98)', border: C.cyan });
        ctx.restore();
      }
      if (L > 222) pill(540, 732, `Assigned to Omar K. · Round-robin`, { s: 20, al: 'center', h: 40, a: E.out(P(L, 224, 10)) * (1 - zoomSLA), dot: C.green, bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.5)', c: C.green });
    });
    headline('SMART ROUTING', f, 606, 700, 330, { sub: 'Rule-based lead distribution', subS: 28 });
  }
  // ---------- D: SLA tracking (250–329)
  const exitD = E.io(P(L, 310, 20));
  const slaA = E.out(P(L, 256, 20)) * (exitD < 1 ? 1 : 0);
  if (slaA > 0) {
    ctx.save(); ctx.globalAlpha = 1 - exitD; ctx.translate(540, 710); ctx.scale(1 + exitD * 0.35, 1 + exitD * 0.35); ctx.translate(-540, -710);
    const y0 = lerp(1100, 560, E.io(P(L, 250, 30)));
    // hero lead with response timer
    panel(70, y0, 940, 300, { r: 30, a: slaA, glow: 'rgba(34,211,238,0.35)', stroke: 'rgba(34,211,238,0.5)' });
    avatar(150, y0 + 80, 40, HERO.ini, C.blue, C.cyan, slaA);
    T(HERO.name, 210, y0 + 64, { s: 30, w: 700, a: slaA });
    T('Owner: Omar K. · Meta Lead Ads', 210, y0 + 102, { s: 20, w: 500, c: C.t2, a: slaA });
    const secs = Math.floor(clamp((L - 262) / 60) * 118);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
    ctx.save(); ctx.globalAlpha *= slaA; ring(860, y0 + 150, 80, clamp(secs / 900), C.cyan, 10); ctx.restore();
    T(`${mm}:${ss}`, 860, y0 + 140, { s: 36, w: 700, al: 'center', a: slaA });
    T('of 15:00', 860, y0 + 178, { s: 17, w: 500, c: C.t3, al: 'center', a: slaA });
    T('First-response timer', 110, y0 + 180, { s: 21, w: 600, c: C.t3, a: slaA });
    pill(110, y0 + 236, 'Within SLA', { s: 19, h: 38, dot: C.green, a: slaA, bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.5)', c: C.green });
    // at-risk lead + manager visibility
    const b = E.out5(P(L, 272, 20));
    const y1 = y0 + 330;
    panel(70, y1, 940, 250, { r: 30, a: slaA * b, stroke: 'rgba(251,191,36,0.55)' });
    avatar(150, y1 + 76, 38, 'KS', '#475569', '#94A3B8', slaA * b);
    T('Karim Said', 210, y1 + 60, { s: 28, w: 700, a: slaA * b });
    T('Pending · no first response yet', 210, y1 + 96, { s: 20, w: 500, c: C.t2, a: slaA * b });
    ctx.save(); ctx.globalAlpha *= slaA * b; ring(860, y1 + 110, 62, 0.86 + 0.02 * Math.sin(L / 5), C.amber, 9); ctx.restore();
    T('12:54', 860, y1 + 110, { s: 28, w: 700, al: 'center', a: slaA * b });
    const bb = E.back(P(L, 290, 14));
    pill(110, y1 + 180, 'SLA at risk', { s: 18, h: 38, dot: C.amber, a: slaA * bb, bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.55)', c: C.amber });
    pill(290, y1 + 180, 'Manager notified', { s: 18, h: 38, a: slaA * E.back(P(L, 298, 14)), bg: 'rgba(124,92,255,0.16)', border: 'rgba(124,92,255,0.6)' });
    pill(530, y1 + 180, 'Reassign ▸', { s: 18, h: 38, a: slaA * E.back(P(L, 306, 14)), bg: 'rgba(47,107,255,0.22)', border: C.blue });
    ctx.restore();
    headline('SLA TRACKING', f, 704, 779, 330, { sub: 'Every second matters', subS: 28 });
  }
}

// ================================================================= SCENE 4 — CONVERSATION WORKSPACE (780–1079)
const MSGS = [
  { me: false, t: 'السلام عليكم، عايزة أعرف تفاصيل عرض الصيف', s: 64 },
  { me: true, t: 'أهلاً يا مريم! أكيد، هبعتلك التفاصيل حالاً', s: 92 },
  { me: false, t: 'تمام، ومحتاجة أعرف مواعيد التنفيذ', s: 122 },
];
function bubble(x, y, w, text, me, a) {
  const s = 25, h = 76;
  const tw = Math.min(w, measure(text, { s, w: 500, ar: true }) + 56);
  const bx = me ? x : x + w - tw;
  ctx.save(); ctx.globalAlpha *= a; rr(bx, y, tw, h, 24);
  ctx.fillStyle = me ? 'rgba(47,107,255,0.85)' : 'rgba(255,255,255,0.08)'; ctx.fill();
  if (!me) { ctx.strokeStyle = 'rgba(130,170,255,0.18)'; ctx.stroke(); }
  ctx.restore();
  T(text, bx + tw - 28, y + h / 2 + 1, { s, w: 500, ar: true, al: 'right', a });
  return h;
}
function inboxDesktop(x, y, s, a) {
  // establishing 3-column shot (scaled mini desktop)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
  panel(0, 0, 1500, 900, { r: 30 });
  // left list
  panel(20, 20, 400, 860, { r: 22, fill0: 'rgba(255,255,255,0.03)', fill1: 'rgba(255,255,255,0.02)' });
  T('Conversations', 50, 64, { s: 28, w: 700 });
  const conv = [['WhatsApp', HERO.name, 'Open · Omar K.', true], ['Messenger', 'Salma Fathy', 'Inbound'], ['WhatsApp', 'Karim Said', 'Pending'], ['Instagram', 'Laila Samir', 'Inbound'], ['WhatsApp', 'Hady Mostafa', 'Closed']];
  conv.forEach(([ch, nm, st, on], i) => {
    const cy = 130 + i * 140;
    if (on) { rr(34, cy - 10, 372, 124, 18); ctx.fillStyle = 'rgba(47,107,255,0.22)'; ctx.fill(); ctx.strokeStyle = C.blue; ctx.stroke(); }
    chIcon(84, cy + 52, 52, ch); T(nm, 126, cy + 34, { s: 26, w: 700 }); T(`${ch} · ${st}`, 126, cy + 74, { s: 19, w: 500, c: C.t2 });
  });
  // centre chat
  panel(440, 20, 620, 860, { r: 22, fill0: 'rgba(255,255,255,0.03)', fill1: 'rgba(255,255,255,0.02)' });
  T(HERO.name, 470, 64, { s: 28, w: 700 }); T('WhatsApp · Open', 470, 100, { s: 19, w: 500, c: C.t2 });
  bubble(470, 160, 560, MSGS[0].t, false, 1); bubble(470, 256, 560, MSGS[1].t, true, 1);
  // right details
  panel(1080, 20, 400, 860, { r: 22, fill0: 'rgba(255,255,255,0.03)', fill1: 'rgba(255,255,255,0.02)' });
  avatar(1130, 80, 30, HERO.ini); T('Contact', 1176, 80, { s: 26, w: 700 });
  [['Opportunity', HERO.opp], ['Stage', 'New'], ['Owner', 'Omar K.'], ['Task', 'Follow-up call']].forEach(([k, v], i) => {
    T(k, 1110, 170 + i * 80, { s: 19, w: 500, c: C.t3 }); T(v, 1110, 200 + i * 80, { s: 23, w: 600 });
  });
  ctx.restore();
}
function scene4(f) {
  const L = f - 780;
  // --- A: establishing 3-column (0–60) then zoom into centre column
  const est = E.out(P(L, 0, 18));
  const zoom = E.io(P(L, 44, 26));
  if (zoom < 1) {
    const s = lerp(0.64, 1.6, zoom), dx = lerp(540 - 750 * 0.64, 540 - 750 * 1.6, zoom);
    inboxDesktop(dx, lerp(560, 300, zoom), s, est * (1 - E.in(P(L, 56, 12))));
    // column labels
    const la = win(L, 10, 50, 10, 8);
    ['Conversations', 'Chat', 'Customer context'].forEach((t, i) => pill([185, 540, 885][i], 1180, t, { s: 18, al: 'center', h: 36, a: la }));
  }
  // --- B: focused chat (56–200)
  const chatA = E.out(P(L, 56, 14)) * (1 - E.in(P(L, 206, 14)));
  const shrink = E.io(P(L, 196, 24));
  if (chatA > 0) {
    withCam(lerp(1, 0.86, shrink), W / 2, 900, lerp(0, -170, shrink), 0, () => {
      panel(70, 440, 940, 820, { r: 34, a: chatA });
      avatar(150, 520, 40, HERO.ini, C.blue, C.cyan, chatA);
      T(HERO.name, 210, 504, { s: 30, w: 700, a: chatA });
      T(HERO.phone, 210, 542, { s: 20, w: 500, c: C.t2, a: chatA });
      pill(980, 506, 'Open', { s: 17, al: 'right', h: 32, dot: C.green, a: chatA });
      pill(980, 548, 'Omar K.', { s: 17, al: 'right', h: 32, a: chatA });
      // channel chips — Messenger / Instagram shown as inbound only
      const chips = [['WhatsApp', 'WhatsApp Cloud API', true], ['Messenger', 'Messenger · inbound'], ['Instagram', 'Instagram · inbound']];
      let cx = 110;
      chips.forEach(([ch, lab, on], i) => {
        const a = chatA * E.out(P(L, 66 + i * 5, 12));
        chIcon(cx + 16, 620, 30, ch, a);
        const w = pill(cx + 38, 620, lab, { s: 16, h: 34, padX: 12, a, bg: on ? 'rgba(37,211,102,0.14)' : 'rgba(255,255,255,0.04)', border: on ? 'rgba(37,211,102,0.5)' : 'rgba(130,170,255,0.2)', c: on ? C.white : C.t2 });
        cx += w + 60;
      });
      ctx.save(); ctx.globalAlpha = chatA; ctx.fillStyle = C.line; ctx.fillRect(110, 660, 860, 1); ctx.restore();
      let by = 700;
      MSGS.forEach(m => {
        const a = chatA * E.out(P(L, m.s, 12)); if (a <= 0) return;
        const off = (1 - E.out5(P(L, m.s, 14))) * 30;
        bubble(110, by + off, 860, m.t, m.me, a); by += 100;
      });
      // typing indicator
      if (L > 132 && L < 200) for (let k = 0; k < 3; k++) dot(980 - 70 + k * 22, by + 38, 6, `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(L / 5 + k))})`);
      T('Conversation linked to customer profile', 540, 1210, { s: 19, w: 500, c: C.t3, al: 'center', a: chatA });
    });
    // --- C: customer context bottom sheet (120–200)
    const sh = E.out5(P(L, 118, 24)) * (1 - E.in(P(L, 206, 14)));
    if (sh > 0) {
      const y = lerp(1900, 1010, sh) + lerp(0, -40, shrink);
      panel(90, y, 900, 380, { r: 34, a: sh, glow: 'rgba(47,107,255,0.4)', fill0: 'rgba(24,40,88,0.97)', fill1: 'rgba(12,22,52,0.97)' });
      ctx.save(); ctx.globalAlpha = sh; rr(500, y + 14, 80, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); ctx.restore();
      T('Customer context', 130, y + 60, { s: 24, w: 700, a: sh });
      const items = [['Opportunity', `${HERO.opp} · ${HERO.deal}`, C.cyan], ['Stage', 'New', C.white], ['Owner', 'Omar K.', C.white], ['Next task', 'Follow-up call · Tomorrow 11:00', C.amber]];
      items.forEach(([k, v, c], i) => {
        const a = sh * E.out(P(L, 132 + i * 5, 12));
        T(k, 130, y + 120 + i * 60, { s: 20, w: 500, c: C.t3, a }); T(v, 330, y + 120 + i * 60, { s: 23, w: 600, c, a });
      });
      // link from chat to task
      const lk = E.io(P(L, 156, 18));
      if (lk > 0) glowLine(bezPts([940, 800], [1040, 900], [1040, y + 250], [960, y + 300], 0, lk), { c: C.cyan, lw: 2.5, a: sh });
    }
  }
  // --- D: mobile sales desk (200–275)
  const ph = E.out5(P(L, 204, 26)) * (1 - E.io(P(L, 272, 22)));
  if (ph > 0) {
    const pw = 520, phH = 960, px = lerp(W + 50, 540 - pw / 2 + 150, ph), py = 470;
    // desktop remnant
    ctx.save(); ctx.globalAlpha = 0.35 * ph; ctx.filter = 'blur(3px)'; panel(40, 520, 520, 700, { r: 28 }); ctx.filter = 'none'; ctx.restore();
    T('Web dashboard', 300, 1250, { s: 20, w: 600, c: C.t3, al: 'center', a: ph * 0.8 });
    // phone
    ctx.save(); ctx.shadowColor = 'rgba(47,107,255,0.5)'; ctx.shadowBlur = 60; rr(px, py, pw, phH, 70); ctx.fillStyle = '#070C1C'; ctx.fill(); ctx.restore();
    ctx.save(); rr(px, py, pw, phH, 70); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(160,190,255,0.35)'; ctx.stroke(); ctx.restore();
    ctx.save(); rr(px + 16, py + 16, pw - 32, phH - 32, 56); ctx.clip();
    const sx = px + 44;
    T('9:41', sx, py + 56, { s: 20, w: 600 });
    rr(px + pw / 2 - 60, py + 34, 120, 34, 17); ctx.fillStyle = '#000'; ctx.fill();
    T('Sales Desk', sx, py + 130, { s: 34, w: 800 });
    T('My assigned leads', sx, py + 172, { s: 19, w: 500, c: C.t2 });
    const leads = [[HERO.name, 'New · SLA 14:12', C.cyan, true], ['Tamer Aly', 'Working · Call today', C.blue], ['Rana Wael', 'Proposal · Due Thu', C.violet]];
    leads.forEach(([nm, st, c, hi], i) => {
      const ly = py + 220 + i * 130, a = E.out(P(L, 216 + i * 5, 12));
      panel(sx - 12, ly, pw - 64, 112, { r: 22, a, stroke: hi ? 'rgba(34,211,238,0.5)' : C.stroke });
      avatar(sx + 44, ly + 56, 30, nm.split(' ').map(s => s[0]).join(''), c, C.cyan, a);
      T(nm, sx + 90, ly + 40, { s: 24, w: 700, a }); T(st, sx + 90, ly + 76, { s: 18, w: 500, c: C.t2, a });
    });
    T('Activities', sx, py + 640, { s: 22, w: 700, a: E.out(P(L, 232, 12)) });
    [['Call', 'Mariam Adel · 11:00'], ['Task', 'Send proposal · Rana W.']].forEach(([k, v], i) => {
      const a = E.out(P(L, 236 + i * 5, 12)), ay = py + 690 + i * 70;
      pill(sx, ay, k, { s: 16, h: 32, padX: 12, a }); T(v, sx + 90, ay, { s: 19, w: 500, c: C.t2, a });
    });
    // push notification
    const nt = E.out5(P(L, 240, 16)) * (1 - E.in(P(L, 266, 10)));
    if (nt > 0) {
      const ny = lerp(py - 120, py + 80, nt);
      panel(px + 30, ny, pw - 60, 110, { r: 26, a: nt, fill0: 'rgba(40,58,110,0.98)', fill1: 'rgba(26,40,84,0.98)', glow: 'rgba(34,211,238,0.4)' });
      const iw = 44, ih = iw * IMG.icon.height / IMG.icon.width;
      ctx.save(); ctx.globalAlpha = nt; ctx.drawImage(IMG.icon, px + 58, ny + 55 - ih / 2, iw, ih); ctx.restore();
      T('NEXUS · now', px + 118, ny + 36, { s: 16, w: 600, c: C.t2, a: nt });
      T('New lead assigned to you', px + 118, ny + 72, { s: 21, w: 700, a: nt });
    }
    ctx.restore();
  }
  // --- E: contract into opportunity card (272–299)
  const ct = E.io(P(L, 270, 28));
  if (ct > 0) {
    const w = lerp(700, 470, ct), h = lerp(600, 118, ct);
    const x = lerp(540 - w / 2, 510, ct), y = lerp(600, 520, ct);
    oppCard(x, y, w, h, E.out(P(L, 270, 10)), 0);
  }
  headline('CONNECTED CONVERSATIONS', f, 786, 900, 330, { s: 50 });
  headline('CUSTOMER CONTEXT', f, 902, 980, 330);
  headline('TEAM WORKFLOW', f, 984, 1070, 330, { sub: 'Web + mobile sales desk', subS: 28 });
}

// ================================================================= SCENE 5 — SALES PIPELINE (1080–1409)
const STAGES = [
  { k: 'NEW', c: C.cyan, n: 42 }, { k: 'WORKING', c: C.blue, n: 31 }, { k: 'PROPOSAL', c: C.violet, n: 18 },
  { k: 'COMMITTED', c: '#A78BFA', n: 11 }, { k: 'WON', c: C.green, n: 7 },
];
const LANE_Y = 470, LANE_H = 162, LANE_G = 14;
function oppCard(x, y, w, h, a, stage, extra = {}) {
  if (a <= 0) return;
  const won = stage === 4 && extra.won;
  panel(x, y, w, h, { r: 22, a, glow: won ? 'rgba(52,211,153,0.6)' : 'rgba(34,211,238,0.35)', stroke: won ? 'rgba(52,211,153,0.8)' : 'rgba(34,211,238,0.6)', fill0: 'rgba(30,48,100,0.97)', fill1: 'rgba(16,28,64,0.97)' });
  if (h < 90) return;
  ctx.save(); rr(x, y, w, h, 22); ctx.clip();
  avatar(x + 50, y + h / 2, 30, 'OK', C.blue, C.cyan, a);
  T(HERO.name, x + 94, y + h / 2 - 20, { s: 25, w: 700, a });
  T(`${HERO.deal} · ${HERO.val}`, x + 94, y + h / 2 + 16, { s: 18, w: 500, c: C.t2, a });
  const st = STAGES[stage];
  pill(x + w - 18, y + 28, won ? 'WON' : st.k, { s: 15, al: 'right', h: 28, padX: 10, a, dot: st.c, bg: won ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)', border: won ? C.green : 'rgba(130,170,255,0.3)', c: won ? C.green : C.white });
  ctx.restore();
}
function ghostCard(x, y, w, nm, sub, a, tag) {
  panel(x, y, w, 108, { r: 20, a: a * 0.9, fill0: 'rgba(20,32,70,0.7)', fill1: 'rgba(12,20,46,0.7)' });
  T(nm, x + 22, y + 38, { s: 21, w: 700, a: a * 0.85 });
  T(sub, x + 22, y + 72, { s: 16, w: 500, c: C.t3, a });
  if (tag) pill(x + w - 14, y + 30, tag[0], { s: 13, al: 'right', h: 24, padX: 9, a, bg: tag[1], border: tag[2], c: tag[3] });
}
function scene5(f) {
  const L = f - 1080;
  const morph = E.io(P(L, 300, 30)); // lanes → funnel
  // stage schedule for hero card
  const hops = [30, 80, 130, 180]; // frame (local) each hop starts
  let pos = 0; hops.forEach((h, i) => { pos += E.io(P(L, h, 20)); });
  const stage = Math.min(4, Math.floor(pos + 0.5));
  STAGES.forEach((s, i) => {
    const ly = LANE_Y + i * (LANE_H + LANE_G);
    const a = E.out(P(L, i * 4, 16));
    // morph: lane width → funnel bar width
    const fw = lerp(940, 300 + 640 * s.n / 42, morph), fx = W / 2 - fw / 2;
    const fh = lerp(LANE_H, 90, morph), fy = lerp(ly, 620 + i * 100, morph);
    const on = Math.round(pos) === i;
    panel(fx, fy, fw, fh, { r: lerp(26, 16, morph), a: a * (1 - morph * 0.2), stroke: on && morph < 0.5 ? s.c + 'AA' : C.stroke,
      fill0: morph > 0 ? `rgba(${i === 4 ? '52,211,153' : '47,107,255'},${0.10 + 0.25 * morph})` : undefined });
    T(s.k, fx + 34, fy + fh / 2 - lerp(22, 0, morph), { s: 24, w: 800, ls: 2, c: s.c, a });
    T(`${s.n} opportunities`, fx + 34, fy + fh / 2 + 18, { s: 17, w: 500, c: C.t3, a: a * (1 - morph) });
    if (morph > 0) T(String(s.n), fx + fw - 30, fy + fh / 2, { s: 26, w: 700, al: 'right', a: morph });
    // background opportunities in lanes
    const ga = a * (1 - E.out(P(L, 296, 14)));
    const others = [
      [['Karim Said', 'Consulting · EGP 12,000']],
      [['Nour Hany', 'Annual plan · EGP 30,000']],
      [['Hady Mostafa', 'Setup · EGP 8,500', ['LOST', 'rgba(148,163,184,0.18)', 'rgba(148,163,184,0.5)', '#94A3B8']]],
      [['Salma Fathy', 'Expansion · EGP 60,000']],
      [['Tamer Aly', 'Renewal · EGP 18,000', ['WON', 'rgba(52,211,153,0.15)', 'rgba(52,211,153,0.5)', C.green]]],
    ][i];
    others.forEach(([nm, sub, tag]) => ghostCard(250, ly + 27, 240, nm, sub, ga, tag));
  });
  // hero card path
  const heroA = E.out(P(L, 0, 10)) * (1 - E.in(P(L, 292, 12)));
  const hy = LANE_Y + 22 + pos * (LANE_H + LANE_G);
  const won = L > 200;
  // swing while moving
  const moving = hops.some(h => L > h && L < h + 20);
  ctx.save(); const rot = moving ? Math.sin(P(L % 50, 30, 20) * Math.PI) * 0.03 : 0;
  ctx.translate(745, hy + 59); ctx.rotate(rot); ctx.translate(-745, -(hy + 59));
  oppCard(510, hy, 470, 118, heroA, stage, { won });
  ctx.restore();
  // won ring pulse (restrained)
  if (won) {
    const t = P(L, 200, 40);
    if (t < 1) { ctx.save(); ctx.globalAlpha = (1 - t) * 0.6 * heroA; rr(510 - t * 30, hy - t * 30, 470 + t * 60, 118 + t * 60, 22 + t * 20); ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
  }
  // attached follow-up task (per stage)
  const tasks = [null, ['Activity', 'Discovery call logged'], ['Task', 'Send proposal · Due Thu'], ['Follow-up', 'Contract review · Mon'], ['Done', 'Closed won by Omar K.']];
  const ts = tasks[Math.min(4, Math.round(pos))];
  const tIn = E.out(P(L, 50, 14)) * heroA;
  if (ts && tIn > 0) {
    const tx = 560, ty = hy + 140;
    const la = tIn * (1 - (moving ? 0.6 : 0));
    ctx.save(); ctx.globalAlpha = la; ctx.setLineDash([4, 6]); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(600, hy + 118); ctx.lineTo(600, ty - 4); ctx.stroke(); ctx.restore();
    if (hy + 140 < 1330) pill(tx, ty + 12, `${ts[0]} · ${ts[1]}`, { s: 17, h: 36, padX: 14, a: la, dot: Math.round(pos) === 4 ? C.green : C.amber, bg: 'rgba(12,20,44,0.96)' });
  }
  headline('TRACK EVERY OPPORTUNITY', f, 1086, 1236, 330, { s: 50 });
  headline('MANAGE EVERY STAGE', f, 1240, 1400, 330);
  // label for funnel during morph
  T('Opportunity stages', W / 2, 585, { s: 24, w: 600, c: C.t2, al: 'center', a: morph });
}

// ================================================================= SCENE 6 — BUSINESS VISIBILITY (1410–1649)
function kpi(x, y, w, h, label, val, dv, a, c) {
  panel(x, y, w, h, { r: 26, a });
  T(label, x + 30, y + 44, { s: 20, w: 600, c: C.t3, a, ls: 1 });
  T(val, x + 30, y + 98, { s: 48, w: 800, a });
  // sparkline
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const px = x + w - 160 + i * 6.5, py = y + 110 - (Math.sin(i * 0.7 + dv) * 10 + i * 1.6) * dv; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
}
function scene6(f) {
  const L = f - 1410;
  const out = E.io(P(L, 208, 32));
  const cv = (x, y) => [lerp(x, 540, out), lerp(y, 960, out)];
  const fade = 1 - out;
  ctx.save(); ctx.translate(540, 960); ctx.scale(lerp(1, 0.2, out), lerp(1, 0.2, out)); ctx.translate(-540, -960);
  // header
  const ha = E.out(P(L, 0, 16)) * fade;
  T('Performance · Last 30 days', 70, 452, { s: 26, w: 700, a: ha });
  pill(70, 496, 'Illustrative data', { s: 15, h: 28, padX: 12, a: ha, bg: 'rgba(255,255,255,0.05)', c: C.t3 });
  const ex = E.back(P(L, 180, 14));
  pill(1010, 470, 'Export report ↓', { s: 18, al: 'right', h: 44, a: ha, bg: L > 186 ? 'rgba(34,211,238,0.25)' : 'rgba(47,107,255,0.18)', border: L > 186 ? C.cyan : 'rgba(120,170,255,0.4)' });
  if (L > 186 && L < 206) { const t = P(L, 186, 20); ctx.save(); ctx.globalAlpha = (1 - t); rr(800 - t * 10, 448 - t * 10, 210 + t * 20, 44 + t * 20, 30); ctx.strokeStyle = C.cyan; ctx.stroke(); ctx.restore(); }
  // KPIs (count up)
  const cu = E.out5(P(L, 10, 50));
  const kp = [['LEADS', 1248, C.cyan], ['OPPORTUNITIES', 312, C.blue], ['WON DEALS', 64, C.green], ['TEAM ACTIVITIES', 1930, C.violet]];
  kp.forEach(([lb, v, c], i) => {
    const a = E.out(P(L, 6 + i * 5, 16)) * fade;
    const x = 70 + (i % 2) * 480, y = 530 + Math.floor(i / 2) * 156;
    kpi(x, y, 460, 142, lb, Math.round(v * cu).toLocaleString('en-US'), cu, a, c);
  });
  // lead sources
  const sy = 850, sa = E.out(P(L, 30, 16)) * fade;
  panel(70, sy, 940, 282, { r: 28, a: sa });
  T('Lead sources', 104, sy + 46, { s: 22, w: 700, a: sa });
  const src = [['Meta Lead Ads', 540, C.blue], ['Website forms', 386, C.cyan], ['Lead import', 212, C.violet], ['WhatsApp', 110, '#25D366']];
  src.forEach(([nm, v, c], i) => {
    const by = sy + 96 + i * 48, g = E.out5(P(L, 40 + i * 5, 34));
    T(nm, 104, by, { s: 19, w: 500, c: C.t2, a: sa });
    ctx.save(); ctx.globalAlpha = sa; rr(330, by - 12, 560, 24, 12); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    rr(330, by - 12, Math.max(24, 560 * v / 540 * g), 24, 12); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fill(); ctx.restore();
    T(String(Math.round(v * g)), 976, by, { s: 20, w: 700, al: 'right', a: sa });
  });
  // opportunity stages (continuity from pipeline) + team activity
  const fy = 1150, fa = E.out(P(L, 46, 16)) * fade;
  panel(70, fy, 460, 170, { r: 26, a: fa });
  T('Opportunity stages', 100, fy + 40, { s: 19, w: 700, a: fa });
  STAGES.forEach((s, i) => {
    const bw = 30 + 330 * s.n / 42 * E.out(P(L, 50 + i * 3, 24));
    ctx.save(); ctx.globalAlpha = fa; rr(100, fy + 68 + i * 19, bw, 11, 6); ctx.fillStyle = s.c; ctx.fill(); ctx.restore();
  });
  // pipeline funnel from scene 5 flies into the mini "Opportunity stages" chart
  const hand = E.io(P(L, 0, 26)), ha2 = 1 - E.in(P(L, 18, 10));
  if (ha2 > 0) STAGES.forEach((s, i) => {
    const fw = 300 + 640 * s.n / 42, bw = 30 + 330 * s.n / 42;
    const x = lerp(W / 2 - fw / 2, 100, hand), y = lerp(620 + i * 100, fy + 68 + i * 19, hand);
    ctx.save(); ctx.globalAlpha = ha2; rr(x, y, lerp(fw, bw, hand), lerp(90, 11, hand), lerp(16, 6, hand));
    ctx.fillStyle = s.c + '66'; ctx.fill(); ctx.strokeStyle = s.c; ctx.stroke(); ctx.restore();
  });
  panel(550, fy, 460, 170, { r: 26, a: fa });
  T('Team activity', 580, fy + 40, { s: 19, w: 700, a: fa });
  REPS.forEach(([nm, ini, c1, c2], i) => {
    const h = [80, 62, 70, 54][i] * E.out(P(L, 56 + i * 3, 24));
    const bx = 610 + i * 100;
    ctx.save(); ctx.globalAlpha = fa; rr(bx, fy + 138 - h, 44, h, 10); ctx.fillStyle = c1; ctx.fill(); ctx.restore();
    T(ini, bx + 22, fy + 154, { s: 14, w: 700, c: C.t3, al: 'center', a: fa });
  });
  // attribution path: Meta Lead Ads → OPP-1042 WON
  const at = E.io(P(L, 110, 40));
  if (at > 0) {
    const chip = [540, 1372];
    const p0 = [330 + 560 * E.out5(P(L, 40, 34)), sy + 100], p1 = [1060, sy + 200], p2 = [1060, 1372], p3 = [chip[0] + 250, chip[1]];
    glowLine(bezPts(p0, p1, p2, p3, 0, at), { c: C.cyan, lw: 3, a: fade });
    dot(...bez(p0, p1, p2, p3, at), 7, C.white, 20);
    const ca = E.back(P(L, 146, 16)) * fade;
    ctx.save(); ctx.globalAlpha = clamp(ca);
    pill(chip[0], chip[1], `Meta Lead Ads → ${HERO.opp} · ${HERO.name} · WON`, { s: 19, al: 'center', h: 48, padX: 20, dot: C.green, bg: 'rgba(12,24,48,0.97)', border: C.green });
    ctx.restore();
  }
  ctx.restore();
  // converging points (transition)
  if (out > 0) {
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const sx = 70 + r() * 940, sy2 = 440 + r() * 1100;
      const t = E.io(clamp(out * 1.2 - r() * 0.2));
      dot(lerp(sx, 540, t), lerp(sy2, 800, t), 3 + r() * 3, r() < 0.5 ? C.cyan : C.blue, 12);
    }
  }
  headline('DATA INTO DECISIONS', f, 1416, 1636, 330, { sub: 'Know your sources · Track your team', subS: 28 });
}

// ================================================================= SCENE 7 — FINAL BRAND REVEAL (1650–1799)
function scene7(f) {
  const L = f - 1650;
  // icon nodes network collapsing
  const col = E.io(P(L, 0, 26));
  const nodes = 7;
  for (let i = 0; i < nodes; i++) {
    const ang = i / nodes * Math.PI * 2 + L / 60;
    const rad = lerp(300, 0, col);
    const x = 540 + Math.cos(ang) * rad, y = 800 + Math.sin(ang) * rad;
    if (col < 1) { dot(x, y, 9, i % 2 ? C.cyan : C.blue, 20); glowLine([[x, y], [540, 800]], { c: C.blue, lw: 1.5, a: 0.5 * (1 - col), blur: 8 }); }
  }
  const fl = P(L, 20, 30);
  if (fl > 0 && fl < 1) {
    const g = ctx.createRadialGradient(540, 800, 0, 540, 800, 600);
    g.addColorStop(0, `rgba(47,107,255,${0.5 * (1 - fl)})`); g.addColorStop(1, 'rgba(47,107,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const la = E.out(P(L, 18, 22));
  const lw = lerp(700, 800, E.out5(P(L, 18, 60))), lh = lw * IMG.logo.height / IMG.logo.width;
  ctx.save(); ctx.globalAlpha = la; ctx.shadowColor = 'rgba(47,107,255,0.8)'; ctx.shadowBlur = 50;
  ctx.drawImage(IMG.logo, 540 - lw / 2, 780 - lh / 2, lw, lh); ctx.restore();
  // Arabic tagline
  const ta = E.out(P(L, 38, 18));
  T('من أول ليد… لآخر خطوة في البيعة.', 540, 1080 + (1 - ta) * 20, { s: 58, w: 800, ar: true, al: 'center', a: ta, glow: 'rgba(34,211,238,0.35)', glowBlur: 24 });
  const ea = E.out(P(L, 52, 18));
  T('Organize. Connect. Grow.', 543, 1170, { s: 34, w: 600, ls: lerp(14, 4, ea), c: C.cyan, al: 'center', a: ea });
  // CTA
  const ca = E.back(P(L, 64, 18));
  if (ca > 0) {
    const w = 560, h = 104, x = 540 - w / 2, y = 1290;
    ctx.save(); ctx.globalAlpha = clamp(ca); ctx.translate(540, y + h / 2); ctx.scale(lerp(0.85, 1, clamp(ca)), lerp(0.85, 1, clamp(ca))); ctx.translate(-540, -(y + h / 2));
    rr(x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, C.blue); g.addColorStop(1, '#1FB6D6');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(47,107,255,0.7)'; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0;
    // sheen sweep
    const sw = P(L, 90, 30);
    if (sw > 0 && sw < 1) { ctx.save(); rr(x, y, w, h, h / 2); ctx.clip(); const sx = x - 200 + sw * (w + 400); const sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sg; ctx.fillRect(x, y, w, h); ctx.restore(); }
    ctx.restore();
    T('اكتشف NEXUS CRM', 540, y + h / 2 + 2, { s: 42, w: 800, ar: true, al: 'center', a: clamp(ca) });
  }
}

// ================================================================= master
const HUES = [
  ['rgba(47,107,255,0.16)', 'rgba(124,92,255,0.12)'],
  ['rgba(47,107,255,0.22)', 'rgba(34,211,238,0.14)'],
  ['rgba(34,211,238,0.14)', 'rgba(47,107,255,0.16)'],
  ['rgba(47,107,255,0.18)', 'rgba(124,92,255,0.14)'],
  ['rgba(124,92,255,0.14)', 'rgba(34,211,238,0.14)'],
  ['rgba(34,211,238,0.14)', 'rgba(47,107,255,0.18)'],
  ['rgba(47,107,255,0.24)', 'rgba(34,211,238,0.16)'],
];
function renderFrame(f) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none';
  const si = TL.scenes.findIndex(s => f >= s.start && f < s.end);
  background(f, HUES[Math.max(0, si)]);
  if (f < 210) scene1(f);
  else if (f < 450) scene2(f);
  else if (f < 780) scene3(f);
  else if (f < 1080) scene4(f);
  else if (f < 1410) scene5(f);
  else if (f < 1650) scene6(f);
  else scene7(f);
  vignette();
  captions(f);
}

async function init() {
  await document.fonts.load("700 40px 'Cairo'"); await document.fonts.load("800 40px 'Cairo'");
  await document.fonts.load("500 40px 'Cairo'"); await document.fonts.load("600 40px 'Inter'");
  await document.fonts.load("800 40px 'Inter'"); await document.fonts.load("700 40px 'Inter'"); await document.fonts.load("500 40px 'Inter'");
  await document.fonts.ready;
  await loadImages();
  buildBG(); buildCaptions();
  window.renderFrame = renderFrame;
  window.setCaptions = v => { SHOW_CAPTIONS = v; };
  window.NEXUS_READY = true;
}
window.nexusInit = init();
})();
