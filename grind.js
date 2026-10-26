// The grind stage's rules: grinding the bevels on a belt grinder. The belt
// stays put; the player draws the blade across it, pressed to the belt and
// aimed at a height: the blade is tilted so that the belt's flat face, cut
// in until the edge is 1 mm, meets the side of the blade at that height.
// So the bevel climbs towards the aim as the edge thins, and reaches it as
// the edge is done; keep grinding and both go too far. Steel under the belt
// heats, thin steel fastest, and cools in the air or in the bucket.
// Everything is pure and comes from event times: the time between two
// events is sampled on a fixed grid of absolute times, so it doesn't
// matter how often the page asks.

import { outline } from "./blades.js";

export const GRIND_TIME = 45; // seconds on the clock for both sides
export const COLUMNS = 40; // the blade is ground in this many strips, tang to point
export const LEVELS = 25; // each strip's face is followed at this many heights, edge to spine
export const BELT = 0.08; // how much of the blade's length the belt covers at once
export const OVERRUN = 0.04; // how far the blade can be drawn past either end of the belt
export const RATE = 2.6; // mm a second the belt cuts into steel pressed to it
export const EDGE = 1.0; // mm: the edge to leave before the quench
export const EDGE_OK = 0.3; // mm either side of it that's fine
export const SIDE_OK = EDGE_OK / 2; // and for each side's share
export const THIN = 0.6; // mm: thinner than this and the edge may crack in the quench
export const FLIP_TIME = 0.8; // seconds to turn the blade over
export const DUNK_TIME = 1.0; // seconds to cool it in the bucket
export const HEAT = 0.8; // how fast steel under the belt heats, per second, for a 1 mm edge
export const COOL = 3; // seconds for steel off the belt to lose most of its heat (time constant)
export const BLUE = 1; // heat at which the edge blues: about 300°C
export const DT = 0.005; // the sampling grid, in seconds

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clamp01 = (x) => clamp(x, 0, 1);

