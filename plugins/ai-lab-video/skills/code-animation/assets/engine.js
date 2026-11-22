/* code-animation engine — hand-drawn-looking 2D animation on <canvas>, no image models.
 * Everything hangs off the global `E`. A scene file defines {W,H,dur,build(E),render(g,t,L,E)} and calls E.run(scene).
 * Coordinates: canvas pixels, y down. Light comes from E.light (unit-ish vector pointing TOWARD the light).
 */
'use strict';
const E = (() => {
  const E = {};
  // ───────────── math / colour / randomness
  E.rng = seed => { let a = seed | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  E.noise = seed => { const r = E.rng(seed), v = Array.from({ length: 1024 }, () => r()); return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 1023] * (1 - u) + v[(i + 1) & 1023] * u; }; };
  E.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  E.lerp = (a, b, u) => a + (b - a) * u;
  E.sstep = (a, b, x) => { const u = E.clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  E.ease = {
    lin: u => u, in: u => u * u * u, out: u => 1 - Math.pow(1 - u, 3),
    io: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
    back: u => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }, // overshoot settle
    hold: u => 0,
  };
  E.hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  E.mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  E.rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  E.jit = (c, r, amt) => c.map(v => Math.max(0, Math.min(255, v + (r() - .5) * 2 * amt)));
  E.gradF = stops => { const s = stops.map(([p, h]) => [p, E.hex(h)]); return p => { if (p <= s[0][0]) return s[0][1]; for (let i = 1; i < s.length; i++) if (p <= s[i][0]) return E.mix(s[i - 1][1], s[i][1], (p - s[i - 1][0]) / (s[i][0] - s[i - 1][0])); return s[s.length - 1][1]; }; };

  // ───────────── timing
  E.twos = (t, fps = 12) => Math.floor(t * fps) / fps;            // characters animate on twos (12 drawings/s)
  /** keyframes: [[t, value, easeIntoThisKey?], ...]; value = number | array (nested ok). Holds before first / after last. */
  E.key = (t, ks) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const [t0, v0] = ks[i - 1], [t1, v1, e = 'io'] = ks[i]; return E.blend(v0, v1, E.ease[e]((t - t0) / (t1 - t0))); }
    return ks[ks.length - 1][1];
  };
  E.blend = (a, b, u) => Array.isArray(a) ? a.map((v, i) => E.blend(v, b[i], u)) : a + (b - a) * u;
  /** step function for flickers: [[t, v], ...] → value of last key passed */
  E.steps = (t, ks, before = 0) => { let v = before; for (const [k, x] of ks) if (t >= k) v = x; return v; };
  /** camera shake: segments [[t0, t1, amp]], quantised on twos, deterministic */
  E.shake = (t, segs) => { let a = 0; for (const [t0, t1, amp] of segs) if (t >= t0 && t <= t1) a = Math.max(a, amp * E.sstep(t0, t0 + .12, t) * (1 - E.sstep(t1 - (t1 - t0) * .5, t1, t))); if (!a) return [0, 0]; const r = E.rng(Math.floor(t * 12) * 7 + 1); return [(r() - .5) * 2 * a, (r() - .5) * 2 * a]; };

  // ───────────── canvases
  E.mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ───────────── painterly marks
  E.blob = (g, x, y, rx, ry, rot, col, r, n = 7) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = .75 + r() * .45, px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k; const X = x + px * Math.cos(rot) - py * Math.sin(rot), Y = y + px * Math.sin(rot) + py * Math.cos(rot); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.fillStyle = col; g.fill(); };
  /** scalloped leaf mass (union of circles) — use instead of single blobs for foliage/clouds/smoke */
  E.clump = (g, cx, cy, rd, col, r, k = 9) => { g.beginPath(); for (let i = 0; i < k; i++) { const a = r() * 6.283, d = rd * (.15 + r() * .5), s = rd * (.32 + r() * .3); g.moveTo(cx + Math.cos(a) * d + s, cy + Math.sin(a) * d * .8); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .8, s, 0, 7); } g.fillStyle = col; g.fill(); };
  /** scatter gouache/watercolour dabs over a region with colour from colorAt(x,y) */
  E.dabs = (g, n, region, colorAt, r, o = {}) => { const [x0, y0, x1, y1] = region; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); E.blob(g, x, y, (o.min ?? 8) + r() * (o.len ?? 36), (o.thin ?? 2.5) + r() * (o.wid ?? 7), (o.angle ?? 0) + (r() - .5) * (o.spread ?? .22), E.rgba(E.jit(colorAt(x, y), r, o.jit ?? 10), o.alpha ?? .2), r); } };

  // ───────────── lines
  E.chaikin = (p, it, closed = true) => { for (let k = 0; k < it; k++) { const q = [], n = p.length, m = closed ? n : n - 1; for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % n]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } if (!closed) { q.unshift(p[0]); q.push(p[n - 1]); } p = q; } return p; };
  E.resample = (p, step, closed = true) => { const pts = closed ? [...p, p[0]] : p, out = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; let d = Math.hypot(bx - ax, by - ay); while (acc + d >= step) { const u = (step - acc) / d; ax += (bx - ax) * u; ay += (by - ay) * u; out.push([ax, ay]); d = Math.hypot(bx - ax, by - ay); acc = 0; } acc += d; } if (!closed) out.push(pts[pts.length - 1]); return out; };
  /** line boil: tiny low-frequency wobble that changes per drawing (variant). Use 0 on holds. */
  E.boil = (p, variant, amp, seed) => { if (!amp) return p; const n1 = E.noise(seed * 7 + variant * 131), n2 = E.noise(seed * 13 + variant * 977 + 5); return p.map(([x, y], i) => [x + (n1(i / 9) - .5) * 2 * amp, y + (n2(i / 9) - .5) * 2 * amp]); };
  E.path = (p, closed = true) => { const P = new Path2D(); p.forEach(([x, y], i) => i ? P.lineTo(x, y) : P.moveTo(x, y)); if (closed) P.closePath(); return P; };
  E.light = [1, -.45];       // toward the light (right / up by default)
  E.INK = '#2a201c';
  /** hand-inked variable-width stroke; thicker on the side facing away from the light; open lines taper */
  E.ink = (g, p, w, closed, seed, col = E.INK) => {
    const n = E.noise(seed), N = p.length, [lx, ly] = E.light; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col;
    for (let i = 0; i < N - (closed ? 0 : 1); i++) {
      const a = p[i], b = p[(i + 1) % N]; let k = .55 + .75 * n(i / 6);
      const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny) || 1;
      k *= 1 + .35 * E.clamp(-(nx / L) * lx * .8 - (ny / L) * ly);
      if (!closed) k *= Math.pow(Math.sin(Math.PI * E.clamp(i / (N - 1))), .5) + .08;
      g.lineWidth = w * k; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  };
  /** open stroke helper: smooth a few control points and ink them */
  E.stroke = (g, pts, w, seed, col, o = {}) => { let q = E.resample(E.chaikin(pts, o.round ?? 2, false), o.step ?? 4, false); q = E.boil(q, o.v || 0, o.boil || 0, seed); E.ink(g, q, w, false, seed, col); return q; };

  /** cel-shaded, inked shape.
   * pal = {base, sh, hi}; o: round (0 sharp … 2 soft; mecha 1, organic 2-3), d shadow depth px, h rim highlight px,
   * lw line width, lines [[pts]...] interior lines, rivets [[x,y]], v drawing variant, boil px, seed,
   * texture(g, r, bbox) extra painting clipped inside, weather {rust, grime, chips} for worn surfaces. Returns Path2D. */
  E.part = (g, pts, pal, o = {}) => {
    const seed = o.seed || 1, v = o.v || 0, [lx, ly] = E.light;
    let p = E.resample(E.chaikin(pts, o.round ?? 2), 5); p = E.boil(p, v, o.boil ?? 0, seed);
    const P = E.path(p), d = o.d ?? 26, h = o.h ?? 7;
    g.fillStyle = pal.sh; g.fill(P);
    g.save(); g.clip(P);
    g.save(); g.translate(lx * d, ly * d); g.fillStyle = pal.hi || pal.base; g.fill(P); g.clip(P);
    g.translate(-lx * d - lx * h, -ly * d - ly * h); g.fillStyle = pal.base; g.fill(P); g.restore();
    const r = E.rng(seed * 31 + 3), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (o.weather) E.weather(g, bb, r, o.weather);
    if (o.texture) o.texture(g, r, bb);
    g.restore();
    if (o.lw !== 0) E.ink(g, p, o.lw ?? 4.2, true, seed + v * 17, o.lineCol);
    (o.lines || []).forEach((L, i) => { let q = E.resample(E.chaikin(L, 1, false), 5, false); q = E.boil(q, v, o.boil ?? 0, seed + i + 50); E.ink(g, q, o.ilw ?? 2.1, false, seed + i * 9 + v, o.lineCol); });
    (o.rivets || []).forEach(([x, y]) => { g.fillStyle = '#4a4652'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,240,210,.8)'; g.beginPath(); g.arc(x + 1, y - 1, 1.1, 0, 7); g.fill(); });
    return P;
  };
  E.weather = (g, [x0, y0, x1, y1], r, w = {}) => {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, `rgba(60,50,40,${w.grime ?? .22})`); g.fillStyle = gr; g.fillRect(x0 - 40, y0 - 40, x1 - x0 + 80, y1 - y0 + 80);
    const nr = Math.round((w.rust ?? 1) * ((x1 - x0) * (y1 - y0)) / 9000);
    for (let i = 0; i < nr; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 4 + r() * 16; E.blob(g, x, y, s, s * (.5 + r() * .5), r() * 3, 'rgba(150,86,56,.42)', r, 8); E.blob(g, x + 1, y + 1, s * .5, s * .3, r() * 3, 'rgba(102,56,38,.45)', r, 7); if (r() < .7) { g.strokeStyle = 'rgba(120,70,48,.22)'; g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y + 20 + r() * 70); g.stroke(); } }
    for (let i = 0; i < nr * 3 * (w.chips ?? 1); i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); E.blob(g, x, y, 1.5 + r() * 4, 1 + r() * 2.5, r() * 3, r() < .6 ? 'rgba(250,244,226,.85)' : 'rgba(84,82,96,.8)', r, 5); }
  };

  // ───────────── backgrounds (paint once into offscreen canvases)
  /** vertical gradient sky + painterly dabs + optional sun glow. stops: [[0..1, hex]...] over height h */
  E.sky = (W, H, stops, o = {}) => {
    const c = E.mk(W, H), g = c.getContext('2d'), r = E.rng(o.seed ?? 11), sf = E.gradF(stops), h = o.h ?? H * .67;
    for (let y = 0; y < H; y += 2) { g.fillStyle = E.rgba(sf(y / h)); g.fillRect(0, y, W, 2); }
    if (o.sun) { const [sx, sy] = o.sun, rg = g.createRadialGradient(sx, sy, 0, sx, sy, o.sunR ?? 700); rg.addColorStop(0, 'rgba(255,246,214,.95)'); rg.addColorStop(.12, 'rgba(255,226,160,.55)'); rg.addColorStop(1, 'rgba(255,210,150,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    E.dabs(g, o.dabs ?? 16000, [0, 0, W, h * 1.05], (x, y) => { let c0 = sf(y / h); if (o.sun) { const d = Math.hypot(x - o.sun[0], (y - o.sun[1]) * 1.6); c0 = E.mix(c0, E.hex('#fff0c6'), E.clamp(1 - d / 600) * .6); } return c0; }, r);
    if (o.sun && o.sunDisk !== false) { g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(o.sun[0], o.sun[1], o.sunDisk ?? 44, 0, 7); g.fill(); }
    return c;
  };
  /** cumulus cloud, cel 3-tone. light: 'below' (sunrise/sunset) or 'above' (day). cols = [shadow, mid, lit] */
  E.cloud = (g, cx, cy, wd, hg, r, cols = ['#a297b9', '#dcbcc2', '#f6d6c2'], o = {}) => {
    const n = Math.max(5, Math.floor(wd / 38)), circ = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), hh = Math.pow(Math.sin(Math.PI * (.08 + u * .84)), .8) * hg, rd = hh * (.45 + r() * .5) + 12; circ.push([cx - wd / 2 + u * wd + (r() - .5) * 24, cy - rd * .55 - r() * hh * .35, rd]); }
    for (let i = 0; i < n / 2; i++) { const u = .2 + r() * .6, rd = hg * (.3 + r() * .35); circ.push([cx - wd / 2 + u * wd, cy - hg * (.7 + r() * .5), rd]); }
    const P = new Path2D(); circ.forEach(([x, y, rd]) => { P.moveTo(x + rd, y); P.arc(x, y, rd, 0, 7); });
    g.save(); g.beginPath(); g.moveTo(cx - wd, cy - hg * 4); g.lineTo(cx + wd, cy - hg * 4); for (let x = cx + wd; x >= cx - wd; x -= 10) g.lineTo(x, cy + 6 + Math.sin(x * .021 + cx) * 7 + Math.sin(x * .05) * 3); g.closePath(); g.clip(); g.clip(P);
    g.fillStyle = cols[0]; g.fillRect(cx - wd, cy - hg * 3, wd * 2, hg * 4);
    const sgn = (o.light ?? 'below') === 'below' ? 1 : -1;
    const lay = (dx, dy, s, col) => { g.beginPath(); circ.forEach(([x, y, rd]) => { g.moveTo(x + dx + rd * s, y + dy); g.arc(x + dx, y + dy, rd * s, 0, 7); }); g.fillStyle = col; g.fill(); };
    lay(3, 5 * sgn, .97, cols[1]); lay(6, 9 * sgn, .92, cols[2]);
    for (let i = 0; i < 260; i++) E.blob(g, cx - wd / 2 + r() * wd, cy - hg * 2 + r() * hg * 2.2, 6 + r() * 18, 2 + r() * 5, (r() - .5) * .3, E.rgba(E.jit(E.hex(r() < .5 ? cols[2] : cols[0]), r, 12), .18), r);
    g.restore();
  };
  /** mountain / hill silhouette with dab texture */
  E.ridge = (g, W, H, baseY, amp, col, col2, seed, freq = .005) => { const rr = E.rng(seed), ph = [rr() * 9, rr() * 9, rr() * 9], P = new Path2D(); P.moveTo(0, H); for (let x = 0; x <= W; x += 6) P.lineTo(x, baseY - amp * (.55 * Math.sin(x * freq + ph[0]) + .3 * Math.sin(x * freq * 2.3 + ph[1]) + .15 * Math.sin(x * freq * 5.7 + ph[2]))); P.lineTo(W, H); P.closePath(); g.fillStyle = col; g.fill(P); g.save(); g.clip(P); E.dabs(g, 1600, [0, baseY - amp, W, baseY + amp + 60], () => E.hex(rr() < .35 ? col2 : col), rr, { alpha: .3, angle: 0, spread: .4, min: 10, len: 30 }); g.restore(); };
  /** a row of trees/bushes. cfg {y, size, base, mid, hi, haze, seed, trunks, sun:[x,y], hazeCol} → full-size canvas */
  E.foliage = (W, H, cfg) => {
    const c = E.mk(W, H), g = c.getContext('2d'), r = E.rng(cfg.seed), sun = cfg.sun || [W * .8, H * .55];
    const top = x => cfg.y + Math.sin(x * .004 + cfg.seed) * cfg.size * .25;
    g.fillStyle = cfg.base; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, top(x)); g.lineTo(W, H); g.fill();
    const B = E.hex(cfg.base), M = E.hex(cfg.mid), HI = E.hex(cfg.hi);
    for (let x = -60; x < W + 60; x += cfg.size * (.9 + r() * .9)) {
      const ty = top(x) - cfg.size * (.4 + r() * 1.5), cw = cfg.size * (.8 + r() * .7), cl = [], nc = 5 + (r() * 7 | 0);
      for (let k = 0; k < nc; k++) cl.push([x + (r() - .5) * cw * 1.4, ty + r() * (top(x) - ty + cfg.size * .4), cfg.size * (.32 + r() * .38)]);
      if (cfg.trunks && r() < .5) { g.strokeStyle = E.rgba(E.mix(B, [20, 25, 30], .4)); g.lineWidth = cfg.size * .12; g.beginPath(); g.moveTo(x, top(x) + cfg.size); g.lineTo(x + (r() - .5) * 8, ty + cfg.size * .6); g.stroke(); }
      const toSun = x < sun[0] ? 1 : -.4;
      cl.forEach(([cx, cy, rd]) => E.clump(g, cx, cy, rd, E.rgba(E.jit(B, r, 6)), r, 11));
      cl.forEach(([cx, cy, rd]) => E.clump(g, cx + rd * .22 * toSun, cy - rd * .26, rd * .72, E.rgba(E.jit(M, r, 8)), r, 9));
      cl.forEach(([cx, cy, rd]) => { const m = Math.round(rd * 1.6); for (let k = 0; k < m; k++) { const a = -Math.PI / 2 + (toSun > 0 ? .15 : -.6) + (r() - .5) * 1.9, d = rd * (.45 + r() * .5); E.blob(g, cx + Math.cos(a) * d + rd * .15 * toSun, cy + Math.sin(a) * d * .85 - rd * .1, 1.5 + rd * .12 * r(), 1 + rd * .07, a, E.rgba(E.jit(r() < .7 ? HI : M, r, 14), .9), r, 5); } });
    }
    if (cfg.haze) { g.globalCompositeOperation = 'source-atop'; const hz = g.createLinearGradient(0, cfg.y - cfg.size * 2, 0, cfg.y + cfg.size * 2); const hc = E.hex(cfg.hazeCol || '#f3d3b2'); hz.addColorStop(0, E.rgba(hc, cfg.haze)); hz.addColorStop(1, E.rgba(E.hex('#c9c3c8'), cfg.haze * 1.6)); g.fillStyle = hz; g.fillRect(0, 0, W, H); }
    return c;
  };
  /** anime tree crown tier: circles on a flattened arc, lit side shifted toward the sun, cool underside, leaf
   * speckles and serrated edge. C = {B, M, U (css), HI, Mc (rgb arrays)} */
  E.leafMass = (g, cx, cy, w, h, C, r, toSun) => {
    const n = 5 + Math.round(w / 16), circ = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1); circ.push([cx - w + 2 * w * u + (r() - .5) * w * .12, cy - Math.pow(Math.sin(Math.PI * u), .6) * h * .6 + (r() - .5) * h * .3, h * (.42 + r() * .4) * (.65 + .35 * Math.sin(Math.PI * u))]); }
    const P = new Path2D(); circ.forEach(([x, y, rd]) => { P.moveTo(x + rd, y); P.arc(x, y, rd, 0, 7); });
    g.fillStyle = C.B; g.fill(P); g.save(); g.clip(P);
    g.beginPath(); circ.forEach(([x, y, rd]) => { const ox = rd * .22 * toSun, oy = -rd * .3; g.moveTo(x + ox + rd * .86, y + oy); g.arc(x + ox, y + oy, rd * .86, 0, 7); }); g.fillStyle = C.M; g.fill();
    g.beginPath(); circ.forEach(([x, y, rd]) => { const ox = -rd * .12 * toSun, oy = rd * .55; g.moveTo(x + ox + rd * .8, y + oy); g.arc(x + ox, y + oy, rd * .8, 0, 7); }); g.fillStyle = C.U; g.fill();
    circ.forEach(([x, y, rd]) => { for (let k = 0; k < rd * .9; k++) { const a = -Math.PI / 2 + (toSun > 0 ? .35 : -.5) + (r() - .5) * 1.7, d = rd * (.35 + r() * .55); E.blob(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6 + rd * .09 * r(), 1 + rd * .05, a, E.rgba(E.jit(r() < .75 ? C.HI : C.Mc, r, 14), .92), r, 5); } });
    g.restore();
    circ.forEach(([x, y, rd]) => { for (let k = 0; k < 5; k++) { const a = -Math.PI * (.15 + r() * .7), ex = x + Math.cos(a) * rd, ey = y + Math.sin(a) * rd, l = 3 + r() * 7, lit = Math.cos(a) * toSun > 0; g.fillStyle = lit ? E.rgba(E.jit(C.HI, r, 10)) : C.M; g.beginPath(); g.moveTo(ex - 2.5, ey + 1); g.lineTo(ex + Math.cos(a + (r() - .5) * .8) * l, ey + Math.sin(a + (r() - .5) * .8) * l); g.lineTo(ex + 2.5, ey + 1); g.fill(); } });
  };
  /** dense near/mid forest of layered anime crowns with per-tree hue variation and trunks.
   * cfg {y, size, base, mid, hi, haze, seed, trunks, sun:[x,y]} — better than E.foliage for layers close to camera */
  E.canopy = (W, H, cfg) => {
    const c = E.mk(W, H), g = c.getContext('2d'), r = E.rng(cfg.seed), sun = cfg.sun || [W * .8, H * .55];
    const top = x => cfg.y + Math.sin(x * .0037 + cfg.seed) * cfg.size * .35 + Math.sin(x * .011) * cfg.size * .12;
    g.fillStyle = cfg.base; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, top(x) - cfg.size * .6); g.lineTo(W, H); g.fill();
    const xs = []; for (let x = -80; x < W + 80; x += cfg.size * (.55 + r() * .55)) xs.push(x); xs.sort(() => r() - .5);
    for (const x of xs) {
      const hue = r(), B = E.mix(E.hex(cfg.base), hue < .33 ? E.hex('#3a4a2a') : hue < .66 ? E.hex('#1f3d40') : E.hex(cfg.base), .35);
      const C = { B: E.rgba(B), M: E.rgba(E.mix(E.hex(cfg.mid), hue < .33 ? E.hex('#7d8c3e') : hue < .66 ? E.hex('#3f6a63') : E.hex(cfg.mid), .3)), U: E.rgba(E.mix(B, E.hex('#1a2438'), .35), .55), HI: E.mix(E.hex(cfg.hi), hue < .33 ? E.hex('#d6c86a') : E.hex('#a9c98a'), .3), Mc: E.hex(cfg.mid) };
      const toSun = x < sun[0] ? 1 : -.5, h = cfg.size * (.6 + r() * 1.3), baseY = top(x), tiers = 2 + (r() * 3 | 0), topY = baseY - h;
      if (cfg.trunks) { g.strokeStyle = E.rgba(E.mix(B, [18, 22, 30], .5)); g.lineWidth = cfg.size * .1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, baseY + cfg.size * 1.2); g.quadraticCurveTo(x + (r() - .5) * 20, baseY - h * .3, x + (r() - .5) * 14, topY + h * .3); g.stroke(); }
      for (let k = 0; k < tiers; k++) { const u = k / Math.max(1, tiers - 1); E.leafMass(g, x + (r() - .5) * cfg.size * .5, topY + k * h / tiers * .6 + cfg.size * .3, cfg.size * (.6 + u * .35 + r() * .3), cfg.size * (.5 + r() * .25), C, r, toSun); }
    }
    g.globalCompositeOperation = 'source-atop';
    if (cfg.haze) { const hz = g.createLinearGradient(0, cfg.y - cfg.size * 2, 0, cfg.y + cfg.size * 2); hz.addColorStop(0, E.rgba(E.hex('#f3d3b2'), cfg.haze)); hz.addColorStop(1, E.rgba(E.hex('#c9c3c8'), cfg.haze * 1.6)); g.fillStyle = hz; g.fillRect(0, 0, W, H); }
    const rl = g.createLinearGradient(sun[0] + 200, 0, sun[0] - 900, 0); rl.addColorStop(0, 'rgba(255,196,120,.16)'); rl.addColorStop(1, 'rgba(255,196,120,0)'); g.fillStyle = rl; g.fillRect(0, 0, W, H);
    return c;
  };
  /** ribbed hose / cable / pipe along control points (mecha detail) */
  E.hose = (g, pts, w, seed, v = 0, col = '#6e6a78', hi = '#a7a2ae') => {
    const p = E.boil(E.resample(E.chaikin(pts, 3, false), 4, false), v, v ? 1 : 0, seed), [lx, ly] = E.light;
    const line = (lw, c) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
    line(w + 6, E.INK); line(w, col); g.save(); g.translate(lx * w * .2, ly * w * .45); line(w * .32, hi); g.restore();
    g.strokeStyle = 'rgba(42,32,28,.75)'; g.lineWidth = 1.6; for (let i = 3; i < p.length - 3; i += 4) { const [ax, ay] = p[i - 1], [bx, by] = p[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w * .5, ny = dx / L * w * .5; g.beginPath(); g.moveTo(p[i][0] + nx, p[i][1] + ny); g.lineTo(p[i][0] - nx, p[i][1] - ny); g.stroke(); }
  };
  /** horizontally tiling mist strip; draw with E.mist each frame */
  E.mistTex = (seed, w, h, col, blur) => { const c = E.mk(w, h), g = c.getContext('2d'), r = E.rng(seed); g.filter = `blur(${blur}px)`; for (let i = 0; i < 110; i++) { const x = r() * w, y = h * .5 + (r() - .5) * h * .35, rx = 70 + r() * 190, ry = 10 + r() * h * .14; g.fillStyle = E.rgba(E.jit(E.hex(col), r, 6), .1 + r() * .16); for (const o of [-w, 0, w]) { g.beginPath(); g.ellipse(x + o, y, rx, ry, 0, 0, 7); g.fill(); } } return c; };
  E.mist = (g, tex, y, speed, t, alpha) => { const w = tex.width, x = -((t * speed) % w); g.globalAlpha = alpha; g.drawImage(tex, x, y); g.drawImage(tex, x + w, y); g.globalAlpha = 1; };
  /** god rays from a point: beams [[angle, halfWidth, alpha]] */
  E.rays = (g, [sx, sy], beams, I = 1, col = '255,236,190') => { g.save(); g.globalCompositeOperation = 'screen'; for (const [a, w, al] of beams) { const L = 2600, gr = g.createRadialGradient(sx, sy, 0, sx, sy, 1500); gr.addColorStop(0, `rgba(${col},${al * I})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - w) * L, sy + Math.sin(a - w) * L); g.lineTo(sx + Math.cos(a + w) * L, sy + Math.sin(a + w) * L); g.closePath(); g.fill(); } g.restore(); };
  /** cel-shaded flame/exhaust/fire tongue pointing along +y from (x,y) (rotate the context to aim) */
  E.flame = (g, x, y, len, wd, r, cols = ['#ff6a3d', '#ffb347', '#fff3d1']) => { const lay = (sc, col) => { g.beginPath(); g.moveTo(x - wd * sc, y); const n = 7; for (let i = 1; i < n; i++) { const u = i / n; g.lineTo(x - wd * sc * (1 - u) * (.8 + r() * .4) + (r() - .5) * 8, y + len * sc * u); } g.lineTo(x + (r() - .5) * 10, y + len * sc); for (let i = n - 1; i > 0; i--) { const u = i / n; g.lineTo(x + wd * sc * (1 - u) * (.8 + r() * .4) + (r() - .5) * 8, y + len * sc * u); } g.lineTo(x + wd * sc, y); g.closePath(); g.fillStyle = col; g.fill(); }; lay(1, cols[0]); lay(.72, cols[1]); lay(.42, cols[2]); };
  /** additive glow */
  E.glow = (g, x, y, r0, r1, rgb, a) => { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r1, y - r1, r1 * 2, r1 * 2); g.restore(); };
  /** a fluttering leaf / petal / paper scrap */
  E.leaf = (g, x, y, rot, sy, s, col, line = 'rgba(42,32,28,.6)') => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, sy); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s * 1.7, s * .75, 0, 0, 7); g.fill(); if (line) { g.strokeStyle = line; g.lineWidth = 1; g.stroke(); } g.restore(); };

  // ───────────── finishing
  E.grainTex = (seed = 5) => { const c = E.mk(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256), r = E.rng(seed); for (let i = 0; i < id.data.length; i += 4) { const v = 110 + r() * 60; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); return c; };
  /** warm light leak + vignette + film/paper grain (call last, identity transform) */
  E.grade = (g, t, o = {}) => {
    const W = g.canvas.width, H = g.canvas.height;
    if (o.sun) { g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createRadialGradient(o.sun[0], o.sun[1], 0, o.sun[0], o.sun[1], o.leakR ?? 1200); gr.addColorStop(0, `rgba(${o.leak ?? '255,196,120'},${o.leakA ?? .22})`); gr.addColorStop(1, `rgba(${o.leak ?? '255,196,120'},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
    if (o.vignette !== 0) { const gr = g.createRadialGradient(W / 2, H * .52, Math.min(W, H) * .48, W / 2, H * .52, Math.max(W, H) * .65); gr.addColorStop(0, 'rgba(24,16,36,0)'); gr.addColorStop(1, `rgba(24,16,36,${o.vignette ?? .5})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (!E._grain) E._grain = E.grainTex();
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = o.grain ?? .09; const gi = Math.floor(t * 12) % 4; g.translate(gi * 61, gi * 37); g.fillStyle = g.createPattern(E._grain, 'repeat'); g.fillRect(-300, -300, W + 600, H + 600); g.restore();
    if (o.fade) { const f = Math.min(E.sstep(0, o.fade[0], t), 1 - E.sstep(o.dur - o.fade[1], o.dur, t)); if (f < 1) { g.fillStyle = `rgba(0,0,0,${1 - f})`; g.fillRect(0, 0, W, H); } }
  };

  // ───────────── harness
  /** scene = {W, H, dur, build(E) → layers, render(g, t, L, E)}. Exposes window.renderAt(t) / __ready for capture.
   * URL: ?t=3.2 freezes a frame, ?capture=1 disables the realtime loop. */
  E.run = scene => {
    const cv = document.getElementById('c'); cv.width = scene.W; cv.height = scene.H;
    cv.style.width = `min(100vw, calc(100vh * ${scene.W} / ${scene.H}))`; cv.style.aspectRatio = `${scene.W} / ${scene.H}`;
    const g = cv.getContext('2d'); E.W = scene.W; E.H = scene.H; E.dur = scene.dur;
    const L = scene.build(E) || {};
    const draw = t => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); scene.render(g, t, L, E); g.restore(); };
    window.renderAt = draw; window.__dur = scene.dur; window.__fps = scene.fps || 24; window.__ready = true;
    const q = location.search;
    if (/capture/.test(q)) return;
    const m = q.match(/t=([\d.]+)/); if (m) return draw(+m[1]);
    const t0 = performance.now(); (function loop() { draw(((performance.now() - t0) / 1000) % scene.dur); requestAnimationFrame(loop); })();
  };
  return E;
})();
