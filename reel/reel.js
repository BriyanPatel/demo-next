// Bliss Web Solution — 30s launch reel.
// Every frame is a pure function of time: render(t). The renderer (render.mjs)
// steps t frame by frame; ?play=1 previews it live in a browser with audio.
/* eslint-disable */

const params = new URLSearchParams(location.search);
const W = +params.get("w") || 1920;
const H = +params.get("h") || 1080;
const cv = document.getElementById("c");
cv.width = W;
cv.height = H;
const ctx = cv.getContext("2d");
const PORTRAIT = H > W;
const U = Math.min(W, H) / 1080;
const CX = W / 2;
const CY = H / 2;
const DURATION = 30;
const DEG = Math.PI / 180;

const C = {
  bg0: "#05060F",
  bg1: "#0D1233",
  vio: "#7B61FF",
  cyan: "#22D3EE",
  pink: "#FF4D8D",
  gold: "#FFC857",
  green: "#34D399",
  white: "#F5F7FF",
  muted: "#8A93B8",
  ink: "#070914",
};

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  outBack: (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
  smooth: (x) => x * x * (3 - 2 * x),
};
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function keyframes(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, E.inOutCubic((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- drawing helpers ----------
function setFont(weight, size, fam, spacing = 0) {
  ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = `${spacing}px`;
}
function measure(str, weight, size, fam, spacing = 0) {
  setFont(weight, size, fam, spacing);
  return ctx.measureText(str).width - (str.length ? spacing : 0);
}
// Draw text. Returns the size actually used (after fitting to maxW).
function text(str, x, y, o = {}) {
  let size = o.size || 40, spacing = o.spacing || 0;
  const weight = o.weight || 700, fam = o.fam || "SG";
  const align = o.align || "center";
  if (o.maxW) {
    const w = measure(str, weight, size, fam, spacing);
    if (w > o.maxW) { const k = o.maxW / w; size *= k; spacing *= k; }
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
  setFont(weight, size, fam, spacing);
  const w = ctx.measureText(str).width - (str.length ? spacing : 0);
  // manual alignment keeps letter-spacing centred
  let left = x;
  if (align === "center") left = x - w / 2;
  else if (align === "right") left = x - w;
  ctx.textAlign = "left";
  ctx.textBaseline = o.base || "middle";
  if (o.glow) { ctx.shadowBlur = o.glow; ctx.shadowColor = o.glowColor || o.color || C.cyan; }
  let fill = o.color || C.white;
  if (o.grad) {
    const g = ctx.createLinearGradient(left, 0, left + w, 0);
    o.grad.forEach((c, i) => g.addColorStop(i / (o.grad.length - 1), c));
    fill = g;
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineW || 2; ctx.lineJoin = "round";
    ctx.strokeText(str, left, y);
  } else {
    ctx.fillStyle = fill;
    ctx.fillText(str, left, y);
  }
  ctx.restore();
  return size;
}
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function glowBlob(x, y, r, col, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a));
  g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function linGrad(x0, y0, x1, y1, cols) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}
// Stroke a path progressively (0..1) using the dash trick.
function drawOn(pathFn, p, len) {
  if (p <= 0) return;
  ctx.save();
  ctx.setLineDash([len * p, len]);
  pathFn();
  ctx.stroke();
  ctx.restore();
}
function check(x, y, s, col) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = s * 0.18; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s * 0.1, y + s * 0.3); ctx.lineTo(x + s * 0.45, y - s * 0.35);
  ctx.stroke();
  ctx.restore();
}

// ---------- precomputed assets ----------
const grain = [];
(function makeGrain() {
  const r = rng(7);
  for (let k = 0; k < 4; k++) {
    const g = document.createElement("canvas");
    g.width = g.height = 256;
    const gx = g.getContext("2d");
    const img = gx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (r() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gx.putImageData(img, 0, 0);
    grain.push(g);
  }
})();
const dust = (() => {
  const r = rng(11), out = [];
  for (let i = 0; i < 90; i++) out.push({ x: r(), y: r(), s: 0.6 + r() * 2.4, sp: 0.2 + r() * 0.8, ph: r() * 6.28 });
  return out;
})();
function burst(seed, n) {
  const r = rng(seed), out = [];
  const cols = [C.vio, C.cyan, C.pink, C.white, C.gold];
  for (let i = 0; i < n; i++) {
    out.push({ a: r() * Math.PI * 2, v: 300 + r() * 1500, s: 1.5 + r() * 4.5, c: cols[(r() * cols.length) | 0], d: r() });
  }
  return out;
}
const BURST1 = burst(21, 180);
const BURST2 = burst(99, 220);

// ---------- global layers ----------
const IMPACTS = [
  { t: 2.5, a: 22, f: 1 },
  { t: 10.0, a: 14, f: 0.35 }, { t: 10.5, a: 9, f: 0.18 }, { t: 11.0, a: 9, f: 0.18 },
  { t: 11.5, a: 9, f: 0.18 }, { t: 12.0, a: 9, f: 0.18 }, { t: 12.5, a: 12, f: 0.25 },
  { t: 17.0, a: 5, f: 0 }, { t: 18.3, a: 5, f: 0 }, { t: 19.3, a: 6, f: 0 }, { t: 20.3, a: 5, f: 0 },
  { t: 26.0, a: 26, f: 1 },
];
const CUTS = [6, 10, 13, 17, 21.5];

function shake(t) {
  let x = 0, y = 0;
  IMPACTS.forEach((im, i) => {
    const d = t - im.t;
    if (d < 0 || d > 0.7) return;
    const k = im.a * U * Math.exp(-d * 8);
    x += k * Math.sin(d * 63 + i * 1.7);
    y += k * Math.cos(d * 51 + i * 2.3);
  });
  return [x, y];
}

function background(t, energy) {
  const g = ctx.createRadialGradient(CX, CY * 0.8, 0, CX, CY, Math.hypot(W, H) * 0.65);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  glowBlob(CX + Math.sin(t * 0.4) * W * 0.28, CY + Math.cos(t * 0.31) * H * 0.22, 700 * U, C.vio, 0.2 * energy);
  glowBlob(CX + Math.cos(t * 0.33) * W * 0.3, CY + Math.sin(t * 0.47) * H * 0.26, 560 * U, C.cyan, 0.12 * energy);
  glowBlob(CX + Math.sin(t * 0.21 + 2) * W * 0.3, CY + Math.cos(t * 0.27 + 1) * H * 0.3, 480 * U, C.pink, 0.08 * energy);
  // drifting grid
  const step = 90 * U, off = (t * 18 * U) % step;
  ctx.save();
  ctx.strokeStyle = hexA(C.white, 0.035 * energy);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -step + off; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = -step + off; y < H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.restore();
  // dust
  ctx.save();
  dust.forEach((d) => {
    const x = ((d.x * W + t * d.sp * 25 * U) % W + W) % W;
    const y = ((d.y * H - t * d.sp * 40 * U) % H + H) % H;
    const a = (0.25 + 0.25 * Math.sin(t * 2 * d.sp + d.ph)) * energy;
    ctx.fillStyle = hexA(C.white, a);
    ctx.beginPath(); ctx.arc(x, y, d.s * U, 0, 6.283); ctx.fill();
  });
  ctx.restore();
}

function streaks(t) {
  CUTS.forEach((c) => {
    const p = prog(t, c - 0.2, c + 0.2);
    if (p <= 0 || p >= 1) return;
    const x = lerp(-0.4 * W, 1.4 * W, E.inOutCubic(p));
    const slant = H * 0.35;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexA(C.cyan, 0.18);
    ctx.lineWidth = 120 * U;
    ctx.beginPath(); ctx.moveTo(x + slant, -20); ctx.lineTo(x - slant, H + 20); ctx.stroke();
    ctx.shadowBlur = 40 * U; ctx.shadowColor = C.cyan;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 5 * U;
    ctx.beginPath(); ctx.moveTo(x + slant, -20); ctx.lineTo(x - slant, H + 20); ctx.stroke();
    ctx.restore();
  });
}

function flash(t) {
  let a = 0;
  IMPACTS.forEach((im) => {
    const d = t - im.t;
    if (d >= 0 && d < 0.6) a = Math.max(a, im.f * Math.exp(-d * 9));
  });
  if (a > 0.003) {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function hud(t) {
  const a = 0.6 * prog(t, 2.8, 3.4) * (1 - prog(t, 25.1, 25.5));
  if (a <= 0) return;
  const m = 44 * U, L = 26 * U;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = C.white; ctx.lineWidth = 2 * U;
  ctx.beginPath();
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y);
  });
  ctx.stroke();
  const o = { size: 17 * U, weight: 500, fam: "JB", spacing: 3 * U, color: C.white };
  text("BLISS WEB SOLUTION", m + 40 * U, m + 12 * U, { ...o, align: "left" });
  text("SHOWREEL · 2026", W - m - 40 * U, m + 12 * U, { ...o, align: "right" });
  const f = Math.floor(t * 30) % 30, s = Math.floor(t);
  text(`TC 00:00:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`, m + 40 * U, H - m - 12 * U, { ...o, align: "left" });
  text("BLISSWEBSOLUTION.COM", W - m - 40 * U, H - m - 12 * U, { ...o, align: "right" });
  // rec dot
  ctx.fillStyle = C.pink;
  ctx.globalAlpha = a * (Math.floor(t * 2) % 2 ? 0.3 : 1);
  ctx.beginPath(); ctx.arc(m + 22 * U, H - m - 12 * U, 5 * U, 0, 6.283); ctx.fill();
  ctx.restore();
}

