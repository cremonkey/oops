// Virtual camera over the cut footage: zoom + focus point as pure functions of output time.
// The same events drive compose.mjs (as ffmpeg expressions) and the stills (as JS numbers).
//
// edit.json → camera: {
//   auto: true,            // jump cuts alternate base ↔ punch framing, so every cut reads as a new angle
//   base: 1.0, punch: 1.12,
//   focus: [0.5, 0.32],    // point of the footage (fractions) kept centred when zoomed — usually between the eyes
//   keys: [{ t: 17.2, z: 1.3, ease: "snap" }, { t: 18.6, z: 1, ease: "cut" }, { t: 40, z: 1.08, ease: "push", dur: 3 }]
// }   ease: cut (hard, on a jump cut) · snap (fast spring punch on a word) · push (slow smooth drift, dur s)
const SNAP_W = 16; // critically damped spring rate for 'snap' (≈0.3 s to settle)

export function events(cam = {}, cuts = []) {
  const c = { auto: true, base: 1, punch: 1.12, focus: [0.5, 0.35], keys: [], ...cam };
  const ev = [];
  if (c.auto) cuts.forEach((t, i) => ev.push({ t, z: i % 2 ? c.base : c.punch, ease: 'cut', auto: true }));
  for (const k of c.keys) ev.push({ ease: 'snap', dur: 0.4, ...k });
  ev.sort((a, b) => a.t - b.t || (a.auto ? -1 : 1));
  // A manual key on (or right after) a cut wins over the auto toggle; after a manual key, the toggle resumes from it.
  const out = []; let z = c.base, f = c.focus;
  for (const e of ev) {
    if (e.auto && out.length && !out.at(-1).auto && e.t - out.at(-1).t < 0.05) continue;
    if (e.auto) e.z = Math.abs(z - c.base) < 1e-3 ? c.punch : c.base;
    out.push({ t: e.t, z0: z, z: e.z ?? z, f0: f, f: e.focus || f, ease: e.ease, dur: e.dur || 0.4, auto: !!e.auto });
    z = e.z ?? z; f = e.focus || f;
  }
  return { start: { z: c.base, f: c.focus }, ev: out };
}

// Shape functions, 0 → 1 over x ≥ 0
const shape = {
  cut: (x) => (x >= 0 ? 1 : 0),
  snap: (x) => (x <= 0 ? 0 : 1 - Math.exp(-SNAP_W * x) * (1 + SNAP_W * x)),
  push: (x, d) => { const u = Math.min(1, Math.max(0, x / d)); return u * u * (3 - 2 * u); },
};
export function at(cam, t) {
  let z = cam.start.z, fx = cam.start.f[0], fy = cam.start.f[1];
  for (const e of cam.ev) { const s = shape[e.ease](t - e.t, e.dur); z += (e.z - e.z0) * s; fx += (e.f[0] - e.f0[0]) * s; fy += (e.f[1] - e.f0[1]) * s; }
  return { z, fx, fy };
}

// ffmpeg expression versions (t = output time)
const n = (v) => (+v).toFixed(4);
function shapeExpr(e) {
  const x = `(t-${n(e.t)})`;
  if (e.ease === 'cut') return `gte(t,${n(e.t)})`;
  if (e.ease === 'snap') return `if(gt(${x},0),1-exp(-${SNAP_W}*${x})*(1+${SNAP_W}*${x}),0)`;
  const u = `clip(${x}/${n(e.dur)},0,1)`;
  return `(${u}*${u}*(3-2*${u}))`;
}
export function expr(cam) {
  const sum = (key, i) => cam.ev.filter((e) => Math.abs(key(e, 1) - key(e, 0)) > 1e-4).map((e) => `${n(key(e, 1) - key(e, 0))}*${shapeExpr(e)}`).join('+') || '0';
  return {
    z: `(${n(cam.start.z)}+${sum((e, k) => (k ? e.z : e.z0))})`,
    fx: `(${n(cam.start.f[0])}+${sum((e, k) => (k ? e.f[0] : e.f0[0]))})`,
    fy: `(${n(cam.start.f[1])}+${sum((e, k) => (k ? e.f[1] : e.f0[1]))})`,
    smooth: cam.ev.some((e) => e.ease === 'push'),
  };
}

// The ffmpeg filter chain that turns the cut footage (cw×ch) into the camera's W×H view.
// ss = supersample factor: push-ins at 2× hide the 2-px steps of per-frame even-size rounding.
export function cameraFilter(cam, cw, ch, W, H, ss = expr(cam).smooth ? 2 : 1) {
  const e = expr(cam), s0 = Math.max(W / cw, H / ch) * ss, OW = W * ss, OH = H * ss;
  // ceil + max(1, z): a spring that stops at 0.99999 must never shrink the frame below the crop size
  const Z = `max(1,${e.z})`;
  return `scale=w='max(${OW},2*ceil(${n(cw * s0)}*${Z}/2))':h='max(${OH},2*ceil(${n(ch * s0)}*${Z}/2))':eval=frame:flags=bicubic,` +
    `crop=${OW}:${OH}:x='max(0,min(iw-${OW},${e.fx}*iw-${OW / 2}))':y='max(0,min(ih-${OH},${e.fy}*ih-${OH / 2}))'` +
    (ss > 1 ? `,scale=${W}:${H}:flags=lanczos` : '');
}
// Same thing for one still at time t (numbers, not expressions)
export function cameraFilterAt(cam, t, cw, ch, W, H) {
  const { fx, fy } = at(cam, t), z = Math.max(1, at(cam, t).z), s0 = Math.max(W / cw, H / ch);
  const sw = Math.max(W, 2 * Math.ceil((cw * s0 * z) / 2)), sh = Math.max(H, 2 * Math.ceil((ch * s0 * z) / 2));
  const x = Math.max(0, Math.min(sw - W, fx * sw - W / 2)), y = Math.max(0, Math.min(sh - H, fy * sh - H / 2));
  return `scale=${sw}:${sh}:flags=bicubic,crop=${W}:${H}:${Math.round(x)}:${Math.round(y)}`;
}
