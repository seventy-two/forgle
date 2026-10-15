// The grind stage's rules: tracing the bevel line on the belt and thinning
// the edge. The belt runs back and forth along the blade by itself; the
// player holds the blade to it at a height. Everything is pure and comes
// from event times: the time between two events is sampled on a fixed grid
// of absolute times, so it doesn't matter how often the page asks.

import { outline } from "./blades.js";

export const GRIND_TIME = 40; // seconds on the clock for both sides
export const COLUMNS = 40; // the blade is ground in this many strips, tang to point
export const SWEEP = 2.2; // seconds for the belt to run from one end of the blade to the other
export const BELT = 0.08; // how much of the blade's length the belt covers at once
export const RATE = 2.4; // mm of edge ground away per second under the belt, per side
export const EDGE = 1.0; // mm: the edge to leave before the quench
export const EDGE_OK = 0.3; // mm either side of it that's fine
export const SIDE_OK = EDGE_OK / 2; // and for each side's share
export const THIN = 0.6; // mm: thinner than this and the edge may crack in the quench
export const FLIP_TIME = 0.8; // seconds to turn the blade over
export const DT = 0.005; // the sampling grid, in seconds

export const OVERRUN = 0.02; // the belt runs this far past each end, so the ends get ground about as much as the middle

// beltAt is where the belt's centre is along the blade at time t, as a share
// of the blade's length.
export function beltAt(t) {
  const phase = (((t / (2 * SWEEP)) % 1) + 1) % 1;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return -OVERRUN + (1 + 2 * OVERRUN) * tri;
}

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

export function newGrind() {
  return {
    side: 0,
    lines: [Array(COLUMNS).fill(0), Array(COLUMNS).fill(0)], // how high each side's grind reaches, as a share of the span
    depth: [Array(COLUMNS).fill(0), Array(COLUMNS).fill(0)], // mm ground off each side's edge
    flippedAt: -Infinity,
  };
}

// sideLeft is how much is still to grind off one side of strip j: each
// side takes half of what has to come off, so the two stay even.
export function sideLeft(g, cols, j, side) {
  return (cols[j].stock - EDGE) / 2 - g.depth[side][j];
}

// edgeLeft is how thick strip j's edge is now.
export function edgeLeft(g, cols, j) {
  return Math.max(0, cols[j].stock - g.depth[0][j] - g.depth[1][j]);
}

// heightAt is where the hold is at time s, for a hold at y at time t0
// moving at vy mm a second (the arrow keys), kept within [lo, hi].
export function heightAt(y, vy, t0, s, lo = -Infinity, hi = Infinity) {
  return Math.max(lo, Math.min(hi, y + vy * (s - t0)));
}

// grind holds the blade to the belt from t0 to t1 with its edge y (mm, in
// the blade's own coordinates; null for not pressing), moving at vy mm a
// second within [lo, hi], and returns the new state. Strips under the belt
// with the hold above their edge are ground up to it, and their edge thinned.
export function grind(g, cols, t0, t1, y, vy = 0, lo = -Infinity, hi = Infinity) {
  if (y === null || y === undefined || t1 <= t0) return g;
  const side = g.side;
  const line = [...g.lines[side]];
  const depth = [...g.depth[side]];
  const other = g.depth[1 - side];
  const from = Math.max(t0, g.flippedAt + FLIP_TIME);
  for (let k = Math.floor(from / DT) + 1; k * DT <= t1; k++) {
    const u = beltAt(k * DT);
    const ys = heightAt(y, vy, t0, k * DT, lo, hi);
    for (let j = 0; j < COLUMNS; j++) {
      const c = cols[j];
      if (Math.abs(c.x - u) > BELT / 2) continue;
      const h = (c.edge - ys) / c.span;
      if (h <= 0) continue; // held below the edge: not touching
      line[j] = Math.max(line[j], Math.min(1, h));
      depth[j] = Math.min(c.stock - other[j], depth[j] + RATE * DT);
    }
  }
  const lines = [...g.lines];
  const depths = [...g.depth];
  lines[side] = line;
  depths[side] = depth;
  return { ...g, lines, depth: depths };
}

export function flip(g, t) {
  return { ...g, side: 1 - g.side, flippedAt: t };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// grindScore is 0–100: 60% for how closely both sides' lines follow the
// bevel (every 1% of the span off on average costs 8.3 points of it; each
// strip counts by its span, so the point, where the height of a line means
// little, counts little) and
// 40% for the edge (every 0.1 mm outside EDGE ± EDGE_OK on average costs
// 12.5 points of it). It also counts the strips thin enough to crack and
// how unevenly the two sides were ground, for the quench.
export function grindScore(c, g, cols) {
  let lineErr = 0, edgeErr = 0, thin = 0, uneven = 0, spans = 0;
  for (let j = 0; j < COLUMNS; j++) {
    const w = cols[j].span;
    lineErr += w * (Math.abs(g.lines[0][j] - c.bevel) + Math.abs(g.lines[1][j] - c.bevel));
    spans += w;
    const e = edgeLeft(g, cols, j);
    edgeErr += Math.max(0, Math.abs(e - EDGE) - EDGE_OK);
    if (e < THIN) thin++;
    uneven += Math.abs(g.depth[0][j] - g.depth[1][j]);
  }
  lineErr /= 2 * spans;
  edgeErr /= COLUMNS;
  const line = 100 * clamp01(1 - lineErr / 0.12);
  const edge = 100 * clamp01(1 - edgeErr / 0.8);
  return {
    score: Math.round(0.6 * line + 0.4 * edge),
    line: Math.round(line),
    edge: Math.round(edge),
    lineErr,
    edgeErr,
    thin,
    uneven: uneven / COLUMNS,
  };
}
