// Montage overlay: captions + 9k graphic components drawn over footage. Pure function of t.
// Classic script — exposes window.O. Depends on M (motion.js) and B (brand.js).
// Every graphic is { type, t, dur, ...props } in OUTPUT time. Optional on any graphic:
//   zone: 'top' | 'mid' | 'center' | 'low'   (portrait) — or y: 0..1 (centre of the graphic, fraction of H)
//   x / w: centre and width as fractions of W (e.g. a side column in 16:9)
//   dim: 0..0.6  darken the footage behind it · sfx: false to mute its auto sound
(function (g) {
  const { clamp, lerp, sp, tween, typed, retype, caretOn, ease9k } = M;
  let G, W, H, R, DIR, PORTRAIT, ICONS = {}, IMAGES = {};
  const rem = (n) => n * R;

  // ---- layout ------------------------------------------------------------------
  // Shorts/Reels UI covers the top ~8 %, the bottom ~22 % and a right strip ~12 %: keep everything inside.
  // A seated talking head fills ~0.12–0.45 H, so the default graphic band (mid) starts below the chin at 0.46 H
  // and captions sit at 0.72 H. Override per film with zone/y after looking at work/contact.png.
  // Graphics never grow into the caption band: anything that would cross its top is lifted (not when captions are off).
  let CAP_TOP = 0.655;
  function zoneY(p, h = 0) {
    const lift = (y) => (p.captions === false ? y : Math.max(H * 0.08, Math.min(y, CAP_TOP * H - h - rem(0.6))));
    if (p.y != null) return lift(p.y * H - h / 2);
    const z = p.zone || 'mid';
    const P = { top: 0.10, mid: 0.46, center: 0.5 - h / 2 / H, low: 0.58 };
    const L = { top: 0.08, mid: 0.30, center: 0.5 - h / 2 / H, low: 0.62 };
    return lift((PORTRAIT ? P : L)[z] * H);
  }
  // Per-graphic x (centre) / w (width) as fractions of W: set while that graphic draws, e.g. a side column in 16:9.
  let CX = null, SW = null;
  const safeW = () => (SW != null ? SW * W : PORTRAIT ? W * 0.84 : W * 0.6);
  const cx = () => (CX != null ? CX * W : PORTRAIT ? W * 0.47 : W / 2); // portrait: nudge left of the like/comment rail

  // Envelope: spring in, 0.25 s ease out. Returns { k (0→1 in), a (alpha), y (px offset) }.
  function env(t, dur, preset = 'default') {
    const k = sp(t, preset), o = tween(t, dur - 0.25, 0.25);
    return { k, a: Math.min(clamp(t * 6), 1 - o), y: (1 - k) * rem(1.4) + o * rem(0.5) };
  }
  function withEnv(e, fn) { G.save(); G.globalAlpha *= e.a; G.translate(0, e.y); fn(); G.restore(); }

  function setFont(weight, size, latin) {
    G.font = `${weight} ${Math.round(size)}px ${latin ? B.FONTS.sans : B.FONTS.arSans}`;
  }
  const isAr = (s) => /[؀-ۿ]/.test(s);
  function fontFor(s, weight, size, family = 'sans') {
    if (family === 'mono') return (G.font = `${weight} ${Math.round(size)}px ${B.FONTS.mono}`);
    if (isAr(s)) return (G.font = `${weight} ${Math.round(size)}px ${family === 'serif' ? B.FONTS.arDisplay : B.FONTS.arSans}`);
    G.font = `${weight} ${Math.round(size)}px ${family === 'serif' ? B.FONTS.serif : B.FONTS.sans}`;
  }

  // A typed line with the orange caret. align: 'center' | 'start'. Works for RTL/Arabic text.
  function typedLine(text, t, x, y, size, { cps = 18, weight = 700, family = 'sans', color, align = 'center', caret = true } = {}) {
    const s = typed(text, t, cps), typing = s.length < [...text].length;
    fontFor(text, weight, size, family);
    // align 'start' = the film's reading start (right edge in RTL); the text keeps its own direction
    const rtl = isAr(text), right = align === 'start' ? DIR === 'rtl' : align === 'end';
    G.direction = rtl ? 'rtl' : 'ltr'; G.textAlign = align === 'center' ? 'center' : right ? 'right' : 'left'; G.textBaseline = 'alphabetic';
    G.fillStyle = color || B.F.theme.text; G.fillText(s, x, y);
    if (caret && t >= 0 && caretOn(t, typing) && t < [...text].length / cps + 1.2) {
      const w = G.measureText(s).width;
      const endsLeft = align === 'center' ? rtl : right;
      const edge = align === 'center' ? (rtl ? x - w / 2 : x + w / 2) : right ? x - w : x + w;
      const cw = size * 0.08; G.fillStyle = B.C.accent;
      G.fillRect(endsLeft ? edge - cw * 2 : edge + cw, y - size * 0.8, cw, size * 0.95);
    }
    return s;
  }
  // Shrink a label until it fits maxW (never below 60 % of the requested size)
  function fit(text, weight, size, maxW, family) {
    let sz = size; fontFor(text, weight, sz, family);
    while (G.measureText(text).width > maxW && sz > size * 0.6) { sz *= 0.94; fontFor(text, weight, sz, family); }
    return sz;
  }
  function startText(text, x, y) {
    G.direction = isAr(text) ? 'rtl' : 'ltr'; G.textAlign = DIR === 'rtl' ? 'right' : 'left'; G.fillText(text, x, y);
  }
  function wrap(text, size, maxW, weight = 700, family = 'sans') {
    fontFor(text, weight, size, family);
    const words = text.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const next = cur ? cur + ' ' + w : w; if (G.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next; }
    if (cur) lines.push(cur); return lines;
  }

  function icon(slug, x, y, size, color) {
    const ic = ICONS[slug]; if (!ic) return false;
    G.save(); G.translate(x, y); G.scale(size / 24, size / 24);
    G.fillStyle = color === 'brand' ? '#' + ic.hex : color || B.F.theme.text; G.fill(new Path2D(ic.path)); G.restore();
    return true;
  }
  function dim(a) { if (a > 0) { G.save(); G.fillStyle = `rgba(0,0,0,${a})`; G.fillRect(0, 0, W, H); G.restore(); } }

  // ---- captions -------------------------------------------------------------------
  // Word-by-word: spoken words full white, upcoming words dimmed, the chunk's keyword gets the
  // orange pill (black text) while it is spoken and stays orange after. One accent per chunk.
  function captions(t, chunks, opts = {}) {
    const c = chunks.find((c) => t >= c.s - 0.05 && t < c.end); if (!c) return 0;
    const size = rem(opts.size || (PORTRAIT ? 2.05 : 1.6)), gap = size * 0.28, maxW = safeW() * 0.92;
    const lt = t - (c.s - 0.05), out = tween(t, c.end - 0.1, 0.1), k = sp(lt, 'snappy');
    const rtl = DIR === 'rtl';
    // measure tokens
    const toks = c.tokens.map((tk) => { setFont(700, tk.latin ? size * 0.92 : size, tk.latin); return { ...tk, wd: G.measureText(tk.w).width }; });
    // break into lines (logical order), max 2
    const lines = [[]]; let lw = 0;
    for (const tk of toks) { if (lines.at(-1).length && lw + gap + tk.wd > maxW) { lines.push([]); lw = 0; } lw += (lines.at(-1).length ? gap : 0) + tk.wd; lines.at(-1).push(tk); }
    const lh = size * 1.32, padX = size * 0.5, padY = size * 0.3;
    const widths = lines.map((l) => l.reduce((a, x) => a + x.wd, 0) + gap * (l.length - 1));
    const boxW = Math.max(...widths) + padX * 2, boxH = lines.length * lh + padY * 2;
    const yC = (opts.y ?? (PORTRAIT ? 0.72 : 0.84)) * H, x0 = cx() - boxW / 2, y0 = yC - boxH / 2 + (1 - k) * rem(0.5);
    G.save(); G.globalAlpha = clamp(lt * 10) * (1 - out);
    B.rrect(G, x0, y0, boxW, boxH, B.radius.md()); G.fillStyle = 'rgba(15,15,15,0.86)'; G.fill();
    G.lineWidth = Math.max(1, R / 16); G.strokeStyle = B.F.theme.border; G.stroke();
    lines.forEach((line, li) => {
      // visual runs: consecutive Latin tokens read left→right inside an RTL line
      const runs = []; for (const tk of line) { const last = runs.at(-1); if (rtl && last && last.ltr && tk.latin) last.toks.push(tk); else runs.push({ ltr: !rtl || tk.latin, toks: [tk] }); }
      let x = rtl ? cx() + widths[li] / 2 : cx() - widths[li] / 2;
      const yB = y0 + padY + li * lh + lh * 0.72;
      for (const run of runs) {
        const rw = run.toks.reduce((a, tk) => a + tk.wd, 0) + gap * (run.toks.length - 1);
        let tx = rtl ? x - rw : x;
        const order = run.ltr ? run.toks : [...run.toks].reverse();
        for (const tk of order) {
          const spoken = t >= tk.s, active = spoken && t < tk.e + 0.05;
          const on = tween(t, tk.s, 0.16, M.easeCss);
          if (tk.kw && active) {
            const pk = sp(t - tk.s, 'snappy');
            B.rrect(G, tx - size * 0.16, yB - size * 0.86, tk.wd + size * 0.32, size * 1.12, B.radius.sm());
            G.fillStyle = B.C.accent; G.globalAlpha *= 0.4 + 0.6 * pk; G.fill(); G.globalAlpha = clamp(lt * 10) * (1 - out);
          }
          setFont(700, tk.latin ? size * 0.92 : size, tk.latin);
          G.direction = tk.latin ? 'ltr' : 'rtl'; G.textAlign = 'left'; G.textBaseline = 'alphabetic';
          G.fillStyle = tk.kw && active ? B.C.onAccent : tk.kw && spoken ? B.C.accent : `rgba(245,245,245,${0.42 + 0.58 * on})`;
          G.fillText(tk.w, tx, yB);
          tx += tk.wd + gap;
        }
        x += rtl ? -(rw + gap) : rw + gap;
      }
    });
    G.restore(); return 1;
  }

  // ---- graphic components ---------------------------------------------------------------
  const C = {};

  // Hook headline: typed in a feature panel, optional muted sub line.
  // cover: [x, y, w, h] (fractions) → the panel sits exactly there, opaque from frame one, to hide burned-in text.
  C.hook = (t, p) => {
    const e = env(t, p.dur, 'heavy'), cv = p.cover;
    const size = rem(p.size || (cv ? 1.9 : PORTRAIT ? 2.9 : 2.4)), w = cv ? cv[2] * W : safeW();
    const lines = wrap(p.text, size, w - size * 1.2, 700, p.family || 'sans');
    const subSize = Math.max(size * 0.55, rem(1.1)), need = lines.length * size * 1.25 + (p.sub ? subSize * 1.8 : 0) + size * 0.8;
    const h = cv ? Math.max(cv[3] * H, need) : need, y = cv ? cv[1] * H + cv[3] * H / 2 - h / 2 : zoneY({ zone: 'top', ...p }, h);
    const x = cv ? cv[0] * W : cx() - w / 2, mid = x + w / 2;
    const body = () => {
      let tt = t - (cv ? 0.1 : 0); const cps = p.cps || 20, top = y + (h - need) / 2;
      lines.forEach((ln, i) => { const d = [...ln].length / cps; typedLine(ln, tt, mid, top + size * 0.4 + (i + 0.8) * size * 1.25 - size * 0.2, size, { cps, family: p.family, caret: tt < d || i === lines.length - 1 }); tt -= d; });
      if (p.sub) { fontFor(p.sub, 400, subSize); G.fillStyle = B.F.theme.muted; G.textAlign = 'center'; G.direction = isAr(p.sub) ? 'rtl' : 'ltr'; G.globalAlpha *= clamp((tt - 0.1) * 4); G.fillText(p.sub, mid, y + h - subSize * 1.1); }
    };
    if (cv) { // no slide: the burned text must never peek out. Out: text fades, panel stays until the cover ends.
      G.save(); B.panel(G, x, y, w, h, { variant: 'feature' }); G.globalAlpha *= e.a; body(); G.restore();
    } else withEnv(e, () => { B.panel(G, x, y, w, h, { variant: 'feature' }); body(); });
    return [{ t: cv ? 0.1 : 0, type: 'type', text: p.text, cps: p.cps || 20, gain: 0.5 }];
  };

  // Chips: logo + label pills, staggered. items: [{ label, icon: 'react' (simple-icons slug), sub }]
  C.chips = (t, p) => {
    const items = p.items || [p], stagger = p.stagger ?? 0.18;
    const measure = (sz) => items.map((it) => { fontFor(it.label, 700, sz); return G.measureText(it.label).width + sz * (it.icon && ICONS[it.icon] ? 3.4 : 2); });
    const size0 = rem(p.size || 1.7), w0 = measure(size0), t0 = w0.reduce((a, b) => a + b, 0) + size0 * 0.6 * (w0.length - 1);
    const size = size0 * clamp(safeW() / t0, 0.65, 1), ws = measure(size);   // shrink to one row before stacking
    const gapX = size * 0.6, total = ws.reduce((a, b) => a + b, 0) + gapX * (ws.length - 1), h = size * 2.6;
    const stack = total > safeW(); // too wide → stack vertically
    const y0 = zoneY(p, stack ? items.length * (h + gapX) : h);
    let x = cx() - (stack ? 0 : total / 2);
    items.forEach((it, i) => {
      const lt = t - i * stagger, e = env(lt, p.dur - i * stagger, 'snappy'), w = ws[i];
      const xx = stack ? cx() - w / 2 : DIR === 'rtl' ? 2 * cx() - x - w : x, yy = stack ? y0 + i * (h + gapX) : y0;
      withEnv({ ...e, y: e.y * 0.6 }, () => {
        B.rrect(G, xx, yy, w, h, B.radius.pill()); G.fillStyle = it.pick ? B.C.primary : 'rgba(26,26,26,0.94)'; G.fill();
        G.lineWidth = Math.max(1, R / 16); G.strokeStyle = it.pick ? B.C.primary : B.F.theme.border; G.stroke();
        const hasIcon = it.icon && icon(it.icon, xx + size * 0.8, yy + h / 2 - size * 0.7, size * 1.4, p.iconColor || (it.pick ? B.C.white : undefined));
        fontFor(it.label, 700, size); G.fillStyle = B.F.theme.text; G.textAlign = 'left'; G.direction = 'ltr'; G.textBaseline = 'middle';
        G.fillText(it.label, xx + size * (hasIcon ? 2.6 : 1), yy + h / 2 + size * 0.04);
      });
      x += w + gapX;
    });
    return items.map((_, i) => ({ t: i * stagger, type: 'pop', gain: 0.45 }));
  };

  // Versus: two panels, "vs" between, optional points under each, `pick` gets the accent border at pickAt.
  // at: [aT, bT] when each side enters (relative) · a.pointsAt / b.pointsAt: [t…] per point (relative).
  C.versus = (t, p) => {
    const size = rem(p.size || 2), gapX = rem(3.2), w = (safeW() - gapX) / 2;
    const pts = Math.max((p.a.points || []).length, (p.b.points || []).length);
    const ps = p.pointSize ?? 0.78; // point labels under each side, as a fraction of size
    const h = size * 4.4 + pts * size * (ps + 0.42), y = zoneY(p, h);
    const sides = DIR === 'rtl' ? [p.a, p.b] : [p.a, p.b];
    const at = p.at || [0, 0.15];
    sides.forEach((s, i) => {
      const lt = t - at[i], e = env(lt, p.dur - at[i]); if (lt < 0) return;
      const xs = DIR === 'rtl' ? cx() + gapX / 2 + (i ? -(w + gapX) : 0) : cx() - safeW() / 2 + i * (w + gapX);
      const picked = p.pick === (i ? 'b' : 'a') && t > (p.pickAt ?? 1.2);
      withEnv(e, () => {
        B.panel(G, xs, y, w, h, { variant: picked ? 'feature' : 'default' });
        const hasIcon = s.icon && icon(s.icon, xs + w / 2 - size * 0.9, y + size * 0.7, size * 1.8, p.iconColor);
        fit(s.label, 700, size, w - size * 0.8); G.fillStyle = B.F.theme.text; G.textAlign = 'center'; G.direction = isAr(s.label) ? 'rtl' : 'ltr';
        G.fillText(s.label, xs + w / 2, y + size * (hasIcon ? 3.6 : 2.4));
        (s.points || []).forEach((pt, k) => {
          const pt0 = s.pointsAt ? s.pointsAt[k] : at[i] + 0.5 + k * 0.45;
          fontFor(pt, 600, size * ps); G.fillStyle = B.F.theme.muted; G.globalAlpha *= clamp((t - pt0) * 5);
          G.direction = isAr(pt) ? 'rtl' : 'ltr'; G.fillText(pt, xs + w / 2, y + size * (4.6 + ps * 0.3 + k * (ps + 0.42))); G.globalAlpha = e.a;
        });
      });
    });
    const ev = env(t - at[1] - 0.1, p.dur - at[1] - 0.1, 'snappy');
    withEnv(ev, () => { G.font = `600 ${Math.round(size * 0.75)}px ${B.FONTS.mono}`; G.fillStyle = B.C.accent; G.textAlign = 'center'; G.direction = 'ltr'; G.textBaseline = 'middle'; G.fillText('vs', cx(), y + h / 2); });
    return [{ t: at[0], type: 'whoosh', gain: 0.4 }, { t: at[1], type: 'pop', gain: 0.45 }, ...(p.pick ? [{ t: p.pickAt ?? 1.2, type: 'ding', gain: 0.35 }] : [])];
  };

  // Stat: a big number that counts up, label under it, optional source.
  C.stat = (t, p) => {
    const e = env(t, p.dur, 'heavy'), size = rem(p.size || 5.2), h = size * 1.9, y = zoneY(p, h);
    const m = String(p.value).match(/^([^\d]*)([\d.,]+)(.*)$/);
    let v = p.value;
    if (m && p.count !== false) { const n = parseFloat(m[2].replace(/,/g, '')), d = (m[2].split('.')[1] || '').length; v = m[1] + (n * tween(t, 0.1, 0.9)).toFixed(d) + m[3]; }
    withEnv(e, () => {
      B.panel(G, cx() - safeW() * 0.32, y, safeW() * 0.64, h, { variant: 'feature' });
      G.direction = 'ltr'; G.textAlign = 'center'; G.font = `700 ${Math.round(size)}px ${B.FONTS.sans}`; G.fillStyle = B.F.theme.text; G.textBaseline = 'alphabetic';
      G.fillText(v, cx(), y + size * 1.05);
      if (p.label) { fontFor(p.label, 400, size * 0.27); G.fillStyle = B.F.theme.muted; G.direction = isAr(p.label) ? 'rtl' : 'ltr'; G.fillText(p.label, cx(), y + size * 1.55); }
    });
    return [{ t: 0, type: 'pop', gain: 0.5 }, { t: 0.1, type: 'type', count: 6, cps: 7, gain: 0.3 }];
  };

  // Card: feature panel with a typed title, body lines, optional badge.
  C.card = (t, p) => {
    const e = env(t, p.dur), size = rem(p.size || 1.9), w = safeW();
    const tl = wrap(p.title, size, w - size * 1.6), bl = p.body ? wrap(p.body, size * 0.72, w - size * 1.6, 400) : [];
    const h = size * 1.2 + tl.length * size * 1.25 + bl.length * size * 0.95 + (p.badge ? size * 1.3 : 0) + size * 0.4, y = zoneY(p, h);
    withEnv(e, () => {
      B.panel(G, cx() - w / 2, y, w, h, { variant: 'feature' });
      const rtl = DIR === 'rtl', xs = rtl ? cx() + w / 2 - size * 0.8 : cx() - w / 2 + size * 0.8;
      let yy = y + size * 0.6;
      if (p.badge) { B.badge(G, p.badge, xs, yy, { variant: 'tag', size: size * 0.42 }); yy += size * 1.3; }
      let tt = t - 0.15;
      tl.forEach((ln, i) => { const d = [...ln].length / (p.cps || 24); yy += size * 1.1; typedLine(ln, tt, xs, yy, size, { align: 'start', cps: p.cps || 24, caret: tt < d || i === tl.length - 1 }); tt -= d; yy += size * 0.15; });
      bl.forEach((ln, i) => { yy += size * 0.95; fontFor(ln, 400, size * 0.72); G.fillStyle = B.F.theme.muted; G.globalAlpha *= clamp((tt - i * 0.12) * 5); startText(ln, xs, yy); G.globalAlpha = e.a; });
    });
    return [{ t: 0, type: 'pop', gain: 0.4 }, { t: 0.15, type: 'type', text: p.title, cps: p.cps || 24, gain: 0.4 }];
  };

  // List: items appear one by one (every s, or explicit at: [t…] relative to the graphic).
  // The panel grows a row as each item lands (no empty rows waiting); its top is placed for the full height.
  C.list = (t, p) => {
    const e = env(t, p.dur), size = rem(p.size || 1.8), w = safeW(), n = p.items.length;
    const head = p.title ? size * 1.9 : size * 0.5, row = size * 1.55, pad = size * 0.5;
    const ats = p.items.map((_, i) => (p.at ? p.at[i] : 0.3 + i * (p.every || 0.6)));
    const y = zoneY(p, head + n * row + pad);
    const grown = ats.reduce((a, at) => a + sp(t - at + 0.08, 'snappy'), 0);
    const h = head + Math.max(p.title ? 0 : 1, grown) * row + pad;
    const rtl = DIR === 'rtl', xs = rtl ? cx() + w / 2 - size : cx() - w / 2 + size;
    withEnv(e, () => {
      B.panel(G, cx() - w / 2, y, w, h, { variant: 'default' });
      let yy = y + size * 0.4;
      if (p.title) { yy += size * 1.15; fontFor(p.title, 700, size * 1.1); G.fillStyle = B.F.theme.primaryText; startText(p.title, xs, yy); yy += size * 0.2; }
      p.items.forEach((it, i) => {
        const at = ats[i], k = sp(t - at, 'snappy');
        yy += size * 1.55; if (t < at) return;
        G.save(); G.globalAlpha *= clamp((t - at) * 6); G.translate((rtl ? -1 : 1) * (1 - k) * rem(1), 0);
        G.fillStyle = B.C.primary; G.fillRect(rtl ? xs - size * 0.55 : xs, yy - size * 0.62, size * 0.55, size * 0.55);
        fontFor(it, 600, size); G.fillStyle = B.F.theme.text;
        startText(it, rtl ? xs - size * 1.0 : xs + size * 1.0, yy); G.restore();
      });
    });
    return p.items.map((_, i) => ({ t: p.at ? p.at[i] : 0.3 + i * (p.every || 0.6), type: 'click', gain: 0.45 }));
  };

  // Retype: a tag or word that backspaces into another (#الكورة → #التكنولوجيا). Strike on the old one first.
  C.retype = (t, p) => {
    const e = env(t, p.dur, 'heavy'), size = rem(p.size || 2.6), y = zoneY(p, size * 2) + size * 1.35;
    const hold = p.hold ?? 0.9, rt = retype(p.from, p.to, Math.max(0, t - hold), 16, 22);
    withEnv(e, () => {
      fontFor(p.from + p.to, 700, size); G.direction = isAr(p.from + p.to) ? 'rtl' : 'ltr'; G.textAlign = 'center';
      const bw = Math.max(G.measureText(p.from).width, G.measureText(p.to).width) + size * 1.4;
      B.rrect(G, cx() - bw / 2, y - size * 1.05, bw, size * 1.45, B.radius.md()); G.fillStyle = 'rgba(26,26,26,0.94)'; G.fill();
      G.lineWidth = Math.max(1, R / 16); G.strokeStyle = B.F.theme.border; G.stroke();
      G.fillStyle = t < hold ? B.F.theme.text : B.F.theme.primaryText; const txt = t < hold ? p.from : rt.text;
      const w = G.measureText(txt).width; G.fillText(txt, cx(), y);
      if (t < hold) { const s = tween(t, 0.25, 0.35); G.fillStyle = B.C.accent; const sw = w * s; G.fillRect(G.direction === 'rtl' ? cx() + w / 2 - sw : cx() - w / 2, y - size * 0.33, sw, size * 0.09); }
      if (caretOn(t, rt.typing)) { G.fillStyle = B.C.accent; const rtl = G.direction === 'rtl'; G.fillRect(rtl ? cx() - w / 2 - size * 0.16 : cx() + w / 2 + size * 0.08, y - size * 0.8, size * 0.08, size * 0.95); }
    });
    const del = [...p.from].length;
    return [{ t: 0.25, type: 'click', gain: 0.4 }, { t: hold, type: 'type', count: del, cps: 22, gain: 0.35 }, { t: hold + del / 22, type: 'type', text: p.to, cps: 16, gain: 0.45 }];
  };

  // ASCII emoji reaction (^_^ x_x o_o >‿<; avoid -_-, it reads as loose dashes): mono, accent, springs in without overshoot.
  C.emoji = (t, p) => {
    const e = env(t, p.dur, 'snappy'), size = rem(p.size || 3.4), y = zoneY({ zone: 'top', ...p }, size) + size;
    const x = p.x != null ? p.x * W : cx();
    withEnv(e, () => { G.font = `600 ${Math.round(size * (0.85 + 0.15 * e.k))}px ${B.FONTS.mono}`; G.fillStyle = p.color === 'green' ? B.F.theme.primaryText : B.C.accent; G.textAlign = 'center'; G.direction = 'ltr'; G.fillText(p.text || '^_^', x, y); });
    return [{ t: 0, type: 'pop', gain: 0.5 }];
  };

  // Nino reacting in a corner. corner: 'start' | 'end' (logical), expression per brand.md.
  C.nino = (t, p) => {
    const size = rem(p.size || 6), k = sp(t, 'playful'), o = tween(t, p.dur - 0.25, 0.25);
    const end = (p.corner || 'end') === 'end', rtl = DIR === 'rtl', right = end !== rtl;
    const x = right ? W * (PORTRAIT ? 0.78 : 0.86) - size : W * 0.08, y = zoneY({ zone: 'low', ...p }, size) + (1 - k) * rem(5) + o * rem(5);
    G.save(); G.globalAlpha *= 1 - o; B.nino(G, x, y, size, { expression: p.expression || 'happy', t, look: p.look || (right ? 'start' : 'end') }); G.restore();
    return [{ t: 0, type: 'pop', gain: 0.4 }];
  };

  // Image: b-roll still. fit 'card' (rounded, in a zone) or 'full' (covers the frame).
  C.image = (t, p) => {
    const img = IMAGES[p.src]; if (!img || !img.width) return [];
    const e = env(t, p.dur, p.fit === 'full' ? 'heavy' : 'default');
    if (p.fit === 'full') {
      const s = Math.max(W / img.width, H / img.height) * (1 + 0.04 * clamp(t / p.dur)), iw = img.width * s, ih = img.height * s;
      G.save(); G.globalAlpha *= e.a; G.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih); G.restore();
    } else {
      const w = safeW() * (p.scale || 1), ih = w * (img.height / img.width), h = Math.min(ih, H * 0.36), y = zoneY(p, h);
      withEnv(e, () => {
        G.save(); B.rrect(G, cx() - w / 2, y, w, h, B.radius.lg()); G.clip();
        const s = Math.max(w / img.width, h / img.height); G.drawImage(img, cx() - (img.width * s) / 2, y + h / 2 - (img.height * s) / 2, img.width * s, img.height * s); G.restore();
        B.rrect(G, cx() - w / 2, y, w, h, B.radius.lg()); G.lineWidth = Math.max(1, R / 16); G.strokeStyle = B.F.theme.border; G.stroke();
        if (p.caption) { fontFor(p.caption, 600, rem(1)); G.fillStyle = B.F.theme.text; G.textAlign = 'center'; G.direction = isAr(p.caption) ? 'rtl' : 'ltr'; G.fillText(p.caption, cx(), y + h + rem(1.6)); }
      });
    }
    return [{ t: 0, type: 'whoosh', gain: 0.35 }];
  };

  // Code: mono panel, typed line by line.
  C.code = (t, p) => {
    const e = env(t, p.dur), size = rem(p.size || 1.3), lines = p.code.split('\n'), w = safeW();
    const h = size * 2.6 + lines.length * size * 1.5, y = zoneY(p, h), xs = cx() - w / 2 + size * 1.2;
    withEnv(e, () => {
      B.panel(G, cx() - w / 2, y, w, h, { variant: 'default' });
      [B.C.accent, B.F.theme.border, B.F.theme.border].forEach((c, i) => { G.fillStyle = c; G.beginPath(); G.arc(xs + i * size * 0.9 + size * 0.3, y + size * 0.95, size * 0.28, 0, 7); G.fill(); });
      if (p.title) { G.font = `400 ${Math.round(size * 0.8)}px ${B.FONTS.mono}`; G.fillStyle = B.F.theme.muted; G.textAlign = 'right'; G.direction = 'ltr'; G.fillText(p.title, cx() + w / 2 - size, y + size * 1.2); }
      let tt = t - 0.2;
      lines.forEach((ln, i) => {
        G.font = `400 ${Math.round(size)}px ${B.FONTS.mono}`; G.fillStyle = B.F.theme.text; G.textAlign = 'left'; G.direction = 'ltr';
        const s = typed(ln, tt, p.cps || 30); G.fillText(s, xs, y + size * 2.6 + i * size * 1.5);
        if (s.length < ln.length && tt > 0) { G.fillStyle = B.C.accent; G.fillRect(xs + G.measureText(s).width + 2, y + size * 1.7 + i * size * 1.5, size * 0.1, size * 1.1); }
        tt -= ln.length / (p.cps || 30);
      });
    });
    return [{ t: 0.2, type: 'type', text: p.code.replace(/\s+/g, ''), cps: p.cps || 30, gain: 0.3 }];
  };

  // Quote: one big serif line on a dimmed frame.
  C.quote = (t, p) => {
    const e = env(t, p.dur, 'heavy'), size = rem(p.size || 2.6), lines = wrap(p.text, size, safeW(), 400, 'serif');
    const h = lines.length * size * 1.35, y = zoneY({ zone: 'center', ...p }, h);
    withEnv(e, () => { let tt = t; lines.forEach((ln, i) => { const d = [...ln].length / 22; typedLine(ln, tt, cx(), y + (i + 0.8) * size * 1.35, size, { weight: 400, family: 'serif', cps: 22, caret: tt < d || i === lines.length - 1 }); tt -= d; }); });
    return [{ t: 0, type: 'type', text: p.text, cps: 22, gain: 0.4 }];
  };

  // Band: the green band as a climax — full-bleed #166434 wipe, white text. Keep ≤ 1.2 s.
  C.band = (t, p) => {
    const wipe = sp(t, 'heavy'), out = tween(t, p.dur - 0.2, 0.2);
    const size = fit(p.text, 700, rem(p.size || 3.4), W * 0.86); // long lines shrink to fit
    const by = (p.y ?? (PORTRAIT ? 0.6 : 0.5)) * H, bh = Math.max(size * 2.2, H * (p.height ?? (PORTRAIT ? 0.15 : 0.24)));
    G.save(); G.fillStyle = B.C.primary; const hh = bh * wipe * (1 - out); G.fillRect(0, by - hh / 2, W, hh);
    G.globalAlpha *= clamp((t - 0.12) * 6) * (1 - out); fit(p.text, 700, size, W * 0.86); G.fillStyle = B.C.white; G.textAlign = 'center'; G.direction = isAr(p.text) ? 'rtl' : 'ltr';
    G.textBaseline = 'middle'; G.fillText(p.text, W / 2, by); G.restore();
    return [{ t: 0, type: 'thump', gain: 0.6 }];
  };

  // Lower third (landscape long-form): name + title, from the logical start edge.
  C.lowerThird = (t, p) => {
    const e = env(t, p.dur, 'snappy'), size = rem(p.size || 1.4), rtl = DIR === 'rtl';
    fontFor(p.name, 700, size); const w = Math.max(G.measureText(p.name).width, G.measureText(p.title || '').width * 0.7) + size * 2;
    const x = rtl ? W * 0.94 - w : W * 0.06, y = H * (PORTRAIT ? 0.6 : 0.74), h = size * 3.2;
    withEnv({ ...e, y: 0 }, () => {
      G.save(); B.rrect(G, x, y, w * e.k, h, B.radius.md()); G.fillStyle = 'rgba(26,26,26,0.94)'; G.fill(); G.restore();
      G.fillStyle = B.C.accent; G.fillRect(rtl ? x + w - size * 0.2 : x, y, size * 0.2, h);
      const xs = rtl ? x + w - size : x + size;
      fontFor(p.name, 700, size); G.fillStyle = B.F.theme.text; G.textAlign = 'start'; G.direction = rtl ? 'rtl' : 'ltr'; G.fillText(p.name, xs, y + size * 1.35);
      if (p.title) { fontFor(p.title, 400, size * 0.7); G.fillStyle = B.F.theme.muted; G.fillText(p.title, xs, y + size * 2.5); }
    });
    return [{ t: 0, type: 'whoosh', gain: 0.3 }];
  };

  // End card: green band rises, Nino lands, handle typed, wordmark retypes to the bare 9k.
  C.endcard = (t, p) => {
    const wipe = sp(t, 'heavy'), size = rem(PORTRAIT ? 5.5 : 4.5);
    G.save(); G.fillStyle = B.C.primary; G.fillRect(0, H * (1 - wipe), W, H * wipe); G.restore();
    if (t < 0.3) return [{ t: 0, type: 'whoosh', gain: 0.5 }];
    B.frame(G, W, H, { theme: 'green', dir: DIR });
    B.nino(G, W / 2 - size / 2, H * 0.3 + (1 - sp(t - 0.3, 'playful')) * rem(5), size, { expression: t > 1.2 ? 'happy' : 'idle', t, colors: { body: B.C.white } });
    B.wordmark(G, t - 0.6, W / 2, H * 0.3 + size + rem(3.2), { size: rem(2.6), align: 'center', color: B.C.white, hold: 0.6 });
    if (p.cta) { G.globalAlpha = clamp((t - 1.6) * 4); fit(p.cta, 700, rem(2.2), W * 0.84); G.fillStyle = B.C.white; G.textAlign = 'center'; G.direction = isAr(p.cta) ? 'rtl' : 'ltr'; G.fillText(p.cta, W / 2, H * 0.3 + size + rem(6.5)); }
    if (p.handle) { G.globalAlpha = 1; typedLine(p.handle, t - 2, W / 2, H * 0.3 + size + rem(9), rem(1.3), { family: 'mono', weight: 400, color: 'rgba(255,255,255,0.8)', caret: false }); }
    B.frame(G, W, H, { theme: 'dark', dir: DIR });
    return [{ t: 0, type: 'whoosh', gain: 0.5 }, { t: 0.3, type: 'thump', gain: 0.5 }, { t: 0.6, type: 'type', text: 'Ismail9k', cps: 14, gain: 0.45 }, { t: 1.6, type: 'ding', gain: 0.3 }];
  };

  // Mask: an opaque rounded rect, e.g. to hide burned-in text (rect: [x, y, w, h] as fractions of W/H).
  C.mask = (t, p) => {
    const [x, y, w, h] = p.rect; G.save(); G.fillStyle = p.color || B.F.theme.bg;
    B.rrect(G, x * W, y * H, w * W, h * H, B.radius.md()); G.fill(); G.restore(); return [];
  };

  // ---- entry points -----------------------------------------------------------------
  function init(ctx, data) {
    G = ctx; W = data.format.w; H = data.format.h; DIR = data.dir || 'ltr'; PORTRAIT = H > W;
    CAP_TOP = (data.captionStyle?.y ?? (PORTRAIT ? 0.72 : 0.84)) - (PORTRAIT ? 0.065 : 0.07);
    R = Math.min(W, H) / 1080 * 32; ICONS = data.icons || {};
    const imgs = [...new Set((data.graphics || []).filter((x) => x.src).map((x) => x.src))];
    return Promise.all(imgs.map((src) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => ok(); im.src = (data.images || {})[src] || src; IMAGES[src] = im; })));
  }
  // Draw everything active at t. Returns the number of things drawn (0 → transparent frame).
  function draw(t, data) {
    B.frame(G, W, H, { theme: data.theme || 'dark', dir: DIR });
    G.clearRect(0, 0, W, H);
    let n = 0;
    const active = (data.graphics || []).filter((x) => t >= x.t && t < x.t + x.dur && C[x.type]);
    const d = Math.max(0, ...active.map((x) => (x.dim || 0) * Math.min(clamp((t - x.t) * 5), clamp((x.t + x.dur - t) * 5))));
    if (d) { dim(d); n++; }
    const under = active.filter((x) => x.type === 'mask' || (x.type === 'image' && x.fit === 'full'));
    for (const x of under) { C[x.type](t - x.t, x); n++; }
    const capOff = active.some((x) => x.captions === false || ['band', 'endcard', 'quote'].includes(x.type) || (x.type === 'image' && x.fit === 'full'));
    if (!capOff && data.captions) n += captions(t, data.captions, data.captionStyle || {});
    for (const x of active) if (!under.includes(x)) { CX = x.type === 'emoji' ? null : x.x ?? null; SW = x.w ?? null; C[x.type](t - x.t, x); CX = SW = null; n++; }
    return n;
  }
  // SFX cues every component asks for, in output time (render-overlay.mjs writes them to work/cues.auto.json)
  function cues(data) {
    const out = [];
    for (const x of data.graphics || []) {
      if (!C[x.type] || x.sfx === false) continue;
      const res = (G.save(), C[x.type](0.001, { ...x }));
      G.restore(); G.clearRect(0, 0, W, H);
      for (const c of res || []) out.push({ ...c, t: +(x.t + c.t).toFixed(3) });
    }
    return out;
  }
  g.O = { init, draw, cues, captions, C };
})(window);
