// The details drawn on a blade: its ground bevels, each kind's fuller,
// ridge, grooves or hamon (see detail in blades.js), the pattern of a
// pattern-welded billet, and a day's decoration. Only for show.
//
// Everything is laid out in lanes across an outline (see outline in
// blades.js): lane 0 runs along its top line, lane 1 along its bottom one,
// so a detail keeps its place as the blade widens, narrows and comes to
// its point. Along the blade, places are counted in the outline's samples
// (s, which needn't be whole).

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const POINT = 12; // outline's point is this many samples

// mulberry32: a small, fast seeded PRNG (as in game.js).
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// across is the point a share f of the way from the outline's top line to
// its bottom line, s samples along it.
function across(shape, s, f) {
  const n = shape.top.length;
  const i = clamp(Math.floor(s), 0, n - 2), t = clamp(s - i, 0, 1);
  const at = (line) => [lerp(line[i][0], line[i + 1][0], t), lerp(line[i][1], line[i + 1][1], t)];
  const [tx, ty] = at(shape.top), [bx, by] = at(shape.bottom);
  return [lerp(tx, bx, f), lerp(ty, by, f)];
}

// heightAt reads a bevel's height at x mm along the blade: h is one height
// for the whole edge, or its heights strip by strip, tang to point.
function heightAt(h, x, length) {
  if (!Array.isArray(h)) return h;
  const f = clamp((x / length) * h.length - 0.5, 0, h.length - 1);
  const j = Math.min(h.length - 2, Math.floor(f));
  return lerp(h[j], h[j + 1], f - j);
}

// PATTERNS are the ways a pattern-welded billet's layers can show, and
// what the commission calls them.
export const PATTERNS = { wild: "random", ladder: "ladder", raindrop: "raindrop", twist: "twist" };

// patternLines draws a billet's layers as lines in lanes: each is a list
// of [s, f] places. n is the outline's number of samples.
function patternLines(kind, n, seed) {
  const rand = mulberry32(seed);
  const end = n - 1.5;
  const lines = [];
  // The layers' own wander, the same for all of them so they never cross.
  const w = [0, 1, 2].map(() => ({ k: 0.25 + rand() * 0.5, p: rand() * 7, a: 0.3 + rand() * 0.7 }));
  const wander = (s) => w.reduce((sum, { k, p, a }) => sum + a * Math.sin(k * s + p), 0) / 2;
  const layers = (count, bend) => {
    for (let k = 0; k < count; k++) {
      const base = (k + 0.5) / count;
      const own = { k: 0.6 + rand() * 0.6, p: rand() * 7 };
      const line = [];
      for (let s = 0; s <= end; s += 0.25) {
        const f = base + bend(s, base) + (0.22 / count) * Math.sin(own.k * s + own.p);
        line.push([s, clamp(f, 0.02, 0.98)]);
      }
      lines.push(line);
    }
  };
  if (kind === "ladder") {
    // Rungs: every so often the layers above the middle swell up and the
    // ones below swell down, opening an eye across the blade.
    layers(9, (s, base) => 0.09 * Math.sin((2 * Math.PI * s) / 3.4) * (2 * base - 1) * 2 * Math.min(base, 1 - base) * 2.2 + (0.25 / 9) * wander(s));
  } else if (kind === "raindrop") {
    layers(6, (s) => (0.5 / 6) * wander(s));
    // Drops: rings where the billet was drilled and forged flat.
    for (let j = 0, s0 = 2.2; s0 < end - 2; j++, s0 += 2.9) {
      const f0 = j % 2 ? 0.68 : 0.32;
      for (const r of [1, 0.66, 0.33]) {
        const ring = [];
        for (let a = 0; a <= 16; a++) ring.push([s0 + 1.05 * r * Math.cos((a * Math.PI) / 8), clamp(f0 + 0.24 * r * Math.sin((a * Math.PI) / 8), 0.02, 0.98)]);
        lines.push(ring);
      }
    }
  } else if (kind === "twist") {
    // Two twisted bars side by side, turned opposite ways: chevrons.
    for (let s0 = -0.6; s0 < end; s0 += 0.62) {
      const line = [];
      for (let t = 0; t <= 12; t++) {
        const f = 0.04 + (0.92 * t) / 12;
        const s = s0 + 1.25 * (1 - Math.abs(2 * f - 1)) ** 0.8 + 0.08 * Math.sin(9 * f + s0);
        if (s >= 0 && s <= end) line.push([s, f]);
      }
      if (line.length > 1) lines.push(line);
    }
  } else {
    layers(10, (s) => (0.9 / 10) * wander(s));
  }
  return lines;
}

