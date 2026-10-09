// Motion primitives. Every function is a pure function of time, so seek(t) stays deterministic.
// Classic script (not a module) so index.html works from file:// — exposes window.M.
(function (g) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;

  // Closed-form damped spring, 0 → 1. k = stiffness, d = damping.
  function spring(t, k = 170, d = 26) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k), z = d / (2 * w0);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }

  // 9k presets (see references/brand.md → Motion language)
  const SPRINGS = {
    snappy: [320, 34],   // buttons, toggles, leading edges
    default: [170, 26],  // cards, containers, camera
    heavy: [120, 24],    // big type, logo lockups — no overshoot
    playful: [220, 14],  // Nino only
  };
  const sp = (t, preset = 'default') => spring(t, ...SPRINGS[preset]);

  // A value with many targets: one spring per change, never restarted. keys: [[time, value], ...]
  function track(t, keys, preset = 'default') {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * sp(t - keys[i][0], preset);
    return v;
  }

  // Stretchy indicator: leading edge stiffer than trailing edge
  function indicator(t, stops, width) {
    const lead = track(t, stops, 'snappy'), trail = track(t, stops, 'default');
    return { left: Math.min(lead, trail), right: Math.max(lead, trail) + width };
  }

  // Text inside a morphing container: in after the morph starts, out before the next one
  const swapAlpha = (t, tIn, tOut) => Math.min(clamp((t - tIn - 0.08) / 0.12), clamp((tOut - 0.1 - t) / 0.1));

  // CSS cubic-bezier, solved by Newton iteration. ease9k = the design system's standard UI curve.
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (s) => ((ax * s + bx) * s + cx) * s, sy = (s) => ((ay * s + by) * s + cy) * s;
    return (x) => {
      x = clamp(x); let s = x;
      for (let i = 0; i < 8; i++) { const dx = (3 * ax * s + 2 * bx) * s + cx; if (Math.abs(dx) < 1e-6) break; s -= (sx(s) - x) / dx; }
      return sy(clamp(s));
    };
  }
  const ease9k = bezier(0.4, 0, 0.2, 1);
  const easeCss = bezier(0.25, 0.1, 0.25, 1); // CSS `ease`, used for 160 ms colour changes
  const tween = (t, start, dur, fn = ease9k) => fn(clamp((t - start) / dur));

  // Seeded PRNG (mulberry32). Never Math.random.
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Typewriter: characters of `text` visible at time t (starts at t=0), cps = chars per second
  const typed = (text, t, cps = 16) => [...text].slice(0, clamp(Math.floor(t * cps), 0, [...text].length)).join('');

  // Retype: backspace `from` to the common prefix, then type `to`. Returns { text, typing }.
  function retype(from, to, t, cps = 16, delCps = 24) {
    const a = [...from], b = [...to];
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    const delDur = (a.length - p) / delCps;
    if (t < delDur) return { text: a.slice(0, a.length - Math.floor(t * delCps)).join(''), typing: true };
    const n = Math.min(b.length - p, Math.floor((t - delDur) * cps));
    return { text: b.slice(0, p + n).join(''), typing: p + n < b.length };
  }

  // Caret blink: on/off at 1.06 s period, solid while typing
  const caretOn = (t, typing) => typing || (t % 1.06) < 0.53;

  const loopT = (t, dur) => ((t % dur) + dur) % dur;

  g.M = { clamp, lerp, spring, SPRINGS, sp, track, indicator, swapAlpha, bezier, ease9k, easeCss, tween, rng, typed, retype, caretOn, loopT };
})(window);
