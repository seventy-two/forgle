import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS, BELT, X0, X1, MM, PAST, EDGE, FLIP_TIME, DT,
  grindTime, geometry, newGrind, perfectGrind, edgeDown, underBelt, rates, grind, flip, thickness, heightFor, edgeState, edgeLeft, grindScore,
} from "../grind.js";
import { commission, dayKey, STOCK } from "../game.js";
import { bladeById } from "../blades.js";

const c = commission("2026-10-15");
const blade = bladeById[c.blade];
const cols = geometry(blade, c.widths, c.lengths, c.billet, c.stock);
const days = (n) => Array.from({ length: n }, (_, d) => dayKey(new Date(Date.UTC(2026, 9, 15 + d))));

test("every commission's strips run tang to point with an edge to grind", () => {
  for (const key of days(60)) {
    const k = commission(key);
    assert.ok(k.bevel > 0 && k.bevel < 1, key);
    for (const s of k.stock) assert.ok(s >= STOCK[0] && s <= STOCK[1], key);
    const g = geometry(bladeById[k.blade], k.widths, k.lengths, k.billet, k.stock);
    assert.equal(g.length, COLUMNS);
    for (let j = 1; j < COLUMNS; j++) assert.ok(g[j].x > g[j - 1].x, key);
    for (const col of g) {
      assert.ok(col.span > 0 && Number.isFinite(col.edge), key);
      assert.ok(col.stock >= STOCK[0] && col.stock <= STOCK[1], key);
    }
  }
});

test("only the strips over the belt grind, and only when the edge is pressed on it", () => {
  const x = 0.5;
  const g = grind(newGrind(c.bevel), cols, { x, p: 0.5, at: 0 }, 1);
  for (let j = 0; j < COLUMNS; j++) assert.equal(g.lines[0][j] > 0, underBelt(cols[j], x), `strip ${j}`);
  assert.ok(cols.filter((col) => underBelt(col, x)).length >= BELT * COLUMNS - 1);
  // Held clear of the belt, nothing.
  assert.equal(grind(newGrind(c.bevel), cols, { x, p: 0, at: 0 }, 5).lines[0].every((h) => h === 0), true);
  // Off the end of the blade, nothing.
  assert.equal(grind(newGrind(c.bevel), cols, { x: 1.2, p: 1, at: 0 }, 5).lines[0].every((h) => h === 0), true);
});

test("the belt takes the same thickness off every edge under it, on every sword, the point's too", () => {
  for (const key of days(12)) {
    const k = commission(key);
    const strips = geometry(bladeById[k.blade], k.widths, k.lengths, k.billet, k.stock);
    const g = grind(newGrind(k.bevel), strips, { x: X1, p: 1, at: 0 }, 0.3);
    assert.ok(underBelt(strips[COLUMNS - 1], X1), "the last strip is under the belt at the end of its run");
    for (let j = 0; j < COLUMNS; j++) {
      const off = strips[j].stock - thickness(strips[j], g.lines[0][j], k.bevel);
      if (underBelt(strips[j], X1)) assert.ok(Math.abs(off - MM * 0.3) < 0.03 * MM, `${key} strip ${j}: ${off}`);
      else assert.equal(off, 0, `${key} strip ${j}`);
    }
    assert.ok(underBelt(strips[0], X0), "and the first strip at the start of it");
  }
  // So a thick stretch of edge climbs more slowly.
  const rate = rates(cols, c.bevel);
  const thick = cols.reduce((a, col, j) => (col.stock > cols[a].stock ? j : a), 0);
  const thin = cols.reduce((a, col, j) => (col.stock < cols[a].stock ? j : a), 0);
  assert.ok(rate[thick] < rate[thin]);
});

test("leaning in harder grinds faster (with the square of the pressure), and slowly past the line", () => {
  const j = 20;
  const x = cols[j].x;
  const rate = rates(cols, c.bevel)[j];
  // A line at the spine, so the slower grinding past it doesn't come in.
  const at = (p) => grind(newGrind(1), cols, { x, p, at: 0 }, 0.2).lines[0][j];
  const full = rates(cols, 1)[j] * 0.2;
  assert.ok(Math.abs(at(1) - full) < 2 * rates(cols, 1)[j] * DT);
  assert.ok(Math.abs(at(0.5) - full / 4) < 0.01);
  assert.equal(at(2), at(1));
  // Past the commission's line it climbs at PAST of the speed.
  const g0 = { ...newGrind(c.bevel), lines: [Array(COLUMNS).fill(c.bevel), Array(COLUMNS).fill(0)] };
  const after = grind(g0, cols, { x, p: 1, at: 0 }, 0.2).lines[0][j];
  assert.ok(Math.abs(after - c.bevel - PAST * rate * 0.2) < 2 * rate * DT);
  // And never past the spine.
  assert.equal(grind(newGrind(c.bevel), cols, { x, p: 1, at: 0 }, 60).lines[0][j], 1);
});