// GLYPHS are the letters and marks inlaid in blades, as strokes in a box
// one wide and one tall: Roman capitals, and a few runes (r: names).
const GLYPHS = {
  "+": [[[0.5, 0.15], [0.5, 0.85]], [[0.15, 0.5], [0.85, 0.5]]],
  B: [[[0.15, 0], [0.15, 1], [0.7, 1], [0.85, 0.75], [0.7, 0.5], [0.15, 0.5]], [[0.7, 0.5], [0.8, 0.25], [0.65, 0], [0.15, 0]]],
  D: [[[0.15, 0], [0.15, 1], [0.6, 1], [0.85, 0.7], [0.85, 0.3], [0.6, 0], [0.15, 0]]],
  E: [[[0.85, 0], [0.15, 0], [0.15, 1], [0.85, 1]], [[0.15, 0.5], [0.7, 0.5]]],
  F: [[[0.15, 1], [0.15, 0], [0.85, 0]], [[0.15, 0.5], [0.7, 0.5]]],
  H: [[[0.15, 0], [0.15, 1]], [[0.85, 0], [0.85, 1]], [[0.15, 0.5], [0.85, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]]],
  L: [[[0.15, 0], [0.15, 1], [0.85, 1]]],
  M: [[[0.1, 1], [0.1, 0], [0.5, 0.6], [0.9, 0], [0.9, 1]]],
  N: [[[0.15, 1], [0.15, 0], [0.85, 1], [0.85, 0]]],
  O: [[[0.5, 0], [0.85, 0.25], [0.85, 0.75], [0.5, 1], [0.15, 0.75], [0.15, 0.25], [0.5, 0]]],
  R: [[[0.15, 1], [0.15, 0], [0.7, 0], [0.85, 0.25], [0.7, 0.5], [0.15, 0.5]], [[0.5, 0.5], [0.85, 1]]],
  T: [[[0.1, 0], [0.9, 0]], [[0.5, 0], [0.5, 1]]],
  V: [[[0.1, 0], [0.5, 1], [0.9, 0]]],
  "r:f": [[[0.3, 1], [0.3, 0]], [[0.3, 0.35], [0.8, 0.05]], [[0.3, 0.65], [0.8, 0.35]]],
  "r:u": [[[0.2, 1], [0.2, 0], [0.8, 0.4], [0.8, 1]]],
  "r:th": [[[0.3, 0], [0.3, 1]], [[0.3, 0.25], [0.75, 0.5], [0.3, 0.75]]],
  "r:o": [[[0.2, 1], [0.8, 0.4], [0.5, 0], [0.2, 0.4], [0.8, 1]]],
  "r:r": [[[0.25, 1], [0.25, 0], [0.75, 0.25], [0.25, 0.5], [0.75, 1]]],
  "r:k": [[[0.3, 0], [0.3, 1]], [[0.3, 0.5], [0.75, 1]]],
  "r:g": [[[0.15, 0], [0.85, 1]], [[0.85, 0], [0.15, 1]]],
  "r:w": [[[0.3, 1], [0.3, 0], [0.75, 0.25], [0.3, 0.5]]],
  "r:h": [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.8, 1]], [[0.2, 0.35], [0.8, 0.65]]],
  "r:n": [[[0.5, 0], [0.5, 1]], [[0.25, 0.35], [0.75, 0.65]]],
  "r:i": [[[0.5, 0], [0.5, 1]]],
  "r:t": [[[0.5, 1], [0.5, 0]], [[0.2, 0.3], [0.5, 0], [0.8, 0.3]]],
  "r:b": [[[0.25, 0], [0.25, 1], [0.75, 0.75], [0.25, 0.5], [0.75, 0.25], [0.25, 0]]],
  "r:m": [[[0.15, 1], [0.15, 0], [0.85, 0.5]], [[0.85, 1], [0.85, 0], [0.15, 0.5]]],
  "r:l": [[[0.3, 1], [0.3, 0], [0.75, 0.35]]],
};

