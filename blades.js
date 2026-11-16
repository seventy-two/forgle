// The kinds of blade a commission can ask for, and drawing a blade's
// outline from its section widths.
//
// A blade lies along x from the tang (0) to the point, edge down. Each
// template gives its width along the blade as profile(x), a share of its
// base width for x from 0 (by the guard) to 1 (where the point starts).
// Single-edged blades keep either their spine or their edge straight while
// the width changes (align), and some are curved: curve.amount mm at the
// point, growing as (x/L)^power, negative for up. bevel is how high the
// grind line runs, as a share of the way from the edge to the spine (to the
// centre line on double-edged blades). detail is what's drawn on the blade
// for show (see detail.js): a fuller between two lanes across the blade
// (at, shares of its width from the top line) over a stretch of its body
// (from and to, shares of its length short of the point), a ridge down the
// middle over a stretch of it, grooves along lanes, a hamon, a yokote.
// decor lists the decorations a commission may ask for on some days: an
// inscription inlaid between two lanes (text is its glyphs, see detail.js),
// seven inlaid stars, a gilt cartouche, or a second fuller.
//
// The first twelve are the blades the game began with; the rest joined on
// 20 Nov 2026 (see bladeForDay in game.js), so the first twelve must stay
// first.

export const TIP_STYLES = {
  // len is the point's length as a multiple of the last section's width;
  // frac is how far down the blade the point sits (0 the top, 1 the bottom);
  // up and low are the top and bottom curves' control points.
  acute: { len: 1.5, frac: 0.5, up: [0.5, 0.3], low: [0.5, 0.3] },
  long: { len: 2.2, frac: 0.5, up: [0.5, 0.5], low: [0.5, 0.5] },
  rounded: { len: 0.7, frac: 0.5, up: [0.6, 0.1], low: [0.6, 0.1] },
  kissaki: { len: 1.0, frac: 0.12, up: [0.5, 0.5], low: [0.75, 0] },
  clip: { len: 1.0, frac: 0.42, up: [0.5, 0.5], low: [0.7, 0] },
  needle: { len: 2.4, frac: 0.22, up: [0.5, 0.5], low: [0.6, 0.1] },
  seax: { len: 1.6, frac: 0.9, up: [0.5, 0.5], low: [0.5, 0.5] },
  falcata: { len: 1.2, frac: 0.3, up: [0.5, 0.6], low: [0.6, 0] },
};

// A bo-hi: the groove some Japanese blades carry along the back.
const BOHI = { kind: "fuller", name: "a bo-hi, a groove along the back", at: [0.05, 0.19], from: 0.02, to: 0.8 };