function finish(t) {
  // film grain
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.07;
  const g = grain[Math.floor(t * 30) % 4];
  const pat = ctx.createPattern(g, "repeat");
  ctx.translate(((t * 997) % 256) | 0, ((t * 571) % 256) | 0);
  ctx.fillStyle = pat;
  ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(CX, CY, Math.min(W, H) * 0.35, CX, CY, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------- shared: the Bliss wordmark ----------
function logo(lt, cy, alpha = 1) {
  const word = "BLISS";
  const spacing = 14 * U;
  let size = 290 * U;
  const maxW = W * 0.8;
  let w = measure(word, 700, size, "SG", spacing);
  if (w > maxW) { size *= maxW / w; w = maxW; }
  setFont(700, size, "SG", 0);
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (word.length - 1);
  let x = CX - total / 2;
  const grad = linGrad(CX - total / 2, 0, CX + total / 2, 0, [C.vio, C.cyan, C.pink]);
  const lyY = cy - size * 0.12;
  ctx.save();
  ctx.globalAlpha *= alpha;
  glowBlob(CX, lyY, total * 0.75, C.vio, 0.35 * prog(lt, 0, 0.5));
  [...word].forEach((ch, i) => {
    const lp = prog(lt, 0.03 + i * 0.07, 0.03 + i * 0.07 + 0.55);
    if (lp <= 0) { x += widths[i] + spacing; return; }
    const s = lerp(2.6, 1, E.outExpo(lp));
    const cxl = x + widths[i] / 2;
    ctx.save();
    ctx.globalAlpha *= clamp(lp * 4);
    ctx.translate(cxl, lyY);
    ctx.scale(s, s);
    setFont(700, size, "SG", 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 50 * U;
    ctx.shadowColor = hexA(C.vio, 0.9);
    ctx.fillStyle = grad;
    // gradient is in world space; offset so colours stay locked to the word
    ctx.translate(-cxl, -lyY);
    ctx.fillText(ch, cxl, lyY);
    ctx.restore();
    x += widths[i] + spacing;
  });
  // WEB SOLUTION
  const wp = prog(lt, 0.5, 1.15);
  if (wp > 0) {
    const sp = lerp(46, 20, E.outCubic(wp)) * U;
    const y2 = lyY + size * 0.52 + 26 * U;
    const ws = text("WEB SOLUTION", CX, y2, { size: 44 * U, weight: 500, fam: "SG", spacing: sp, alpha: E.outCubic(wp), maxW: W * 0.8 });
    const lw = E.outCubic(prog(lt, 0.7, 1.3)) * 120 * U;
    const half = measure("WEB SOLUTION", 500, ws, "SG", sp) / 2 + 28 * U;
    ctx.strokeStyle = linGrad(CX - half - lw, 0, CX + half + lw, 0, [hexA(C.cyan, 0), C.cyan, hexA(C.cyan, 0)]);
    ctx.lineWidth = 2 * U;
    ctx.beginPath();
    ctx.moveTo(CX - half, y2); ctx.lineTo(CX - half - lw, y2);
    ctx.moveTo(CX + half, y2); ctx.lineTo(CX + half + lw, y2);
    ctx.stroke();
  }
  ctx.restore();
  return lyY + size * 0.52 + 26 * U;
}

function shockwave(lt, color) {
  const p = prog(lt, 0, 0.9);
  if (p <= 0 || p >= 1) return;
  const r = E.outCubic(p) * Math.hypot(W, H) * 0.7;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hexA(color, 0.7 * (1 - p));
  ctx.lineWidth = lerp(40, 2, p) * U;
  ctx.beginPath(); ctx.arc(CX, CY, r, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = hexA(C.white, 0.5 * (1 - p));
  ctx.lineWidth = lerp(8, 1, p) * U;
  ctx.beginPath(); ctx.arc(CX, CY, r * 0.8, 0, 6.283); ctx.stroke();
  ctx.restore();
}

function particles(list, lt, cx, cy) {
  if (lt < 0 || lt > 2.2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const k = 3.2;
  list.forEach((p) => {
    const dist = (p.v * U / k) * (1 - Math.exp(-k * lt));
    const x = cx + Math.cos(p.a) * dist, y = cy + Math.sin(p.a) * dist + lt * lt * 40 * U;
    const a = 1 - prog(lt, 0.2 + p.d * 0.6, 1.2 + p.d * 0.9);
    if (a <= 0) return;
    ctx.fillStyle = hexA(p.c, a);
    ctx.beginPath(); ctx.arc(x, y, p.s * U, 0, 6.283); ctx.fill();
  });
  ctx.restore();
}

// ============ SCENE 1 · boot (0 – 2.5) ============
const CMD = "> init bliss.launch()";
function s1(t) {
  ctx.fillStyle = "#020308";
  ctx.fillRect(0, 0, W, H);
  const col = prog(t, 2.12, 2.5);
  const sy = col < 0.6 ? lerp(1, 0.015, E.inCubic(col / 0.6)) : 0.015;
  const sx = col < 0.6 ? 1 : lerp(1, 0.0, E.inCubic((col - 0.6) / 0.4));
  const n = clamp(Math.floor((t - 0.3) / 0.055) + 1, 0, CMD.length);
  const size = Math.min(58 * U, (W * 0.84) / (CMD.length * 0.6));
  const full = measure(CMD, 500, size, "JB");
  const x0 = -full / 2;

  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(sx, sy);
  glowBlob(0, 0, 500 * U, C.cyan, 0.08 + col * 0.4);
  text(CMD.slice(0, n), x0, -30 * U, { size, weight: 500, fam: "JB", color: C.cyan, align: "left", glow: 22 * U });
  const cw = measure(CMD.slice(0, n), 500, size, "JB");
  if (n < CMD.length || Math.floor(t * 4) % 2 === 0) {
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x0 + cw + 8 * U, -30 * U - size * 0.5, size * 0.5, size);
  }
  const la = prog(t, 1.4, 1.55);
  if (la > 0) {
    const lb = E.outCubic(prog(t, 1.5, 2.12));
    text("loading 14 years of craft", x0, 52 * U, { size: size * 0.46, weight: 500, fam: "JB", color: C.muted, align: "left", alpha: la });
    text(`${Math.round(lb * 100)}%`, x0 + full, 52 * U, { size: size * 0.46, weight: 500, fam: "JB", color: C.white, align: "right", alpha: la });
    ctx.globalAlpha = la;
    ctx.fillStyle = hexA(C.white, 0.1);
    ctx.fillRect(x0, 88 * U, full, 8 * U);
    ctx.fillStyle = linGrad(x0, 0, x0 + full, 0, [C.vio, C.cyan, C.pink]);
    ctx.fillRect(x0, 88 * U, full * lb, 8 * U);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (col > 0) {
    const lw = W * (col < 0.6 ? 1 : 1 - E.inCubic((col - 0.6) / 0.4));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 30 * U; ctx.shadowColor = C.cyan;
    ctx.fillStyle = hexA(C.white, col);
    ctx.fillRect(CX - lw / 2, CY - 2 * U, lw, 4 * U);
    glowBlob(CX, CY, 260 * U * (0.3 + col), C.white, col * 0.8);
    ctx.restore();
  }
  // glitch slices
  if (t > 2.0 && t < 2.45) {
    const r = rng(Math.floor(t * 60));
    for (let i = 0; i < 6; i++) {
      const y = r() * H, h = (4 + r() * 30) * U, dx = (r() - 0.5) * 80 * U;
      ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
    }
  }
  // scanlines
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 4 * U) ctx.fillRect(0, y, W, 1.5 * U);
}

// ============ SCENE 2 · logo reveal (2.5 – 6.0) ============
function s2(lt) {
  const out = E.inCubic(prog(lt, 3.05, 3.5));
  shockwave(lt, C.vio);
  particles(BURST1, lt, CX, CY);
  ctx.save();
  const z = lerp(1, 1.04, lt / 3.5) + out * 0.35;
  ctx.translate(CX, CY); ctx.scale(z, z); ctx.translate(-CX, -CY);
  ctx.globalAlpha = 1 - out;
  const bottom = logo(lt, CY - 30 * U);
  const tp = prog(lt, 1.35, 2.0);
  if (tp > 0) {
    const tag = "Web Design  ·  Development  ·  Digital Marketing";
    const y = bottom + 90 * U;
    const tw = measure(tag, 500, 34 * U, "IN", 1 * U);
    const tw2 = Math.min(tw, W * 0.88);
    ctx.save();
    ctx.beginPath();
    const rw = tw2 * E.outCubic(tp);
    ctx.rect(CX - rw / 2 - 4, y - 40 * U, rw + 8, 80 * U);
    ctx.clip();
    text(tag, CX, y, { size: 34 * U, weight: 500, fam: "IN", color: "#C9D0F0", spacing: 1 * U, maxW: W * 0.88 });
    ctx.restore();
    const e2 = prog(lt, 1.9, 2.4);
    text("YOUR E-COMMERCE GROWTH PARTNER", CX, y + 70 * U, { size: 22 * U, weight: 500, fam: "JB", color: C.cyan, spacing: 6 * U, alpha: e2, maxW: W * 0.88 });
  }
  ctx.restore();
}

// ============ SCENE 3 · numbers (6 – 10) ============
const STATS = [
  { v: 14, suf: "+", label: "Years", sub: "of digital craft" },
  { v: 1400, suf: "+", label: "Projects", sub: "delivered worldwide" },
  { v: 800, suf: "+", label: "Happy Clients", sub: "USA · UK · Canada · Australia" },
  { v: 98, suf: "%", label: "Success Rate", sub: "and still climbing" },
];
function s3(lt) {
  const k = Math.min(3, Math.floor(lt));
  const sl = lt - k;
  const st = STATS[k];
  const ein = E.outExpo(prog(sl, 0, 0.32));
  const eout = k === 3 ? E.inCubic(prog(sl, 0.8, 1.0)) : E.inCubic(prog(sl, 0.82, 1.0));
  const dx = (1 - ein) * 280 * U - eout * 280 * U;
  const a = ein * (1 - eout);
  const val = Math.round(st.v * E.outCubic(prog(sl, 0.05, 0.6)));
  const str = val.toLocaleString("en-US") + st.suf;
  const final = st.v.toLocaleString("en-US") + st.suf;

  // giant ghost number
  text(final, CX - lt * 60 * U + 300 * U, CY + 40 * U, {
    size: 720 * U, weight: 700, fam: "SG", stroke: hexA(C.white, 0.06 * a), lineW: 2 * U,
  });

  ctx.save();
  ctx.translate(dx, 0);
  ctx.globalAlpha = a;
  const ny = CY - 60 * U;
  text(`0${k + 1} / 04`, CX, ny - 230 * U, { size: 24 * U, weight: 500, fam: "JB", color: C.cyan, spacing: 6 * U });
  // number width locked to its final value so it doesn't jitter while counting
  const maxW = W * 0.82;
  let size = 330 * U;
  const fw = measure(final, 700, size, "SG", -4 * U);
  if (fw > maxW) size *= maxW / fw;
  text(str, CX, ny, { size, weight: 700, fam: "SG", spacing: -4 * U, grad: [C.vio, C.cyan, C.pink], glow: 40 * U, glowColor: hexA(C.vio, 0.8) });
  const lw = E.outCubic(prog(sl, 0.1, 0.6)) * Math.min(420 * U, W * 0.6);
  ctx.fillStyle = linGrad(CX - lw / 2, 0, CX + lw / 2, 0, [hexA(C.cyan, 0), C.cyan, hexA(C.cyan, 0)]);
  ctx.fillRect(CX - lw / 2, ny + size * 0.46, lw, 3 * U);
  text(st.label, CX, ny + size * 0.46 + 72 * U, { size: 68 * U, weight: 700, fam: "SG", color: C.white, maxW: W * 0.86 });
  text(st.sub, CX, ny + size * 0.46 + 140 * U, { size: 32 * U, weight: 400, fam: "IN", color: C.muted, maxW: W * 0.86, alpha: prog(sl, 0.2, 0.45) });
  ctx.restore();

  // progress segments
  const segW = 120 * U, gap = 14 * U, total = segW * 4 + gap * 3;
  const by = H - 130 * U;
  for (let i = 0; i < 4; i++) {
    const x = CX - total / 2 + i * (segW + gap);
    ctx.fillStyle = hexA(C.white, 0.12);
    ctx.fillRect(x, by, segW, 4 * U);
    const f = i < k ? 1 : i === k ? prog(sl, 0, 0.9) : 0;
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x, by, segW * f, 4 * U);
  }
}

// ============ SCENE 4 · platforms (10 – 13) ============
const PLAT = [
  { w: "MAGENTO", s: "Certified developers", bg: C.vio },
  { w: "SHOPIFY", s: "Official partner", bg: null },
  { w: "BIGCOMMERCE", s: "Official partner", bg: C.pink },
  { w: "WORDPRESS", s: "Themes · plugins · Woo", bg: null },
  { w: "LARAVEL", s: "Custom web apps", bg: C.cyan },
  { w: "HEADLESS", s: "Next-gen commerce", bg: null },
];
function s4(lt) {
  const k = Math.min(5, Math.floor(lt / 0.5));
  const sl = lt - k * 0.5;
  const P = PLAT[k];
  const light = !!P.bg;
  if (light) {
    ctx.fillStyle = P.bg;
    ctx.fillRect(-50, -50, W + 100, H + 100);
    glowBlob(CX, CY, Math.max(W, H) * 0.6, C.white, 0.18);
  }
  // marquee rows
  const rowH = 200 * U;
  const rows = Math.ceil(H / rowH) + 1;
  ctx.save();
  for (let r = 0; r < rows; r++) {
    const y = r * rowH + rowH * 0.3;
    if (Math.abs(y - CY) < rowH * 0.8) continue;
    const dir = r % 2 ? 1 : -1;
    const line = (P.w + "   ").repeat(8);
    const off = ((lt * 500 * U * dir) % (W * 0.8));
    text(line, -W * 0.5 + off, y, { size: 150 * U, weight: 700, fam: "SG", align: "left",
      stroke: light ? hexA(C.ink, 0.22) : hexA(C.white, 0.08), lineW: 2 * U });
  }
  ctx.restore();

  const e = E.outExpo(prog(sl, 0, 0.2));
  const s = lerp(1.5, 1, e);
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(s, s);
  ctx.rotate(lerp(-0.04, 0, e) * (k % 2 ? -1 : 1));
  const o = { size: 250 * U, weight: 700, fam: "SG", maxW: W * 0.88, spacing: -2 * U, alpha: clamp(e * 2) };
  if (light) text(P.w, 0, -10 * U, { ...o, color: C.ink });
  else text(P.w, 0, -10 * U, { ...o, grad: [C.vio, C.cyan, C.pink], glow: 50 * U, glowColor: hexA(C.vio, 0.8) });
  ctx.restore();
  const sp = prog(sl, 0.08, 0.25);
  text(P.s.toUpperCase(), CX, CY + 150 * U, { size: 28 * U, weight: 500, fam: "JB", spacing: 6 * U,
    color: light ? C.ink : C.cyan, alpha: sp, maxW: W * 0.86 });
  text("PLATFORMS WE MASTER", CX, 150 * U, { size: 22 * U, weight: 500, fam: "JB", spacing: 8 * U, color: light ? C.ink : C.muted });
  text(`0${k + 1}`, CX, H - 150 * U, { size: 22 * U, weight: 500, fam: "JB", spacing: 4 * U, color: light ? C.ink : C.muted });
}

// ============ SCENE 5 · pillars (13 – 17) ============
const CARDS = [
  { t: "E-Commerce", icon: "cart", sub: ["Magento · Shopify", "BigCommerce · Headless"], c: C.vio },
  { t: "Web & Mobile Apps", icon: "phone", sub: ["WordPress · Laravel · PHP", "iOS · Android · Hybrid"], c: C.cyan },
  { t: "Digital Marketing", icon: "chart", sub: ["SEO · PPC", "Social Media"], c: C.pink },
];
function icon(kind, x, y, s, col, p) {
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = s * 0.07; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.translate(x, y);
  ctx.scale(lerp(0.6, 1, E.outBack(p)), lerp(0.6, 1, E.outBack(p)));
  if (kind === "cart") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.48, -s * 0.38); ctx.lineTo(-s * 0.32, -s * 0.38); ctx.lineTo(-s * 0.18, s * 0.18);
    ctx.lineTo(s * 0.36, s * 0.18); ctx.lineTo(s * 0.46, -s * 0.22); ctx.lineTo(-s * 0.26, -s * 0.22);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.12, s * 0.36, s * 0.07, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, s * 0.36, s * 0.07, 0, 6.283); ctx.fill();
  } else if (kind === "phone") {
    rrect(-s * 0.24, -s * 0.44, s * 0.48, s * 0.88, s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.33); ctx.lineTo(s * 0.06, -s * 0.33); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.05, 0, 6.283); ctx.fill();
  } else {
    [0.3, 0.55, 0.85].forEach((h, i) => {
      const bh = s * h * clamp(p * 1.4 - i * 0.15);
      ctx.fillRect(-s * 0.42 + i * s * 0.3, s * 0.42 - bh, s * 0.2, bh);
    });
    ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.02); ctx.lineTo(-s * 0.05, -s * 0.2); ctx.lineTo(s * 0.12, -s * 0.08); ctx.lineTo(s * 0.46, -s * 0.44);
    ctx.stroke();
  }
  ctx.restore();
}
function s5(lt) {
  const ha = E.outCubic(prog(lt, 0, 0.4)) * (1 - prog(lt, 3.6, 3.9));
  const hy = PORTRAIT ? (H - (110 + 3 * 420 + 2 * 44) * U) / 2 + 40 * U : CY - 360 * U;
  text("ONE TEAM", CX, hy - 60 * U, { size: 22 * U, weight: 500, fam: "JB", spacing: 8 * U, color: C.cyan, alpha: ha });
  text("Everything your brand needs online.", CX, hy + (1 - ha) * 30 * U, { size: 62 * U, weight: 700, fam: "SG", alpha: ha, maxW: W * 0.88 });

  const cw = PORTRAIT ? 900 * U : 520 * U;
  const ch = PORTRAIT ? 420 * U : 500 * U;
  const gap = PORTRAIT ? 44 * U : 46 * U;
  CARDS.forEach((cd, i) => {
    const p = prog(lt, 0.25 + i * 0.3, 0.25 + i * 0.3 + 0.6);
    if (p <= 0) return;
    const q = E.inCubic(prog(lt, 3.5 + i * 0.08, 3.5 + i * 0.08 + 0.35));
    let x, y;
    if (PORTRAIT) { x = CX - cw / 2; y = hy + 110 * U + i * (ch + gap); }
    else { x = CX - cw / 2 + (i - 1) * (cw + gap); y = CY - ch / 2 + 70 * U; }
    y += (1 - E.outBack(p)) * 160 * U - q * 220 * U;
    const a = clamp(p * 2.5) * (1 - q);
    ctx.save();
    ctx.globalAlpha = a;
    rrect(x, y, cw, ch, 28 * U);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fill();
    ctx.strokeStyle = linGrad(x, y, x + cw, y + ch, [hexA(cd.c, 0.9), hexA(C.white, 0.08), hexA(cd.c, 0.4)]);
    ctx.lineWidth = 2 * U;
    ctx.stroke();
    // sheen
    const sh = prog(lt, 1.3 + i * 0.18, 2.1 + i * 0.18);
    if (sh > 0 && sh < 1) {
      ctx.save();
      rrect(x, y, cw, ch, 28 * U); ctx.clip();
      const sx = lerp(x - cw * 0.5, x + cw * 1.5, sh);
      ctx.fillStyle = linGrad(sx - 120 * U, 0, sx + 120 * U, 0, ["rgba(255,255,255,0)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"]);
      ctx.fillRect(x, y, cw, ch);
      ctx.restore();
    }
    const pad = 48 * U;
    glowBlob(x + pad + 50 * U, y + pad + 50 * U, 110 * U, cd.c, 0.35);
    icon(cd.icon, x + pad + 50 * U, y + pad + 50 * U, 88 * U, cd.c, prog(lt, 0.4 + i * 0.3, 1.0 + i * 0.3));
    text(`0${i + 1}`, x + cw - pad, y + pad + 20 * U, { size: 22 * U, weight: 500, fam: "JB", color: C.muted, align: "right" });
    const ty = PORTRAIT ? y + pad + 160 * U : y + pad + 200 * U;
    text(cd.t, x + pad, ty, { size: 46 * U, weight: 700, fam: "SG", align: "left", maxW: cw - pad * 2 });
    cd.sub.forEach((s, j) => {
      text(s, x + pad, ty + 70 * U + j * 46 * U, { size: 28 * U, weight: 400, fam: "IN", color: "#AEB6D9", align: "left", maxW: cw - pad * 2,
        alpha: prog(lt, 0.7 + i * 0.3 + j * 0.1, 1.0 + i * 0.3 + j * 0.1) });
    });
    ctx.fillStyle = linGrad(x, 0, x + cw, 0, [cd.c, hexA(cd.c, 0)]);
    ctx.fillRect(x + pad, y + ch - pad * 0.7, (cw - pad * 2) * E.outCubic(prog(lt, 0.9 + i * 0.3, 1.6 + i * 0.3)), 3 * U);
    ctx.restore();
  });
}