// geometry describes each strip of a forged blade: where it is along the
// blade (x, a share of the length), where its edge is (edge, mm, y down)
// and how far it is from the edge to the spine, or to the centre line on a
// double-edged blade (span, mm), plus the edge's thickness off the anvil
// (stock, mm, from the commission's per-section values).
export function geometry(blade, widths, lengths, ref, stock) {
  const { top, bottom, length } = outline(blade, widths, lengths, { ref });
  const at = (line, x) => {
    let i = 1;
    while (i < line.length - 1 && line[i][0] < x) i++;
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
  const body = lengths.reduce((a, b) => a + b, 0);
  const n = stock.length;
  const cols = [];
  for (let j = 0; j < COLUMNS; j++) {
    const x = ((j + 0.5) / COLUMNS) * length;
    const u = at(top, x), l = at(bottom, x);
    const span = Math.max(0.1, blade.edges === 2 ? (l - u) / 2 : l - u);
    // Stock between section centres, the point taking the last section's.
    const s = Math.min(n - 1, Math.max(0, (Math.min(x, body) / body) * n - 0.5));
    const k = Math.floor(s);
    const thick = k >= n - 1 ? stock[n - 1] : stock[k] + (stock[k + 1] - stock[k]) * (s - k);
    cols.push({ x: x / length, mm: x, edge: l, span, stock: thick });
  }
  return cols;
}

// newGrind is the blade as it comes off the anvil. faces[side][j][k] is how
// much steel (mm) has been ground off that side of strip j at height k (0
// at the edge, LEVELS - 1 at the spine); lines is how high each side's
// bevel reaches, as a share of the span; heat is each strip's heat (BLUE
// is too hot) and peak the most it has had, which its colour keeps.
export function newGrind() {
  const faces = () => Array.from({ length: COLUMNS }, () => Array(LEVELS).fill(0));
  return {
    side: 0,
    faces: [faces(), faces()],
    lines: [Array(COLUMNS).fill(0), Array(COLUMNS).fill(0)],
    heat: Array(COLUMNS).fill(0),
    peak: Array(COLUMNS).fill(0),
    flippedAt: -Infinity,
    dunkedAt: -Infinity,
  };
}

// perfectGrind is a blade ground exactly: both sides cut in one flat bevel
// from a 1 mm edge to the commission's line, never too hot.
export function perfectGrind(cols, bevel) {
  const g = newGrind();
  for (let j = 0; j < COLUMNS; j++) {
    const c = cols[j];
    const d = (c.stock - EDGE) / 2;
    const face = Array.from({ length: LEVELS }, (_, k) => Math.max(0, d * (1 - k / (LEVELS - 1) / bevel)));
    g.faces[0][j] = face;
    g.faces[1][j] = [...face];
    g.lines[0][j] = g.lines[1][j] = bevel;
  }
  return { ...g, side: 1 };
}

// depth is how much has been ground off one side of strip j's edge.
export function depth(g, j, side) {
  return g.faces[side][j][0];
}

// sideLeft is how much is still to grind off one side of strip j's edge:
// each side takes half of what has to come off, so the two stay even.
export function sideLeft(g, cols, j, side) {
  return (cols[j].stock - EDGE) / 2 - depth(g, j, side);
}

// edgeLeft is how thick strip j's edge is now.
export function edgeLeft(g, cols, j) {
  return Math.max(0, cols[j].stock - depth(g, j, 0) - depth(g, j, 1));
}

// slope is the tangent of the tilt (from the face) that aims strip col's
// bevel at height h (a share of the span): cut in until the edge is 1 mm,
// the belt's face leaves the side of the blade there.
export function slope(col, h) {
  return (col.stock - EDGE) / 2 / (h * col.span);
}

// touch is where the belt, tilted t (the tangent of the tilt), first meets
// a face: the plane's depth at the edge, a, for the plane that cuts
// a - y·t at height y. A fresh face is met at the edge; a face already
// ground steeper is met at its shoulder.
export function touch(face, span, t) {
  let a = Infinity;
  for (let k = 0; k < LEVELS; k++) a = Math.min(a, face[k] + (k / (LEVELS - 1)) * span * t);
  return a;
}

// The hold: whether the blade is pressed to the belt (down), where the
// belt's centre is along it (x, a share of the length) and the height it's
// aimed at (y, mm in the blade's own coordinates, y down, like the
// strips' edges), each moving at vx and vy a second (the keys), y within
// [lo, hi].
export const X_RANGE = [-OVERRUN, 1 + OVERRUN];

export function holdAt(hold, s) {
  const dt = s - hold.at;
  return {
    ...hold,
    x: clamp(hold.x + (hold.vx || 0) * dt, X_RANGE[0], X_RANGE[1]),
    y: clamp(hold.y + (hold.vy || 0) * dt, hold.lo ?? -Infinity, hold.hi ?? Infinity),
    at: s,
  };
}

// grind runs the grinder from the hold's time to t1 and returns the new
// state. Strips under the belt while it's pressed (not while turning it
// over or dunking it), aimed above their edge, are cut to the belt's plane
// and heat; every strip cools.
export function grind(g, cols, hold, t1) {
  const t0 = hold.at;
  if (t1 <= t0) return g;
  const faces = [g.faces[0], g.faces[1]].map((f) => [...f]);
  const lines = [[...g.lines[0]], [...g.lines[1]]];
  const heat = [...g.heat];
  const peak = [...g.peak];
  const side = g.side;
  const busy = Math.max(g.flippedAt + FLIP_TIME, g.dunkedAt + DUNK_TIME);
  const decay = Math.exp(-DT / COOL);
  const copied = new Set();
  for (let k = Math.floor(t0 / DT) + 1; k * DT <= t1; k++) {
    const s = k * DT;
    for (let j = 0; j < COLUMNS; j++) heat[j] *= decay;
    if (!hold.down || s < busy) continue;
    const { x, y } = holdAt(hold, s);
    for (let j = 0; j < COLUMNS; j++) {
      const c = cols[j];
      if (Math.abs(c.x - x) > BELT / 2) continue;
      const h = (c.edge - y) / c.span;
      if (h <= 0) continue; // aimed below the edge: not touching
      const t = slope(c, Math.min(1, h));
      if (!copied.has(j)) {
        faces[side][j] = [...faces[side][j]];
        copied.add(j);
      }
      const face = faces[side][j];
      const other = faces[1 - side][j];
      const a = touch(face, c.span, t) + RATE * DT;
      for (let i = 0; i < LEVELS; i++) {
        const cut = Math.min(a - (i / (LEVELS - 1)) * c.span * t, c.stock - other[i]);
        if (cut > face[i]) face[i] = cut;
      }
      lines[side][j] = Math.max(lines[side][j], Math.min(1, a / t / c.span));
      const thick = Math.max(0.3, c.stock - face[0] - other[0]);
      heat[j] += (HEAT * DT) / thick;
      peak[j] = Math.max(peak[j], heat[j]);
    }
  }
  return { ...g, faces, lines, heat, peak };
}

export function flip(g, t) {
  return { ...g, side: 1 - g.side, flippedAt: t };
}

// dunk cools the blade in the bucket. Its colour stays.
export function dunk(g, t) {
  return { ...g, heat: Array(COLUMNS).fill(0), dunkedAt: t };
}

// grindScore is 0–100: 60% for how closely both sides' lines follow the
// bevel (every 1% of the span off on average costs 8.3 points of it; each
// strip counts by its span, so the point, where the height of a line means
// little, counts little) and 40% for the edge (every 0.1 mm outside
// EDGE ± EDGE_OK on average costs 12.5 points of it, and each blued strip a
// share). It also counts the strips thin or hot enough to crack and how
// unevenly the two sides were ground, for the quench.
export function grindScore(c, g, cols) {
  let lineErr = 0, edgeErr = 0, thin = 0, blued = 0, uneven = 0, spans = 0;
  for (let j = 0; j < COLUMNS; j++) {
    const w = cols[j].span;
    lineErr += w * (Math.abs(g.lines[0][j] - c.bevel) + Math.abs(g.lines[1][j] - c.bevel));
    spans += w;
    const e = edgeLeft(g, cols, j);
    edgeErr += Math.max(0, Math.abs(e - EDGE) - EDGE_OK);
    if (e < THIN) thin++;
    if (g.peak[j] >= BLUE) blued++;
    uneven += Math.abs(depth(g, j, 0) - depth(g, j, 1));
  }
  lineErr /= 2 * spans;
  edgeErr /= COLUMNS;
  const line = 100 * clamp01(1 - lineErr / 0.12);
  const edge = 100 * clamp01(1 - edgeErr / 0.8 - blued / COLUMNS);
  return {
    score: Math.round(0.6 * line + 0.4 * edge),
    line: Math.round(line),
    edge: Math.round(edge),
    lineErr,
    edgeErr,
    thin,
    blued,
    uneven: uneven / COLUMNS,
  };
}