export const BLADES = [
  {
    id: "gladius", name: "gladius", edges: 2, tip: "long", length: [480, 560], width: [50, 56], bevel: [0.55, 0.7], hardness: [55, 58],
    profile: (x) => 1 - 0.09 * Math.sin(Math.PI * x),
    detail: { ridge: [0, 1] },
    about: "The Roman legionary's short stabbing sword, with a slight waist and a long triangular point.",
  },
  {
    id: "seax", name: "Viking seax", edges: 1, align: "edge", tip: "seax", length: [320, 450], width: [38, 46], bevel: [0.25, 0.35], hardness: [57, 60],
    profile: (x) => 0.88 + 0.22 * Math.min(x / 0.7, 1) - (x > 0.7 ? ((x - 0.7) / 0.3) * 0.35 : 0),
    detail: { grooves: { at: [0.13, 0.2], from: 0.04, to: 0.68 } },
    decor: [{ kind: "inscription", name: "runes cut along the back", text: ["r:f", "r:u", "r:th", "r:o", "r:r", "r:k", "r:g", "r:w", "r:h", "r:n", "r:i", "r:t", "r:b", "r:m", "r:l"], in: [0.28, 0.5], from: 0.1 }],
    about: "A heavy single-edged blade whose spine breaks sharply down to the point.",
  },
  {
    id: "katana", name: "katana", edges: 1, align: "spine", tip: "kissaki", length: [680, 730], width: [30, 33], bevel: [0.7, 0.8], hardness: [60, 62],
    curve: { amount: [-20, -15], power: 2 }, steels: ["w2", "1095"],
    profile: (x) => 1 - 0.28 * x,
    detail: { hamon: true, yokote: true },
    decor: [BOHI],
    about: "The samurai's curved sword, tapering gently to a short, strong kissaki.",
  },
  {
    id: "falchion", name: "falchion", edges: 1, align: "spine", tip: "clip", length: [700, 800], width: [42, 50], bevel: [0.35, 0.5], hardness: [55, 58],
    profile: (x) => 1 + 0.45 * Math.pow(x, 1.5),
    detail: { fuller: { at: [0.07, 0.24], from: 0.03, to: 0.6 } },
    about: "A medieval chopper that widens towards the point for weight in the cut.",
  },
  {
    id: "shamshir", name: "shamshir", edges: 1, align: "spine", tip: "needle", length: [760, 840], width: [30, 35], bevel: [0.6, 0.7], hardness: [57, 60],
    curve: { amount: [-95, -70], power: 2.4 }, profile: (x) => 1 - 0.18 * x,
    detail: { fuller: { at: [0.08, 0.22], from: 0.03, to: 0.55 } },
    decor: [{ kind: "cartouche", name: "a gilt cartouche by the guard", in: [0.3, 0.58], from: 0.05, long: 0.07 }],
    about: "A Persian sabre with a deep, sweeping curve and a needle point.",
  },
  {
    id: "arming", name: "arming sword", edges: 2, tip: "acute", length: [740, 800], width: [48, 52], bevel: [0.55, 0.75], hardness: [54, 57],
    profile: (x) => 1 - 0.42 * x,
    detail: { fuller: { at: [0.41, 0.59], from: 0, to: 0.6 } },
    decor: [{ kind: "inscription", name: "+INNOMINEDOMINI+ inlaid in the fuller", gilt: true, text: [..."+INNOMINEDOMINI+"], in: [0.42, 0.58], from: 0.05 }],
    about: "The knight's one-handed sword: straight, double-edged and tapering to an acute point.",
  },
  {
    id: "viking", name: "Viking sword", edges: 2, tip: "rounded", length: [760, 840], width: [54, 60], bevel: [0.45, 0.6], hardness: [54, 57],
    profile: (x) => 1 - 0.22 * x,
    detail: { fuller: { at: [0.34, 0.66], from: 0, to: 0.85 } },
    decor: [{ kind: "inscription", name: "+VLFBERH+T inlaid in the fuller", text: [..."+VLFBERH+T"], in: [0.39, 0.61], from: 0.07 }],
    about: "A broad, double-edged cutting sword with little taper and a rounded point.",
  },
  {
    id: "jian", name: "jian", edges: 2, tip: "acute", length: [650, 740], width: [34, 40], bevel: [0.5, 0.65], hardness: [56, 59],
    profile: (x) => 1 - 0.18 * x,
    detail: { ridge: [0, 1] },
    decor: [{ kind: "stars", name: "seven brass stars down the blade" }],
    about: "The Chinese straight sword: slender, double-edged and quick.",
  },
  {
    id: "messer", name: "messer", edges: 1, align: "spine", tip: "clip", length: [700, 800], width: [38, 45], bevel: [0.35, 0.5], hardness: [55, 58],
    profile: (x) => 1 - 0.08 * x,
    detail: { fuller: { at: [0.08, 0.24], from: 0.03, to: 0.68 } },
    about: "The German 'long knife': a single-edged sword with a clipped point.",
  },
  {
    id: "longsword", name: "longsword", edges: 2, tip: "acute", length: [880, 980], width: [48, 54], bevel: [0.55, 0.75], hardness: [54, 57],
    profile: (x) => 1 - 0.5 * x,
    detail: { fuller: { at: [0.42, 0.58], from: 0, to: 0.36 }, ridge: [0.36, 1] },
    decor: [{ kind: "inscription", name: "crosses and rings inlaid in the fuller", gilt: true, text: [..."+O+O+"], in: [0.43, 0.57], from: 0.06 }],
    about: "A two-handed sword with a strong taper for thrusting through gaps.",
  },
  {
    id: "cutlass", name: "cutlass", edges: 1, align: "spine", tip: "clip", length: [640, 720], width: [36, 42], bevel: [0.35, 0.5], hardness: [54, 57],
    curve: { amount: [-18, -10], power: 2 }, profile: (x) => 1 + 0.06 * Math.sin(Math.PI * x),
    detail: { fuller: { at: [0.08, 0.26], from: 0.03, to: 0.72 } },
    about: "A short, broad sailor's sabre with a gentle curve.",
  },
  {
    id: "falcata", name: "falcata", edges: 1, align: "spine", tip: "falcata", length: [460, 560], width: [45, 52], bevel: [0.4, 0.55], hardness: [55, 58],
    curve: { amount: [20, 30], power: 2 }, profile: (x) => 0.8 + 0.45 * Math.sin(Math.PI * x * 0.85),
    detail: { grooves: { at: [0.1, 0.17, 0.24], from: 0.05, to: 0.72 } },
    about: "An Iberian sword whose forward-curved blade swells towards the point.",
  },
  {
    id: "wakizashi", name: "wakizashi", edges: 1, align: "spine", tip: "kissaki", length: [500, 580], width: [28, 31], bevel: [0.7, 0.8], hardness: [59, 61],
    curve: { amount: [-12, -8], power: 2 }, steels: ["w2", "1095"],
    profile: (x) => 1 - 0.22 * x,
    detail: { hamon: true, yokote: true },
    decor: [BOHI],
    about: "The katana's short companion, worn beside it and kept on indoors.",
  },
  {
    id: "nodachi", name: "nodachi", edges: 1, align: "spine", tip: "kissaki", length: [900, 980], width: [33, 36], bevel: [0.7, 0.8], hardness: [58, 60],
    curve: { amount: [-36, -28], power: 2 }, steels: ["w2", "1095"],
    profile: (x) => 1 - 0.3 * x,
    detail: { hamon: true, yokote: true },
    decor: [BOHI],
    about: "A great field sword, too long to draw from the hip and carried across the back.",
  },
  {
    id: "xiphos", name: "xiphos", edges: 2, tip: "long", length: [520, 600], width: [42, 50], bevel: [0.5, 0.65], hardness: [54, 57],
    profile: (x) => 0.8 + 0.3 * Math.sin(Math.PI * Math.pow(x, 1.7)),
    detail: { ridge: [0, 1] },
    about: "The Greek hoplite's sidearm, a leaf-shaped blade that swells towards the point.",
  },
  {
    id: "claymore", name: "claymore", edges: 2, tip: "acute", length: [1000, 1080], width: [50, 56], bevel: [0.5, 0.7], hardness: [52, 55],
    profile: (x) => 1 - 0.38 * x,
    detail: { fuller: { at: [0.42, 0.58], from: 0, to: 0.3 }, ridge: [0.3, 1] },
    about: "The Highland two-hander: a broad blade, and a guard whose arms slope towards it.",
  },
  {
    id: "rapier", name: "rapier", edges: 2, tip: "long", length: [960, 1040], width: [22, 26], bevel: [0.6, 0.8], hardness: [52, 55],
    profile: (x) => 1 - 0.5 * x,
    detail: { ridge: [0, 1] },
    about: "A long, slim thrusting sword for the street and the duel, behind a cup of steel.",
  },
  {
    id: "cinquedea", name: "cinquedea", edges: 2, tip: "acute", length: [420, 500], width: [80, 92], bevel: [0.3, 0.45], hardness: [53, 56],
    profile: (x) => 1 - 0.6 * x,
    detail: { grooves: { at: [0.34, 0.45, 0.55, 0.66], from: 0.03, to: 0.5 }, ridge: [0.5, 1] },
    about: "An Italian townsman's blade, five fingers wide at the guard and tapering like a wedge.",
  },
  {
    id: "kilij", name: "kilij", edges: 1, align: "edge", tip: "clip", length: [720, 800], width: [30, 34], bevel: [0.5, 0.62], hardness: [56, 59],
    curve: { amount: [-75, -58], power: 2.6 },
    profile: (x) => 1 - 0.12 * x + (x > 0.62 ? 0.3 * Math.sin(((x - 0.62) / 0.38) * 0.75 * Math.PI) : 0),
    detail: { fuller: { at: [0.1, 0.26], from: 0.03, to: 0.56 } },
    decor: [{ kind: "cartouche", name: "a gilt cartouche by the guard", in: [0.3, 0.56], from: 0.05, long: 0.07 }],
    about: "The Ottoman sabre: a deep curve, and a back that flares near the point for weight in the cut.",
  },
  {
    id: "kukri", name: "kukri", edges: 1, align: "spine", tip: "falcata", length: [400, 470], width: [42, 50], bevel: [0.4, 0.55], hardness: [55, 58],
    curve: { amount: [38, 52], power: 1.8 },
    profile: (x) => 0.72 + 0.5 * Math.sin(Math.PI * Math.pow(x, 1.4) * 0.88),
    detail: { grooves: { at: [0.1, 0.17], from: 0.05, to: 0.6 } },
    about: "The Gurkha's forward-curving knife, heavy towards the point like a hatchet.",
  },
];
export const bladeById = Object.fromEntries(BLADES.map((b) => [b.id, b]));

