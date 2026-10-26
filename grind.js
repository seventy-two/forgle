// The grind stage's rules: a belt grinder that stays put, and a blade the
// player moves around it. Wherever the edge is pushed onto the belt, the
// bevel there climbs, faster the harder it's pushed; the edge thins with
// it, reaching 1 mm as the bevel reaches the commission's line.
// Double-edged blades are turned over to grind the other edge. Everything
// is pure and comes from event times: the time between two events is
// sampled on a fixed grid of absolute times, so it doesn't matter how often
// the page asks.

import { outline } from "./blades.js";

export const GRIND_TIME = 55; // seconds on the clock
export const COLUMNS = 40; // the blade is ground in this many strips, tang to point
export const BELT = 0.08; // how much of the blade's length the belt is wide
export const GIVE = 0.4; // how far the belt gives, as a share of the blade's widest span
export const RATE = 1.2; // share of the span the bevel climbs a second, pushed all the way in
export const EDGE = 1.0; // mm: the edge to leave before the quench
export const EDGE_OK = 0.3; // mm either side of it that's fine
export const THIN = 0.6; // mm: thinner than this and the edge may crack in the quench
export const FLIP_TIME = 0.6; // seconds to turn the blade over
export const DT = 0.005; // the sampling grid, in seconds

const clamp01 = (x) => Math.max(0, Math.min(1, x));

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

// newGrind is the blade as it comes off the anvil: lines[e][j] is how high
// edge e's bevel reaches over strip j, as a share of the span (edge 1 is
// the top edge of a double-edged blade), and down is the edge facing the
// belt.
export function newGrind(bevel) {
  return { bevel, down: 0, lines: [Array(COLUMNS).fill(0), Array(COLUMNS).fill(0)], flippedAt: -Infinity };
}

// perfectGrind is a blade ground exactly to the line.
export function perfectGrind(bevel, edges = 1) {
  const g = newGrind(bevel);
  const full = Array(COLUMNS).fill(bevel);
  return { ...g, lines: [full, edges === 2 ? [...full] : Array(COLUMNS).fill(0)] };
}

// edgeDown is where strip c's edge e is, y down, with that edge turned to
// face down: the bottom edge as it is, the top edge mirrored about y = 0.
export function edgeDown(c, e) {
  return e ? 2 * c.span - c.edge : c.edge;
}

// underBelt is whether strip c is under the belt with the belt's centre at
// x along the blade (a share of its length).
export const underBelt = (c, x) => Math.abs(c.x - x) <= BELT / 2;

// give is how far (mm) the edge can be pushed into the belt: it's a slack
// belt, so it gives, and nearby parts of a curved edge touch too, lighter.
export function give(cols) {
  return GIVE * Math.max(...cols.map((c) => c.span));
}

// lowest is how low the down edge reaches over the belt at x, or null if
// none of the blade is over it. The belt's top can't be more than give
// above it.
export function lowest(g, cols, x) {
  let y = null;
  for (const c of cols) if (underBelt(c, x)) y = Math.max(y ?? -Infinity, edgeDown(c, g.down));
  return y;
}

// grind runs the grinder from the hold's time (at) to t1, with the belt's
// centre x along the blade (a share of its length) and its top at y (mm,
// in the down edge's frame), and returns the new state. Every strip over
// the belt whose edge is pushed past its top climbs at RATE times how far
// it's pushed in (out of give), squared: a light touch grinds slowly, for
// easing up to the line.
export function grind(g, cols, hold, t1) {
  const from = Math.max(hold.at, g.flippedAt + FLIP_TIME);
  if (t1 <= from) return g;
  const pen0 = give(cols);
  const line = [...g.lines[g.down]];
  let changed = false;
  for (let k = Math.floor(from / DT) + 1; k * DT <= t1; k++) {
    for (let j = 0; j < COLUMNS; j++) {
      const c = cols[j];
      if (!underBelt(c, hold.x)) continue;
      const pen = Math.min(pen0, edgeDown(c, g.down) - hold.y);
      if (pen <= 0) continue;
      line[j] = Math.min(1, line[j] + RATE * (pen / pen0) ** 2 * DT);
      changed = true;
    }
  }
  if (!changed) return g;
  const lines = [...g.lines];
  lines[g.down] = line;
  return { ...g, lines };
}

export function flip(g, t) {
  return { ...g, down: 1 - g.down, flippedAt: t };
}

// thickness is how thick strip c's edge is with its bevel at line: it
// thins from the stock to EDGE as the bevel climbs to the commission's
// line (bevel), and on past it.
export function thickness(c, line, bevel) {
  return Math.max(0, c.stock - ((c.stock - EDGE) * line) / bevel);
}

// heightFor is how high strip c's bevel is when its edge is t mm thick:
// thickness turned round.
export function heightFor(c, t, bevel) {
  return (bevel * (c.stock - t)) / (c.stock - EDGE);
}

// edgeState says how an edge t mm thick is doing: still thick, ok (within
// EDGE ± EDGE_OK), over (thinner than that) or thin (enough to crack).
export function edgeState(t) {
  if (t > EDGE + EDGE_OK) return "thick";
  if (t >= EDGE - EDGE_OK) return "ok";
  return t >= THIN ? "over" : "thin";
}

// edgeLeft is how thick strip j's edge is now; a double-edged blade gives
// its thinner edge.
export function edgeLeft(g, cols, j, edges = 1) {
  const at = (e) => thickness(cols[j], g.lines[e][j], g.bevel);
  return edges === 2 ? Math.min(at(0), at(1)) : at(0);
}

// grindScore is 0–100: 60% for how closely the bevels follow the line
// (every 1% of the span off on average costs 8.3 points of it; each strip
// counts by its span, so the point, where the height of a line means
// little, counts little) and 40% for the edge (every 0.1 mm outside
// EDGE ± EDGE_OK on average costs 12.5 points of it). It also counts the
// strips thin enough to crack in the quench. Both faces are ground alike,
// so they're never uneven.
export function grindScore(c, g, cols, edges = 1) {
  let lineErr = 0, edgeErr = 0, thin = 0, spans = 0;
  for (let j = 0; j < COLUMNS; j++) {
    const w = cols[j].span;
    for (let e = 0; e < edges; e++) {
      lineErr += w * Math.abs(g.lines[e][j] - c.bevel);
      spans += w;
      edgeErr += Math.max(0, Math.abs(thickness(cols[j], g.lines[e][j], c.bevel) - EDGE) - EDGE_OK) / edges;
    }
    if (edgeLeft(g, cols, j, edges) < THIN) thin++;
  }
  lineErr /= spans;
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
    uneven: 0,
  };
}