// decorLines lays a decoration out in lanes, as { cls, lines, closed }
// (lines of [s, f] places). body is the last sample before the point.
function decorLines(decor, shape, body) {
  const out = [];
  if (decor.kind === "inscription") {
    // Glyphs between two lanes, as wide as 0.8 of their height.
    const [f0, f1] = decor.in;
    const s0 = decor.from * body;
    const tall = (f1 - f0) * Math.hypot(...across(shape, s0, 1).map((v, k) => v - across(shape, s0, 0)[k]));
    const step = Math.hypot(...across(shape, s0 + 1, 0.5).map((v, k) => v - across(shape, s0, 0.5)[k]));
    const wide = (0.8 * tall) / step; // a glyph's width, in samples
    const lines = [];
    decor.text.forEach((ch, j) => {
      for (const stroke of GLYPHS[ch] || []) lines.push(stroke.map(([x, y]) => [s0 + (j * 1.25 + x) * wide, lerp(f0, f1, y)]));
    });
    out.push({ cls: `inlay ${decor.gilt ? "gilt" : "dark"}`, lines });
  } else if (decor.kind === "stars") {
    // Seven stars down the blade, joined like the Plough.
    const at = [[0.12, 0.42], [0.22, 0.6], [0.33, 0.44], [0.45, 0.58], [0.58, 0.42], [0.7, 0.6], [0.82, 0.46]].map(([x, f]) => [x * body, f]);
    out.push({ cls: "inlay gilt", lines: [at] });
    const r = 0.1;
    const span = Math.hypot(...across(shape, at[0][0], 1).map((v, k) => v - across(shape, at[0][0], 0)[k]));
    const step = Math.hypot(...across(shape, at[0][0] + 1, 0.5).map((v, k) => v - across(shape, at[0][0], 0.5)[k]));
    out.push({
      cls: "stud", closed: true,
      lines: at.map(([s, f]) => Array.from({ length: 8 }, (_, a) => [s + ((r * span) / step) * Math.cos((a * Math.PI) / 4), f + r * Math.sin((a * Math.PI) / 4)])),
    });
  } else if (decor.kind === "cartouche") {
    // A gilt lozenge on the flat by the guard, with a dot in it.
    const [f0, f1] = decor.in;
    const s0 = decor.from * body, s1 = s0 + decor.long * body;
    const fm = (f0 + f1) / 2, sm = (s0 + s1) / 2;
    out.push({ cls: "plate", closed: true, lines: [[[s0, fm], [sm, f0], [s1, fm], [sm, f1]]] });
    out.push({ cls: "inlay dark", lines: [[[lerp(s0, s1, 0.3), fm], [lerp(s0, s1, 0.7), fm]]] });
  }
  return out;
}