// Catmull-Rom through (xs, ys), evaluated at x.
function spline(xs, ys, x) {
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  const t = xs[i + 1] === xs[i] ? 0 : Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i])));
  const p0 = ys[Math.max(0, i - 1)], p1 = ys[i], p2 = ys[i + 1], p3 = ys[Math.min(ys.length - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// pointLength is how long a blade's point is for the last section's width.
export function pointLength(blade, lastWidth) {
  return TIP_STYLES[blade.tip].len * lastWidth;
}

// outline gives a blade's shape as top and bottom lines (arrays of [x, y]
// in mm, y down) and its overall length. widths and lengths are per section,
// tang to point; ref is the width the straight side lines up with, so
// different blades drawn with the same ref line up too. curve is mm at the
// point (0 for straight).
export function outline(blade, widths, lengths, { ref = Math.max(...widths), curve = 0, samples = 48 } = {}) {
  const n = widths.length;
  const xs = [0];
  const ws = [widths[0]];
  let x = 0;
  for (let i = 0; i < n; i++) {
    xs.push(x + lengths[i] / 2);
    ws.push(widths[i]);
    x += lengths[i];
  }
  xs.push(x);
  ws.push(widths[n - 1]);
  const body = x;
  const tip = TIP_STYLES[blade.tip];
  const pl = pointLength(blade, widths[n - 1]);
  const length = body + pl;
  const bend = bender(blade, curve, length);

  const sides = (w) => {
    if (blade.edges === 2 || blade.align === undefined) return [-w / 2, w / 2];
    if (blade.align === "edge") return [ref / 2 - w, ref / 2];
    return [-ref / 2, -ref / 2 + w];
  };

  const top = [];
  const bottom = [];
  for (let s = 0; s <= samples; s++) {
    const px = (body * s) / samples;
    const w = Math.max(0.5, spline(xs, ws, px));
    const [u, l] = sides(w);
    top.push([px, u + bend(px)]);
    bottom.push([px, l + bend(px)]);
  }

  // The point: two quadratic curves from the ends of the top and bottom
  // lines to the tip.
  const [u, l] = sides(widths[n - 1]);
  const py = u + tip.frac * (l - u);
  const steps = 12;
  const quad = (y0, [cx, cy]) => {
    const pts = [];
    const c = [body + cx * pl, y0 + cy * (py - y0)];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const qx = (1 - t) * (1 - t) * body + 2 * (1 - t) * t * c[0] + t * t * (body + pl);
      const qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * c[1] + t * t * py;
      pts.push([qx, qy + bend(qx)]);
    }
    return pts;
  };
  top.push(...quad(u, tip.up));
  bottom.push(...quad(l, tip.low));
  return { top, bottom, length };
}

// bender gives how far a blade with curve mm at the point (over length mm)
// is bent at x mm from the guard: 0 at the guard, curve at the point.
export function bender(blade, curve, length) {
  const power = blade.curve ? blade.curve.power : 2;
  return (x) => (curve ? curve * Math.pow(Math.max(0, x) / length, power) : 0);
}

// outlinePath turns an outline into an SVG path, scaling x by sx and y by
// sy and moving it by (dx, dy). bend(x) is added to y after scaling, so a
// straight outline drawn taller than life can still bend true to life.
export function outlinePath({ top, bottom }, { sx = 1, sy = 1, dx = 0, dy = 0, bend = () => 0 } = {}) {
  const pt = ([x, y]) => `${(x * sx + dx).toFixed(2)},${(y * sy + dy + bend(x)).toFixed(2)}`;
  const back = [...bottom].reverse().slice(1);
  return `M${top.map(pt).join("L")}L${back.map(pt).join("L")}Z`;
}