// ============ SCENE 6 · design → develop → launch → grow (17 – 21.5) ============
const STEPS = ["Design.", "Develop.", "Launch.", "Grow."];
const STEP_T = [0, 1.3, 2.3, 3.3];
const CODE = ["const store = bliss.build({", "  platform: 'shopify',", "  speed: 'blazing',", "  seo: true,", "});"];
function s6(lt) {
  const out = E.inCubic(prog(lt, 4.15, 4.5));
  const inn = E.outCubic(prog(lt, 0, 0.35));
  const step = lt < 1.3 ? 0 : lt < 2.3 ? 1 : lt < 3.3 ? 2 : 3;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(CX, CY); const zs = 1 - out * 0.08; ctx.scale(zs, zs); ctx.translate(-CX, -CY);

  // step list
  if (PORTRAIT) {
    const wy = H * 0.2;
    STEPS.forEach((w, i) => {
      if (i !== step) return;
      const e = E.outExpo(prog(lt, STEP_T[i], STEP_T[i] + 0.35));
      text(w, CX, wy + (1 - e) * 60 * U, { size: 120 * U, weight: 700, fam: "SG", grad: [C.vio, C.cyan], alpha: e * inn });
    });
    STEPS.forEach((w, i) => {
      ctx.fillStyle = i <= step ? C.cyan : hexA(C.white, 0.2);
      ctx.fillRect(CX - 150 * U + i * 80 * U, wy + 100 * U, 60 * U, 5 * U);
    });
  } else {
    const lx = 150 * U;
    STEPS.forEach((w, i) => {
      const y = CY - 190 * U + i * 125 * U;
      const act = i === step;
      const ap = act ? E.outExpo(prog(lt, STEP_T[i], STEP_T[i] + 0.35)) : 0;
      const al = (i < step ? 0.35 : act ? 1 : 0.14) * inn;
      const xo = ap * 34 * U;
      if (act) {
        ctx.fillStyle = C.cyan;
        ctx.fillRect(lx - 4 * U, y - 40 * U, 6 * U, 80 * U * ap);
      }
      text(w, lx + xo + 20 * U, y, { size: 92 * U, weight: 700, fam: "SG", align: "left", alpha: al,
        ...(act ? { grad: [C.vio, C.cyan, C.pink] } : { color: C.white }) });
    });
  }

  // browser
  const bw = PORTRAIT ? 920 * U : 1020 * U;
  const bh = PORTRAIT ? 620 * U : 640 * U;
  const bx = PORTRAIT ? CX - bw / 2 - 40 * U : W - bw - 170 * U;
  const by = PORTRAIT ? CY - bh / 2 + 80 * U : CY - bh / 2;
  const p0 = prog(lt, 0.05, 0.5);
  ctx.save();
  ctx.globalAlpha *= clamp(p0 * 3);
  rrect(bx, by, bw, bh, 22 * U);
  ctx.fillStyle = `rgba(14,18,44,${0.85 * p0})`;
  ctx.fill();
  ctx.strokeStyle = hexA(C.white, 0.35);
  ctx.lineWidth = 2 * U;
  drawOn(() => rrect(bx, by, bw, bh, 22 * U), E.outCubic(p0), 2 * (bw + bh));
  // top bar
  const tb = prog(lt, 0.3, 0.5);
  [C.pink, C.gold, C.green].forEach((c, i) => {
    ctx.fillStyle = hexA(c, tb);
    ctx.beginPath(); ctx.arc(bx + 32 * U + i * 26 * U, by + 30 * U, 7 * U * E.outBack(tb), 0, 6.283); ctx.fill();
  });
  rrect(bx + bw * 0.3, by + 14 * U, bw * 0.4, 32 * U, 16 * U);
  ctx.fillStyle = hexA(C.white, 0.06 * tb); ctx.fill();
  text("yourbrand.com", bx + bw * 0.5, by + 31 * U, { size: 17 * U, weight: 500, fam: "JB", color: C.muted, alpha: tb });
  ctx.fillStyle = hexA(C.white, 0.08 * tb);
  ctx.fillRect(bx, by + 60 * U, bw, 1.5 * U);

  const x0 = bx + 30 * U, y0 = by + 80 * U, cw = bw - 60 * U;
  const tileW = (cw - 40 * U) / 3;
  const els = [
    { k: "nav", x: x0, y: y0, w: cw, h: 40 * U },
    { k: "hero", x: x0, y: y0 + 58 * U, w: cw, h: 230 * U },
    { k: "tile", x: x0, y: y0 + 306 * U, w: tileW, h: 180 * U },
    { k: "tile", x: x0 + tileW + 20 * U, y: y0 + 306 * U, w: tileW, h: 180 * U },
    { k: "tile", x: x0 + 2 * (tileW + 20 * U), y: y0 + 306 * U, w: tileW, h: 180 * U },
    { k: "foot", x: x0, y: y0 + 504 * U, w: cw, h: 36 * U },
  ];
  els.forEach((el, i) => {
    const wp = prog(lt, 0.35 + i * 0.12, 0.35 + i * 0.12 + 0.35);
    const fp = E.outCubic(prog(lt, 1.3 + i * 0.1, 1.3 + i * 0.1 + 0.35));
    if (wp <= 0) return;
    // wireframe
    ctx.save();
    ctx.globalAlpha *= 1 - fp * 0.85;
    ctx.strokeStyle = hexA(C.cyan, 0.75);
    ctx.lineWidth = 1.5 * U;
    drawOn(() => rrect(el.x, el.y, el.w, el.h, 10 * U), E.outCubic(wp), 2 * (el.w + el.h));
    if (el.k === "hero" || el.k === "tile") {
      ctx.strokeStyle = hexA(C.cyan, 0.25);
      drawOn(() => { ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + el.w, el.y + el.h); ctx.moveTo(el.x + el.w, el.y); ctx.lineTo(el.x, el.y + el.h); },
        E.outCubic(prog(wp, 0.4, 1)), 2 * Math.hypot(el.w, el.h));
    }
    ctx.restore();
    if (fp <= 0) return;
    // filled design
    ctx.save();
    ctx.globalAlpha *= fp;
    const sc = lerp(0.96, 1, fp);
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2); ctx.scale(sc, sc); ctx.translate(-(el.x + el.w / 2), -(el.y + el.h / 2));
    if (el.k === "nav") {
      ctx.fillStyle = linGrad(el.x, 0, el.x + 40 * U, 0, [C.vio, C.cyan]);
      rrect(el.x, el.y + 8 * U, 24 * U, 24 * U, 6 * U); ctx.fill();
      ctx.fillStyle = hexA(C.white, 0.85);
      ctx.fillRect(el.x + 36 * U, el.y + 14 * U, 90 * U, 12 * U);
      for (let j = 0; j < 4; j++) { ctx.fillStyle = hexA(C.white, 0.35); ctx.fillRect(el.x + el.w - 330 * U + j * 70 * U, el.y + 16 * U, 50 * U, 8 * U); }
      rrect(el.x + el.w - 40 * U, el.y + 6 * U, 40 * U, 28 * U, 14 * U); ctx.fillStyle = C.cyan; ctx.fill();
    } else if (el.k === "hero") {
      rrect(el.x, el.y, el.w, el.h, 14 * U);
      ctx.fillStyle = linGrad(el.x, el.y, el.x + el.w, el.y + el.h, [C.vio, "#5B3FD9", C.pink]); ctx.fill();
      glowBlob(el.x + el.w * 0.78, el.y + el.h * 0.5, 180 * U, C.cyan, 0.6);
      rrect(el.x + el.w * 0.62, el.y + 30 * U, el.w * 0.3, el.h - 60 * U, 14 * U);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fill();
      ctx.fillStyle = C.white;
      ctx.fillRect(el.x + 40 * U, el.y + 58 * U, el.w * 0.42, 26 * U);
      ctx.fillRect(el.x + 40 * U, el.y + 98 * U, el.w * 0.3, 26 * U);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(el.x + 40 * U, el.y + 142 * U, el.w * 0.36, 10 * U);
      rrect(el.x + 40 * U, el.y + 172 * U, 150 * U, 40 * U, 20 * U); ctx.fillStyle = C.ink; ctx.fill();
      text("SHOP NOW", el.x + 115 * U, el.y + 193 * U, { size: 15 * U, weight: 700, fam: "IN", spacing: 2 * U });
    } else if (el.k === "tile") {
      rrect(el.x, el.y, el.w, el.h, 12 * U); ctx.fillStyle = hexA(C.white, 0.06); ctx.fill();
      const cols = [[C.cyan, C.vio], [C.gold, C.pink], [C.pink, C.vio]][i - 2];
      rrect(el.x + 12 * U, el.y + 12 * U, el.w - 24 * U, el.h * 0.55, 10 * U);
      ctx.fillStyle = linGrad(el.x, el.y, el.x + el.w, el.y + el.h * 0.6, cols); ctx.fill();
      ctx.fillStyle = hexA(C.white, 0.7); ctx.fillRect(el.x + 14 * U, el.y + el.h * 0.55 + 28 * U, el.w * 0.5, 10 * U);
      ctx.fillStyle = C.gold; ctx.fillRect(el.x + 14 * U, el.y + el.h * 0.55 + 50 * U, el.w * 0.25, 10 * U);
    } else {
      ctx.fillStyle = hexA(C.white, 0.08);
      rrect(el.x, el.y, el.w, el.h, 8 * U); ctx.fill();
      for (let j = 0; j < 5; j++) { ctx.fillStyle = hexA(C.white, 0.25); ctx.fillRect(el.x + 20 * U + j * 110 * U, el.y + 14 * U, 70 * U, 8 * U); }
    }
    ctx.restore();
  });
  ctx.restore();

  // code card (develop)
  const cp = prog(lt, 1.3, 1.55) * (1 - prog(lt, 2.35, 2.6));
  if (cp > 0) {
    const kx = PORTRAIT ? bx + 20 * U : bx - 110 * U, ky = by + bh - 150 * U;
    const kw = 470 * U, kh = 230 * U;
    ctx.save();
    ctx.globalAlpha = cp * (1 - out);
    ctx.translate(0, (1 - E.outCubic(prog(lt, 1.3, 1.55))) * 40 * U);
    ctx.shadowBlur = 50 * U; ctx.shadowColor = "rgba(0,0,0,0.6)";
    rrect(kx, ky, kw, kh, 16 * U); ctx.fillStyle = "#0A0D22"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA(C.cyan, 0.4); ctx.lineWidth = 1.5 * U; ctx.stroke();
    const chars = Math.floor((lt - 1.38) / 0.0105);
    let used = 0;
    CODE.forEach((line, j) => {
      const n = clamp(chars - used, 0, line.length); used += line.length;
      if (n <= 0) return;
      const col = j === 0 || j === 4 ? C.white : C.cyan;
      text(line.slice(0, n), kx + 28 * U, ky + 42 * U + j * 38 * U, { size: 21 * U, weight: 500, fam: "JB", color: col, align: "left" });
    });
    ctx.restore();
  }

  // phone (launch)
  const pp = E.outCubic(prog(lt, 2.3, 2.75));
  if (pp > 0) {
    const pw = 240 * U, ph = 480 * U;
    const px = bx + bw - pw * 0.55 + (1 - pp) * 300 * U, py = by + bh - ph * 0.72;
    ctx.save();
    ctx.globalAlpha = clamp(pp * 2) * (1 - out);
    ctx.shadowBlur = 60 * U; ctx.shadowColor = "rgba(0,0,0,0.7)";
    rrect(px, py, pw, ph, 36 * U); ctx.fillStyle = "#0B0E24"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA(C.white, 0.5); ctx.lineWidth = 3 * U; ctx.stroke();
    const sx = px + 14 * U, sy = py + 14 * U, sw = pw - 28 * U;
    rrect(sx, sy + 20 * U, sw, 170 * U, 16 * U);
    ctx.fillStyle = linGrad(sx, sy, sx + sw, sy + 190 * U, [C.vio, C.pink]); ctx.fill();
    ctx.fillStyle = C.white; ctx.fillRect(sx + 18 * U, sy + 60 * U, sw * 0.6, 14 * U); ctx.fillRect(sx + 18 * U, sy + 84 * U, sw * 0.4, 14 * U);
    for (let j = 0; j < 2; j++) {
      rrect(sx + j * (sw / 2 + 4 * U), sy + 206 * U, sw / 2 - 4 * U, 120 * U, 12 * U);
      ctx.fillStyle = linGrad(sx, sy + 206 * U, sx + sw, sy + 326 * U, j ? [C.gold, C.pink] : [C.cyan, C.vio]); ctx.fill();
    }
    rrect(sx, sy + 344 * U, sw, 44 * U, 22 * U); ctx.fillStyle = C.cyan; ctx.fill();
    rrect(px + pw / 2 - 36 * U, py + 10 * U, 72 * U, 16 * U, 8 * U); ctx.fillStyle = "#000"; ctx.fill();
    ctx.restore();
  }
  // LIVE badge
  const lp = prog(lt, 2.55, 2.8);
  if (lp > 0) {
    const lx = bx + bw - 120 * U, ly = by + 30 * U;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(lx, ly); ctx.scale(E.outBack(lp), E.outBack(lp));
    rrect(-66 * U, -20 * U, 132 * U, 40 * U, 20 * U); ctx.fillStyle = hexA(C.green, 0.18); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 1.5 * U; ctx.stroke();
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(-38 * U, 0, 7 * U, 0, 6.283); ctx.fill();
    const rp = ((lt - 2.55) % 0.8) / 0.8;
    ctx.strokeStyle = hexA(C.green, 1 - rp); ctx.beginPath(); ctx.arc(-38 * U, 0, 7 * U + rp * 18 * U, 0, 6.283); ctx.stroke();
    text("LIVE", 12 * U, 1 * U, { size: 20 * U, weight: 700, fam: "JB", color: C.green, spacing: 3 * U });
    ctx.restore();
  }
  // growth chart (grow)
  const gp = prog(lt, 3.3, 3.55);
  if (gp > 0) {
    const gw = 400 * U, gh = 250 * U;
    const gx = PORTRAIT ? bx + bw - gw + 10 * U : bx + bw - gw + 90 * U;
    const gy = PORTRAIT ? by - 110 * U : by - 90 * U;
    ctx.save();
    ctx.globalAlpha = E.outCubic(gp) * (1 - out);
    ctx.translate(0, (1 - E.outCubic(gp)) * 40 * U);
    ctx.shadowBlur = 60 * U; ctx.shadowColor = "rgba(0,0,0,0.7)";
    rrect(gx, gy, gw, gh, 20 * U); ctx.fillStyle = "#0B0F27"; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA(C.white, 0.18); ctx.lineWidth = 1.5 * U; ctx.stroke();
    text("REVENUE", gx + 28 * U, gy + 36 * U, { size: 16 * U, weight: 500, fam: "JB", color: C.muted, align: "left", spacing: 3 * U });
    const tri = gx + gw - 110 * U;
    ctx.fillStyle = C.green;
    ctx.beginPath(); ctx.moveTo(tri, gy + 42 * U); ctx.lineTo(tri + 9 * U, gy + 28 * U); ctx.lineTo(tri + 18 * U, gy + 42 * U); ctx.fill();
    text("GROWING", tri + 26 * U, gy + 36 * U, { size: 16 * U, weight: 700, fam: "JB", color: C.green, align: "left" });
    const pts = [0.08, 0.14, 0.12, 0.24, 0.22, 0.36, 0.33, 0.5, 0.62, 0.58, 0.78, 0.95];
    const cx0 = gx + 28 * U, cy0 = gy + gh - 28 * U, cwid = gw - 56 * U, chei = gh - 100 * U;
    const dp = E.inOutCubic(prog(lt, 3.4, 4.1));
    const N = pts.length - 1, upto = dp * N;
    const P = (i) => [cx0 + (i / N) * cwid, cy0 - pts[i] * chei];
    const path = [];
    for (let i = 0; i <= Math.floor(upto); i++) path.push(P(i));
    if (upto < N) {
      const i = Math.floor(upto), f = upto - i, a = P(i), b = P(i + 1);
      path.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
    }
    if (path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(path[0][0], cy0);
      path.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(path[path.length - 1][0], cy0);
      ctx.fillStyle = linGrad(0, cy0 - chei, 0, cy0, [hexA(C.green, 0.35), hexA(C.green, 0)]);
      ctx.fill();
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = C.green; ctx.lineWidth = 4 * U; ctx.lineJoin = "round";
      ctx.shadowBlur = 20 * U; ctx.shadowColor = C.green;
      ctx.stroke();
      const tip = path[path.length - 1];
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 7 * U, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ============ SCENE 7 · global reach (21.5 – 25.5) ============
const PINS = [
  { n: "USA", lat: 39, lon: -98, t: 0.7 },
  { n: "Canada", lat: 57, lon: -104, t: 1.0 },
  { n: "UK", lat: 54, lon: -2, t: 1.7 },
  { n: "Australia", lat: -25, lon: 134, t: 2.5 },
];
function proj(lat, lon, lat0, lon0, R, cx, cy, rr = 1) {
  const f = lat * DEG, l = (lon - lon0) * DEG, f0 = lat0 * DEG;
  const x = Math.cos(f) * Math.sin(l);
  const y = Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l);
  const z = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l);
  return [cx + R * rr * x, cy - R * rr * y, z];
}
function s7(lt) {
  const out = E.inCubic(prog(lt, 3.7, 4.0));
  const lon0 = keyframes(lt, [[0, -165], [0.65, -104], [1.3, -86], [1.7, -14], [2.1, -2], [2.55, 128], [4, 146]]);
  const lat0 = keyframes(lt, [[0, 30], [1.8, 32], [2.55, 2], [4, 6]]);
  const gi = E.outBack(prog(lt, 0, 0.55));
  const R = (PORTRAIT ? 390 : 360) * U * lerp(0.6, 1, gi) * (1 + out * 0.2);
  const gcx = PORTRAIT ? CX : W * 0.33, gcy = PORTRAIT ? H * 0.34 : CY + 10 * U;
  ctx.save();
  ctx.globalAlpha = clamp(prog(lt, 0, 0.3)) * (1 - out);

  glowBlob(gcx, gcy, R * 1.6, C.vio, 0.35);
  const sg = ctx.createRadialGradient(gcx - R * 0.35, gcy - R * 0.4, R * 0.1, gcx, gcy, R);
  sg.addColorStop(0, "#1B2260"); sg.addColorStop(0.85, "#0A0E2A"); sg.addColorStop(1, "#1D2C70");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(gcx, gcy, R, 0, 6.283); ctx.fill();
  ctx.strokeStyle = hexA(C.cyan, 0.6); ctx.lineWidth = 2 * U;
  ctx.shadowBlur = 30 * U; ctx.shadowColor = C.cyan;
  ctx.stroke(); ctx.shadowBlur = 0;

  const front = new Path2D(), back = new Path2D();
  const seg = (pts) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay, az] = pts[i - 1], [bx, by, bz] = pts[i];
      const P = az > 0 && bz > 0 ? front : back;
      P.moveTo(ax, ay); P.lineTo(bx, by);
    }
  };
  for (let la = -75; la <= 75; la += 15) {
    const pts = []; for (let lo = -180; lo <= 180; lo += 5) pts.push(proj(la, lo, lat0, lon0, R, gcx, gcy)); seg(pts);
  }
  for (let lo = -180; lo < 180; lo += 15) {
    const pts = []; for (let la = -90; la <= 90; la += 5) pts.push(proj(la, lo, lat0, lon0, R, gcx, gcy)); seg(pts);
  }
  ctx.lineWidth = 1.2 * U;
  ctx.strokeStyle = hexA(C.white, 0.05); ctx.stroke(back);
  ctx.strokeStyle = hexA(C.cyan, 0.28); ctx.stroke(front);

  // arcs between successive pins
  const vec = (p) => [Math.cos(p.lat * DEG) * Math.cos(p.lon * DEG), Math.cos(p.lat * DEG) * Math.sin(p.lon * DEG), Math.sin(p.lat * DEG)];
  for (let i = 1; i < PINS.length; i++) {
    const ap = prog(lt, PINS[i].t - 0.05, PINS[i].t + 0.45);
    if (ap <= 0) continue;
    const a = vec(PINS[i - 1]), b = vec(PINS[i]);
    const om = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    const n = 40;
    const path = new Path2D();
    let started = false;
    for (let j = 0; j <= n * ap; j++) {
      const s = j / n;
      const k1 = Math.sin((1 - s) * om) / Math.sin(om), k2 = Math.sin(s * om) / Math.sin(om);
      const v = [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
      const lat = Math.asin(clamp(v[2], -1, 1)) / DEG, lon = Math.atan2(v[1], v[0]) / DEG;
      const [x, y, z] = proj(lat, lon, lat0, lon0, R, gcx, gcy, 1 + 0.22 * Math.sin(Math.PI * s));
      if (z < -0.15) { started = false; continue; }
      if (!started) { path.moveTo(x, y); started = true; } else path.lineTo(x, y);
    }
    ctx.save();
    ctx.strokeStyle = C.pink; ctx.lineWidth = 3 * U; ctx.lineCap = "round";
    ctx.shadowBlur = 16 * U; ctx.shadowColor = C.pink;
    ctx.stroke(path);
    ctx.restore();
  }
  // pins
  PINS.forEach((pn) => {
    const pp = prog(lt, pn.t, pn.t + 0.35);
    if (pp <= 0) return;
    const [x, y, z] = proj(pn.lat, pn.lon, lat0, lon0, R, gcx, gcy);
    if (z < 0.02) return;
    const va = clamp(z * 4);
    ctx.save();
    ctx.globalAlpha *= va;
    for (let r = 0; r < 2; r++) {
      const rp = (((lt - pn.t) + r * 0.6) % 1.2) / 1.2;
      ctx.strokeStyle = hexA(C.pink, 0.8 * (1 - rp));
      ctx.lineWidth = 2 * U;
      ctx.beginPath(); ctx.arc(x, y, 8 * U + rp * 46 * U, 0, 6.283); ctx.stroke();
    }
    ctx.shadowBlur = 24 * U; ctx.shadowColor = C.pink;
    ctx.fillStyle = C.white;
    ctx.beginPath(); ctx.arc(x, y, 9 * U * E.outBack(pp), 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    const lw = measure(pn.n, 700, 22 * U, "IN") + 36 * U;
    ctx.translate(x + 22 * U, y - 46 * U);
    ctx.scale(E.outBack(pp), E.outBack(pp));
    rrect(0, -20 * U, lw, 40 * U, 20 * U); ctx.fillStyle = "rgba(10,13,34,0.9)"; ctx.fill();
    ctx.strokeStyle = hexA(C.pink, 0.8); ctx.lineWidth = 1.5 * U; ctx.stroke();
    text(pn.n, lw / 2, 1 * U, { size: 22 * U, weight: 700, fam: "IN" });
    ctx.restore();
  });

  // copy
  const tx = PORTRAIT ? CX : W * 0.6;
  const al = PORTRAIT ? "center" : "left";
  const ty = PORTRAIT ? H * 0.64 : CY - 170 * U;
  const ta = E.outCubic(prog(lt, 0.2, 0.6));
  text("GLOBAL REACH", tx, ty - 70 * U, { size: 22 * U, weight: 500, fam: "JB", spacing: 8 * U, color: C.cyan, align: al, alpha: ta });
  text("Trusted worldwide.", tx + (PORTRAIT ? 0 : (1 - ta) * 40 * U), ty, { size: 84 * U, weight: 700, fam: "SG", align: al, alpha: ta, maxW: PORTRAIT ? W * 0.88 : W * 0.37 });
  // countries line, each word lands with its pin
  const sep = "  ·  ";
  const full = PINS.map((p) => p.n).join(sep);
  const cs = Math.min(34 * U, (PORTRAIT ? W * 0.86 : W * 0.37) / (measure(full, 500, 34 * U, "IN") / (34 * U)));
  let cx = PORTRAIT ? CX - measure(full, 500, cs, "IN") / 2 : tx;
  PINS.forEach((pn, i) => {
    const a = E.outCubic(prog(lt, pn.t, pn.t + 0.3));
    const str = (i ? sep : "") + pn.n;
    text(str, cx, ty + 90 * U + (1 - a) * 20 * U, { size: cs, weight: 500, fam: "IN", color: "#C9D0F0", align: "left", alpha: a });
    cx += measure(str, 500, cs, "IN");
  });
  // badges
  const BADGES = ["BigCommerce Partner", "Shopify Partner", "Certified Magento Developers"];
  BADGES.forEach((b, i) => {
    const bp = prog(lt, 2.95 + i * 0.15, 3.3 + i * 0.15);
    if (bp <= 0) return;
    const bs = 26 * U;
    const bw = measure(b, 500, bs, "IN") + 86 * U, bh = 58 * U;
    const bx = PORTRAIT ? CX - bw / 2 : tx;
    const by = ty + 170 * U + i * 76 * U;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(E.outBack(bp), E.outBack(bp));
    ctx.globalAlpha *= clamp(bp * 3);
    rrect(0, 0, bw, bh, bh / 2);
    ctx.fillStyle = hexA(C.white, 0.06); ctx.fill();
    ctx.strokeStyle = hexA(C.cyan, 0.5); ctx.lineWidth = 1.5 * U; ctx.stroke();
    ctx.fillStyle = C.cyan;
    ctx.beginPath(); ctx.arc(32 * U, bh / 2, 16 * U, 0, 6.283); ctx.fill();
    check(32 * U, bh / 2, 20 * U, C.ink);
    text(b, 62 * U, bh / 2 + 1 * U, { size: bs, weight: 500, fam: "IN", align: "left" });
    ctx.restore();
  });
  ctx.restore();
}

// ============ SCENE 8 · finale (25.5 – 30) ============
function s8(lt) {
  // implosion
  if (lt < 0.5) {
    const p = prog(lt, 0, 0.5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    BURST2.forEach((b) => {
      const r0 = (0.35 + b.d * 0.7) * Math.hypot(W, H) * 0.6;
      const r = r0 * (1 - E.inCubic(p));
      const x = CX + Math.cos(b.a) * r, y = CY + Math.sin(b.a) * r;
      const x2 = CX + Math.cos(b.a) * (r + 40 * U + p * 120 * U), y2 = CY + Math.sin(b.a) * (r + 40 * U + p * 120 * U);
      ctx.strokeStyle = hexA(b.c, 0.3 + 0.6 * p);
      ctx.lineWidth = b.s * U * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    });
    glowBlob(CX, CY, lerp(40, 380, E.inCubic(p)) * U, C.white, 0.9 * p);
    glowBlob(CX, CY, lerp(80, 700, E.inCubic(p)) * U, C.vio, 0.7 * p);
    ctx.restore();
    return;
  }
  const l = lt - 0.5;
  const fade = prog(lt, 3.9, 4.5);
  shockwave(l, C.cyan);
  particles(BURST2, l, CX, CY - 60 * U);
  ctx.save();
  const z = lerp(1.0, 1.05, l / 4);
  ctx.translate(CX, CY); ctx.scale(z, z); ctx.translate(-CX, -CY);
  const cy = PORTRAIT ? CY - 200 * U : CY - 150 * U;
  const bottom = logo(l, cy);
  // headline, word by word
  const words = "Let's build what's next.".split(" ");
  const hs = Math.min(60 * U, (W * 0.88) / (measure(words.join(" "), 700, 60 * U, "SG") / (60 * U)));
  const hw = measure(words.join(" "), 700, hs, "SG");
  let hx = CX - hw / 2;
  const hy = bottom + 110 * U;
  words.forEach((w, i) => {
    const wp = E.outExpo(prog(l, 0.55 + i * 0.08, 0.95 + i * 0.08));
    text(w, hx, hy + (1 - wp) * 40 * U, { size: hs, weight: 700, fam: "SG", align: "left", alpha: wp,
      ...(i === words.length - 1 ? { grad: [C.cyan, C.pink] } : {}) });
    hx += measure(w + " ", 700, hs, "SG");
  });
  // URL pill
  const up = prog(l, 1.15, 1.4);
  if (up > 0) {
    const url = "blisswebsolution.com";
    const us = 36 * U;
    const uw = measure(url, 500, us, "JB") + 90 * U, uh = 76 * U;
    const ux = CX - uw / 2, uy = hy + 70 * U;
    ctx.save();
    ctx.globalAlpha = E.outCubic(up);
    rrect(ux, uy, uw, uh, uh / 2);
    ctx.fillStyle = hexA(C.cyan, 0.08); ctx.fill();
    ctx.strokeStyle = linGrad(ux, 0, ux + uw, 0, [C.vio, C.cyan, C.pink]); ctx.lineWidth = 2.5 * U; ctx.stroke();
    const n = clamp(Math.floor((l - 1.2) / 0.045) + 1, 0, url.length);
    const x0 = ux + 45 * U;
    text(url.slice(0, n), x0, uy + uh / 2 + 1 * U, { size: us, weight: 500, fam: "JB", color: C.white, align: "left" });
    if (n < url.length || Math.floor(l * 3) % 2 === 0) {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(x0 + measure(url.slice(0, n), 500, us, "JB") + 6 * U, uy + uh / 2 - us * 0.45, 3 * U, us * 0.9);
    }
    ctx.restore();
  }
  text("E-COMMERCE  ·  WEB  ·  MOBILE  ·  MARKETING", CX, hy + 210 * U, {
    size: 20 * U, weight: 500, fam: "JB", spacing: 5 * U, color: C.muted, alpha: prog(l, 2.0, 2.5), maxW: W * 0.88,
  });
  ctx.restore();
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${E.inOutCubic(fade)})`;
    ctx.fillRect(-100, -100, W + 200, H + 200);
  }
}

// ---------- frame ----------
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  if (t >= 2.5) background(t, t < 25.5 ? 1 : 0.6);
  const [sx, sy] = shake(t);
  ctx.translate(sx, sy);
  if (t < 2.5) s1(t);
  else if (t < 6) s2(t - 2.5);
  else if (t < 10) s3(t - 6);
  else if (t < 13) s4(t - 10);
  else if (t < 17) s5(t - 13);
  else if (t < 21.5) s6(t - 17);
  else if (t < 25.5) s7(t - 21.5);
  else s8(t - 25.5);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  hud(t);
  streaks(t);
  flash(t);
  finish(t);
}

window.render = render;
window.DURATION = DURATION;
window.ready = document.fonts.load("700 20px SG").then(() => Promise.all([
  document.fonts.load("500 20px SG"), document.fonts.load("400 20px IN"), document.fonts.load("500 20px IN"),
  document.fonts.load("700 20px IN"), document.fonts.load("500 20px JB"),
])).then(() => { render(0); return true; });

// live preview: reel.html?play=1 (click to start, audio from out/reel-audio.wav)
if (params.get("play")) {
  document.body.classList.add("preview");
  const audio = new Audio("out/reel-audio.wav");
  let t0 = null;
  window.ready.then(() => {
    render(0);
    document.body.addEventListener("click", () => {
      audio.currentTime = 0; audio.play(); t0 = performance.now();
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        render(Math.min(t, DURATION - 0.001));
        if (t < DURATION) requestAnimationFrame(loop);
      };
      loop();
    });
  });
}