// bladeDetail gives a blade's details as shapes to draw over its steel,
// back to front: { cls, lines, closed }, each line a list of points in
// the outline's own coordinates (see detailPath). bevels is how high each
// edge's bevel is ground, as a share of its span (the bottom edge first;
// one height or one per strip), or left out for a blade not yet ground.
// hamon is whether a blade that shows one has been hardened. pattern is a
// pattern-welded billet's ({ kind, seed }) and decor a decoration (see
// decor in blades.js); both are left off a blade that isn't finished.
export function bladeDetail(blade, shape, { bevels = null, hamon = false, pattern = null, decor = null } = {}) {
  const n = shape.top.length;
  const body = n - 1 - POINT; // the last sample before the point
  const d = blade.detail || {};
  const two = blade.edges === 2;
  const out = [];
  const add = (cls, pts, closed = false) => out.push({ cls, lines: [pts], closed });
  const lane = (f, a = 0, b = n - 1) => {
    const pts = [];
    for (let i = a; i <= b; i++) pts.push(across(shape, i, typeof f === "function" ? f(i) : f));
    return pts;
  };
  const index = (share) => Math.round(share * body);
  const place = (lines) => lines.map((line) => line.map(([s, f]) => across(shape, s, f)));

  // The billet's layers, etched to show, under everything else.
  if (pattern) {
    const layers = place(patternLines(pattern.kind, n, pattern.seed));
    out.push({ cls: "pattern", lines: layers.filter((_, k) => k % 2 === 0), closed: false });
    out.push({ cls: "pattern pale", lines: layers.filter((_, k) => k % 2 === 1), closed: false });
  }

  // The bevels: each edge's ground face, and the line it's ground up to.
  // An edge's span is the whole width, or half of it on a two-edged blade,
  // whose upper bevel catches the light and whose lower one is in shade.
  const bevelLane = [];
  if (bevels) {
    const k = two ? 0.5 : 1;
    for (let e = 0; e < blade.edges; e++) {
      const f = (i) => {
        const h = clamp(heightAt(bevels[e], shape.top[i][0], shape.length), 0, 1);
        return e ? k * h : 1 - k * h;
      };
      const line = lane(f);
      add(`bevel ${two && !e ? "shade" : "lit"}`, [...line, ...lane(e ? 0 : 1).reverse()], true);
      add("bevel-line", line);
      bevelLane[e] = f;
    }
    // A glint or two along the lit bevel, and the thickness of a
    // one-edged blade's back.
    const lit = bevelLane[two ? 1 : 0];
    const mid = (i) => (two ? lit(i) / 2 : (1 + lit(i)) / 2);
    for (const [a, b] of [[0.08, 0.24], [0.27, 0.3]]) add("glint", lane(mid, index(a), index(b)));
    if (!two) add("back", lane(0.07, 0, body));
  }

  // A fuller: a groove between two lanes, running out to nothing at its
  // far end (and at its near end, when it starts clear of the guard).
  const fullers = [d.fuller, decor && decor.kind === "fuller" && decor].filter(Boolean);
  for (const fu of fullers) {
    const [f0, f1] = fu.at;
    const a = index(fu.from), b = index(fu.to);
    const mid = (f0 + f1) / 2;
    const taper = Math.max(2, Math.round((b - a) * 0.12));
    const open = (i) => Math.min(1, (b - i) / taper, fu.from > 0 ? (i - a) / taper : 1) ** 0.5;
    const upper = lane((i) => lerp(mid, f0, open(i)), a, b);
    const lower = lane((i) => lerp(mid, f1, open(i)), a, b);
    add("fuller", [...upper, ...lower.slice().reverse()], true);
    add("fuller-shade", upper);
    add("fuller-lip", lower);
  }
  // A ridge down the middle, to the very point.
  if (d.ridge) add("ridge", lane(0.5, index(d.ridge[0]), n - 1));
  // Narrow grooves cut along the blade.
  if (d.grooves) for (const f of d.grooves.at) add("groove", lane(f, index(d.grooves.from), index(d.grooves.to)));

  // The katana's hamon, once it's hardened: the hard edge shows paler, up
  // to a wavy line, and the yokote marks off the point.
  if (d.hamon && hamon) {
    const wave = (i) => 1 - (0.25 + 0.05 * Math.sin(i * 1.3) + 0.03 * Math.sin(i * 2.9 + 1));
    add("hamon", [...lane(wave, 1, n - 1), ...lane(1, 1, n - 1).reverse()], true);
    add("hamon-line", lane(wave, 1, n - 1));
  }
  if (d.yokote && bevelLane[0]) add("yokote", [across(shape, body, bevelLane[0](body)), across(shape, body, 1)]);

  // The day's decoration, inlaid over the rest.
  if (decor && decor.kind !== "fuller") for (const part of decorLines(decor, shape, body)) out.push({ closed: false, ...part, lines: place(part.lines) });
  return out;
}

// detailPath turns one of bladeDetail's shapes into an SVG path, scaled,
// moved and bent as outlinePath (in blades.js) does the outline.
export function detailPath({ lines, closed }, { sx = 1, sy = 1, dx = 0, dy = 0, bend = () => 0 } = {}) {
  return lines
    .map((pts) => `M${pts.map(([x, y]) => `${(x * sx + dx).toFixed(2)},${(y * sy + dy + bend(x)).toFixed(2)}`).join("L")}${closed ? "Z" : ""}`)
    .join("");
}