test("splitting the time between events doesn't change the result", () => {
  const hold = { x: 0.3, p: 0.6, at: 0.013 };
  const once = grind(newGrind(c.bevel), cols, hold, 2.7);
  let many = newGrind(c.bevel);
  let t = hold.at;
  for (const step of [0.016, 0.0331, 0.5, 0.0001, 1.2, 0.017]) {
    many = grind(many, cols, { ...hold, at: t }, t + step);
    t += step;
  }
  many = grind(many, cols, { ...hold, at: t }, 2.7);
  for (let j = 0; j < COLUMNS; j++) assert.ok(Math.abs(once.lines[0][j] - many.lines[0][j]) < 1e-9);
});

test("turning it over grinds the other edge, after a moment", () => {
  const g = flip(newGrind(c.bevel), 1);
  assert.equal(g.down, 1);
  const hold = { x: 0.5, p: 1, at: 1 };
  assert.deepEqual(grind(g, cols, hold, 1 + FLIP_TIME - DT).lines, g.lines);
  const later = grind(g, cols, hold, 2);
  assert.ok(later.lines[1].some((h) => h > 0));
  assert.ok(later.lines[0].every((h) => h === 0));
  // The top edge, turned down, is mirrored: as far below 0 as the bottom
  // edge is span below the centre line.
  const col = cols[20];
  assert.equal(edgeDown(col, 1), 2 * col.span - col.edge);
});

test("the edge reaches 1 mm as the bevel reaches the line", () => {
  for (const col of cols) {
    assert.equal(thickness(col, 0, c.bevel), col.stock);
    assert.ok(Math.abs(thickness(col, c.bevel, c.bevel) - EDGE) < 1e-9);
    assert.ok(thickness(col, 1, c.bevel) < EDGE);
  }
});

test("the height for a thickness turns thickness round, and edges are judged by it", () => {
  for (const col of cols) {
    for (const t of [3, 1.3, 1, 0.6, 0.2, 0]) assert.ok(Math.abs(thickness(col, heightFor(col, t, c.bevel), c.bevel) - t) < 1e-9);
    assert.ok(heightFor(col, 0.4, c.bevel) > heightFor(col, EDGE, c.bevel));
  }
  assert.deepEqual([2, 1.4, 1, 0.6, 0.55, 0.4, 0.3].map(edgeState), ["thick", "ok", "ok", "ok", "over", "over", "thin"]);
});

test("a perfect grind scores 100, and mistakes cost", () => {
  for (const edges of [1, 2]) {
    const perfect = perfectGrind(c.bevel, edges);
    const s = grindScore(c, perfect, cols, edges);
    assert.equal(s.score, 100);
    assert.equal(s.thin, 0);
    for (let j = 0; j < COLUMNS; j++) assert.ok(Math.abs(edgeLeft(perfect, cols, j, edges) - EDGE) < 1e-9);
    assert.ok(grindScore(c, newGrind(c.bevel), cols, edges).score < 10);
    const high = { ...perfect, lines: [perfect.lines[0].map((h) => Math.min(1, h + 0.4)), perfect.lines[1]] };
    const hs = grindScore(c, high, cols, edges);
    assert.ok(hs.line < 100 && hs.edge < 100 && hs.thin > 0);
  }
  // A double-edged blade ground on one edge only is half done.
  const one = grindScore(c, perfectGrind(c.bevel, 1), cols, 2);
  assert.ok(one.score < 60);
});

test("two edges get more time than one", () => {
  assert.ok(grindTime(2) > grindTime(1));
});

test("a steady player sweeping along, leaning by what's left, grinds it in time", () => {
  // Falcata, longsword, katana and jian: one edge and two, straight and curved.
  for (const key of ["2026-10-16", "2026-10-17", "2026-10-23", "2026-10-26"]) {
    const k = commission(key);
    const b = bladeById[k.blade];
    const cs = geometry(b, k.widths, k.lengths, k.billet, k.stock);
    let g = newGrind(k.bevel);
    let t = 0, x = X0, vx = 0.6;
    const step = 1 / 60;
    for (let e = 0; e < b.edges; e++) {
      if (e) {
        g = flip(g, t);
        t += FLIP_TIME;
      }
      const left = (j) => thickness(cs[j], g.lines[g.down][j], k.bevel) - EDGE; // mm still to come off
      while (t < grindTime(b.edges) && cs.some((_, j) => left(j) > 0.25)) {
        // Lean hard while every strip under the belt has plenty to lose,
        // lightly while any still has some (unless one's ground well past),
        // and lift over stretches that are done.
        const under = cs.map((_, j) => j).filter((j) => underBelt(cs[j], x));
        const least = Math.min(...under.map(left)), most = Math.max(...under.map(left));
        const p = least > 1 ? 0.85 : most > 0.25 && least > -0.3 ? 0.35 : 0;
        g = grind(g, cs, { x, p, at: t }, t + step);
        t += step;
        x += vx * step;
        if (x > X1 || x < X0) vx = -vx;
      }
    }
    const s = grindScore(k, g, cs, b.edges);
    assert.ok(t < grindTime(b.edges), `${k.blade} took ${t}s`);
    assert.ok(s.score >= 80, `${k.blade} scored ${s.score} in ${t.toFixed(1)}s`);
    assert.equal(s.thin, 0, k.blade);
  }
});
