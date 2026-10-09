// 9k design system tokens + signature drawing helpers for canvas films.
// Source: https://design.the9klabs.com (snapshot 2026-10-05). Keep in sync with references/brand.md.
// Classic script — exposes window.BRAND (alias window.B). Depends on window.M (motion.js).
(function (g) {
  const C = {
    primary: '#166434', onPrimary: '#FFFFFF', primaryAlpha12: 'rgba(22,100,52,0.12)',
    accent: '#E85A02', onAccent: '#000000',
    dark: '#0A111A', darkLift: '#2A486F',
    gray: '#CCCCCC', darkGray: '#757575', white: '#FFFFFF',
    amber: '#F2C069',
    glowLight: ['#88D29B', '#FAC871', '#FF9363'], // green → amber → orange
    glowDark: ['#499B56', '#4FA866', '#E85A02'],
  };

  const THEMES = {
    dark: {
      bg: '#0F0F0F', text: '#F5F5F5', muted: '#999999', primaryText: '#2FB161',
      surface: '#1A1A1A', raised: '#242424', sunken: '#141414', hover: '#2E2E2E',
      border: '#404040', focus: '#5ED48B', selected: '#1F3327',
      success: '#72DA9A', error: '#F39191', warning: '#F4C871', glow: C.glowDark, glowOpacity: 0.35,
    },
    light: {
      bg: '#FAFAFA', text: '#1A1A1A', muted: '#666666', primaryText: '#166434',
      surface: '#FFFFFF', raised: '#FFFFFF', sunken: '#F5F5F5', hover: '#F0F0F0',
      border: '#D6D6D6', focus: '#166434', selected: '#EAF5EE',
      success: '#166434', error: '#A02222', warning: '#885207', glow: C.glowLight, glowOpacity: 0.5,
    },
    // I9kSection variant="primary": same green in both themes. No error/warning/success on it.
    green: {
      bg: C.primary, text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)', primaryText: '#FFFFFF',
      surface: 'rgba(255,255,255,0.15)', raised: 'rgba(255,255,255,0.2)', sunken: 'rgba(0,0,0,0.12)', hover: 'rgba(255,255,255,0.2)',
      border: 'rgba(255,255,255,0.2)', focus: '#FFFFFF', selected: 'rgba(255,255,255,0.15)',
      glow: C.glowLight, glowOpacity: 0.25,
    },
  };

  const FONTS = {
    sans: '"IBM Plex Sans", sans-serif',
    serif: '"IBM Plex Serif", serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
    arSans: '"Thmanyah Sans", "IBM Plex Sans Arabic", sans-serif',
    arDisplay: '"Thmanyah Serif Display", "IBM Plex Sans Arabic", serif',
  };

  const SHADOW = { sm: [0, 1, 3, 'rgba(0,0,0,0.1)'], md: [0, 8, 25, 'rgba(0,0,0,0.1)'] };
  const ASCII = ['^_^', '·ᴗ·', '◡̈', '>‿<', 'x_x', 'o_o', '-_-'];

  // ---- frame context -------------------------------------------------------
  // Call once per draw: B.frame(g, W, H, { theme: 'dark', dir: 'ltr' })
  let F = { W: 1080, H: 1920, rem: 32, theme: THEMES.dark, dir: 'ltr' };
  function frame(ctx, W, H, opts = {}) {
    F = { W, H, rem: Math.min(W, H) / 1080 * 32, theme: THEMES[opts.theme || 'dark'], themeName: opts.theme || 'dark', dir: opts.dir || 'ltr' };
    ctx.direction = F.dir;
    return F;
  }
  const rem = (n) => n * F.rem;
  // Logical → physical x. Scenes position from the reading start: B.sx(pad) is the left edge in LTR, the right edge in RTL.
  const sx = (x) => (F.dir === 'rtl' ? F.W - x : x);
  const radius = { sm: () => rem(0.5), md: () => rem(0.75), lg: () => rem(1), pill: () => 9999 };

  function font(ctx, weight, sizePx, family = 'sans') {
    const fam = F.dir === 'rtl' && (family === 'sans' || family === 'serif') ? (family === 'serif' ? FONTS.arDisplay : FONTS.arSans) : FONTS[family] || family;
    ctx.font = `${weight} ${Math.round(sizePx)}px ${fam}`;
  }

  function background(ctx, alpha = false) {
    if (alpha) { ctx.clearRect(0, 0, F.W, F.H); return; }
    ctx.fillStyle = F.theme.bg; ctx.fillRect(0, 0, F.W, F.H);
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }

  function shadow(ctx, s) {
    if (!s) { ctx.shadowColor = 'transparent'; return; }
    const k = F.rem / 16;
    ctx.shadowOffsetX = s[0] * k; ctx.shadowOffsetY = s[1] * k; ctx.shadowBlur = s[2] * k; ctx.shadowColor = s[3];
  }

  // ---- grain (seeded, fixed per frame index so it shimmers like film) ------
  const grainCache = {};
  function grainTile(seed) {
    if (grainCache[seed]) return grainCache[seed];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), img = x.createImageData(256, 256), r = M.rng(seed);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return (grainCache[seed] = c);
  }
  function grain(ctx, t, amount = 0.06, fps = 24) {
    const tile = grainTile(1 + (Math.floor(t * fps) % 8));
    ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, F.W, F.H); ctx.restore();
  }

  // ---- I9kGlow: soft green→amber→orange circle, half off-screen, drifting ----
  // position: 'top' | 'top-start' | 'top-end' | 'start' | 'end' | 'center' (logical, follows dir)
  function glow(ctx, t, position = 'end', opacity) {
    const size = Math.max(F.W, F.H) * 0.8, half = size / 2;
    const rtl = F.dir === 'rtl', startX = rtl ? F.W : 0, endX = rtl ? 0 : F.W;
    const pos = {
      top: [F.W / 2, 0], 'top-start': [startX, 0], 'top-end': [endX, 0],
      start: [startX, F.H / 2], end: [endX, F.H / 2], center: [F.W / 2, F.H / 2],
    }[position] || [endX, F.H / 2];
    const ph = 0.5 - 0.5 * Math.cos((Math.PI * (t % 40)) / 20); // 20 s ease-in-out, alternate
    const cx = pos[0] - 0.04 * size * ph, cy = pos[1] + 0.06 * size * ph, s = 1 + 0.08 * ph;
    const off = glowSprite(size, position.startsWith('top'));
    ctx.save(); ctx.globalAlpha = opacity ?? F.theme.glowOpacity;
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.drawImage(off, -half, -half); ctx.restore();
  }
  const glowCache = {};
  function glowSprite(size, top) {
    const key = `${Math.ceil(size)}|${F.themeName}|${top}`;
    if (glowCache[key]) return glowCache[key];
    const half = size / 2, [a, b, c] = F.theme.glow;
    const off = document.createElement('canvas'); off.width = off.height = Math.ceil(size);
    const o = off.getContext('2d');
    const lin = o.createLinearGradient(0, 0, 0, size);
    lin.addColorStop(top ? 0.55 : 0.25, a); lin.addColorStop(top ? 0.75 : 0.62, b); lin.addColorStop(0.92, c);
    o.fillStyle = lin; o.fillRect(0, 0, size, size);
    o.globalCompositeOperation = 'destination-in'; // mask: radial-gradient(closest-side, #000 45%, transparent)
    const rad = o.createRadialGradient(half, half, 0, half, half, half);
    rad.addColorStop(0.45, '#000'); rad.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = rad; o.fillRect(0, 0, size, size);
    return (glowCache[key] = off);
  }

  // ---- Nino, the 9k pixel mascot (64-unit viewBox, crisp edges) ------------
  const NINO_FACES = {
    idle: { eyes: [[16, 12, 12, 12], [36, 12, 12, 12]], mouth: 'M16 28H20V32H44V28H48V36H44V40H20V36H16V28Z' },
    happy: { eyes: [[16, 16, 12, 8], [36, 16, 12, 8]], mouth: 'M16 28H48V32H44V36H40V40H24V36H20V32H16V28Z' },
    thinking: { eyes: [[16, 16, 12, 8], [36, 12, 12, 12]], mouth: 'M32 28H44V36H32V28Z' },
    worried: { brows: [[16, 12, 12, 4], [36, 12, 12, 4]], eyes: [[16, 16, 8, 8], [40, 16, 8, 8]], mouth: 'M16 40H20V36H44V40H48V32H44V28H20V32H16V40Z' },
    surprised: { eyes: [[16, 8, 12, 16], [36, 8, 12, 16]], mouth: 'M28 28H36V40H28V28Z' },
    'eyes-closed': { eyes: [[16, 20, 12, 4], [36, 20, 12, 4]], mouth: 'M20 28H24V32H40V28H44V36H40V40H24V36H20V28Z' },
  };
  const NINO_COLORS = { body: C.primary, screen: C.dark, eye: C.accent, mouth: C.primary };
  // look: 'center'|'up'|'down'|'start'|'end' — shifts eyes 4 units (a glance, not a turn)
  function nino(ctx, x, y, size, { expression = 'idle', look = 'center', t = 0, animated = true, colors = {} } = {}) {
    const col = { ...NINO_COLORS, ...colors }, face = NINO_FACES[expression] || NINO_FACES.idle;
    const u = Math.max(1, Math.round(size / 64 * 4)) / 4; // whole-pixel unit: 4 viewBox units = 1 nino pixel
    let dx = 0, dy = 0;
    if (animated && expression === 'thinking') dy = -2 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t % 2.4)) / 2.4));
    if (animated && expression === 'worried') dx = [0, -1, 0, 1][Math.floor(((t % 0.6) / 0.6) * 4)];
    const blinkP = (t % 5.4) / 5.4, blink = animated && expression !== 'eyes-closed' && blinkP >= 0.94 && blinkP < 0.97;
    const lk = { center: [0, 0], up: [0, -4], down: [0, 4], start: [F.dir === 'rtl' ? 4 : -4, 0], end: [F.dir === 'rtl' ? -4 : 4, 0] }[look] || [0, 0];
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(u, u); ctx.translate(dx, dy);
    const R = (r, c) => { ctx.fillStyle = c; ctx.fillRect(r[0], r[1], r[2], r[3]); };
    [[0, 20, 8, 16], [56, 20, 8, 16], [16, 48, 12, 8], [36, 48, 12, 8], [8, 4, 48, 44]].forEach((r) => R(r, col.body));
    R([12, 8, 40, 36], col.screen);
    (face.brows || []).forEach((r) => R(r, col.eye));
    face.eyes.forEach(([ex, ey, ew, eh]) => {
      const h = blink ? eh * 0.15 : eh, cy = ey + eh / 2;
      R([ex + lk[0], cy - h / 2 + lk[1], ew, h], col.eye);
    });
    ctx.fillStyle = col.mouth; ctx.fill(new Path2D(face.mouth));
    ctx.restore();
  }

  // ---- Wordmark: types "Ismail9k", retypes to "9k", optional wink ----------
  // phases relative to t: [0, typeEnd) type full · hold · retype to short · optional wink at `winkAt`
  function wordmark(ctx, t, x, y, { full = 'Ismail9k', short = '9k', size = rem(2), hold = 0.8, winkAt = null, color, family = 'mono', weight = 600, align = 'start' } = {}) {
    const cps = 14, typeEnd = full.length / cps;
    let s;
    if (t < typeEnd + hold) s = { text: M.typed(full, t, cps), typing: t < typeEnd };
    else s = M.retype(full, short, t - typeEnd - hold, cps);
    if (winkAt != null && t >= winkAt) {
      const w = t - winkAt, face = '^_^';
      if (w < 0.3) s = M.retype(short, face, w, 14, 20);
      else if (w < 2.3) s = { text: face, typing: false };
      else s = M.retype(face, short, w - 2.3, 14, 20);
    }
    font(ctx, weight, size, family);
    ctx.fillStyle = color || F.theme.text; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.text, x, y);
    if (M.caretOn(t, s.typing)) {
      const w = ctx.measureText(s.text).width, dir = (F.dir === 'rtl') !== (align === 'end') ? -1 : 1;
      const cxp = align === 'center' ? x + w / 2 : x + dir * w + dir * size * 0.08;
      ctx.fillStyle = C.accent; ctx.fillRect(dir < 0 ? cxp - size * 0.08 : cxp, y - size * 0.78, size * 0.08, size * 0.92);
    }
    return s.text;
  }

  // ---- components ----------------------------------------------------------
  // I9kPanel: variant 'default' | 'feature' | 'flat'
  function panel(ctx, x, y, w, h, { variant = 'default', size = 'md' } = {}) {
    const r = variant === 'feature' ? radius.lg() : radius[size]();
    ctx.save();
    if (variant !== 'flat') {
      if (variant === 'feature') shadow(ctx, SHADOW.md);
      rrect(ctx, x, y, w, h, r); ctx.fillStyle = variant === 'feature' ? F.theme.raised : F.theme.surface; ctx.fill();
      shadow(ctx, null);
      ctx.lineWidth = Math.max(1, F.rem / 16); ctx.strokeStyle = variant === 'feature' ? C.accent : F.theme.border; ctx.stroke();
    }
    ctx.restore();
  }

  // I9kBadge: variant 'solid' | 'outline' | 'tag'. Uppercase; tag gets a leading '#'.
  // x is the badge's logical start edge (its right edge in RTL).
  function badge(ctx, text, x, y, { variant = 'outline', size = rem(0.7) } = {}) {
    const label = (variant === 'tag' ? '#' : '') + text.toUpperCase();
    ctx.save(); font(ctx, 600, size); ctx.letterSpacing = `${size * 0.06}px`;
    const padX = size * 0.75, h = size * 2, w = ctx.measureText(label).width + padX * 2;
    if (F.dir === 'rtl') x -= w;
    rrect(ctx, x, y, w, h, variant === 'tag' ? radius.sm() : radius.pill());
    if (variant === 'solid') { ctx.fillStyle = C.primary; ctx.fill(); }
    else if (variant === 'tag') { ctx.fillStyle = F.theme.selected; ctx.fill(); }
    else { ctx.lineWidth = Math.max(1, F.rem / 16); ctx.strokeStyle = F.theme.border; ctx.stroke(); }
    ctx.fillStyle = variant === 'solid' ? C.onPrimary : variant === 'tag' ? F.theme.primaryText : F.theme.text;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + h / 2 + size * 0.05);
    ctx.restore(); return { w, h };
  }

  // I9kButton: variant 'primary' (green/white) | 'accent' (orange/BLACK) | 'secondary'
  function button(ctx, text, x, y, { variant = 'primary', size = rem(1), pressed = 0 } = {}) {
    ctx.save(); font(ctx, 600, size);
    const h = size * 2.75, w = ctx.measureText(text).width + size * 2.5;
    const fill = { primary: C.primary, accent: C.accent, secondary: F.theme.surface }[variant];
    const ink = { primary: C.onPrimary, accent: C.onAccent, secondary: F.theme.text }[variant];
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(1 - 0.03 * pressed, 1 - 0.03 * pressed);
    rrect(ctx, -w / 2, -h / 2, w, h, radius.md()); ctx.fillStyle = fill; ctx.fill();
    if (variant === 'secondary') { ctx.lineWidth = Math.max(1, F.rem / 16); ctx.strokeStyle = F.theme.border; ctx.stroke(); }
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, size * 0.05);
    ctx.restore(); return { w, h };
  }

  // I9kStat: big value, small label, optional source
  function stat(ctx, value, label, x, y, { size = rem(4), align = 'start', source } = {}) {
    ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    font(ctx, 700, size); ctx.fillStyle = F.theme.text; ctx.fillText(value, x, y);
    font(ctx, 400, size * 0.28); ctx.fillStyle = F.theme.muted; ctx.fillText(label, x, y + size * 0.5);
    if (source) { font(ctx, 400, size * 0.2); ctx.fillText(source, x, y + size * 0.82); }
    ctx.restore();
  }

  // Cursor arrow, orange accent outline on dark/white fill
  function cursor(ctx, x, y, { size = rem(1.5), click = 0 } = {}) {
    ctx.save(); ctx.translate(x, y); const s = size / 24;
    if (click > 0 && click < 1) { ctx.beginPath(); ctx.arc(0, 0, size * (0.4 + click), 0, Math.PI * 2); ctx.strokeStyle = C.accent; ctx.globalAlpha = 1 - click; ctx.lineWidth = 2 * s; ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.scale(s, s); const p = new Path2D('M0 0L0 18L5 13.5L8.5 21L11.5 19.5L8 12.5L14.5 12.5Z');
    ctx.fillStyle = F.themeName === 'light' ? C.dark : C.white; ctx.fill(p);
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.accent; ctx.stroke(p); ctx.restore();
  }

  // Fonts that must be loaded before the first frame (render.mjs awaits window.ready)
  const FONT_FACES = ['400 32px "IBM Plex Sans"', '600 32px "IBM Plex Sans"', '700 32px "IBM Plex Sans"', '400 32px "IBM Plex Serif"', '700 32px "IBM Plex Serif"', '400 32px "IBM Plex Mono"', '600 32px "IBM Plex Mono"'];
  const loadFonts = () => Promise.all(FONT_FACES.map((f) => document.fonts.load(f))).then(() => document.fonts.ready);

  g.BRAND = g.B = { C, THEMES, FONTS, SHADOW, ASCII, frame, rem, sx, radius, font, background, rrect, shadow, grain, glow, nino, NINO_FACES, wordmark, panel, badge, button, stat, cursor, loadFonts, get F() { return F; } };
})(window);
