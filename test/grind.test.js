import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRIND_TIME, COLUMNS, BELT, RATE, EDGE, FLIP_TIME, DT,
  geometry, give, newGrind, perfectGrind, edgeDown, underBelt, lowest, grind, flip, thickness, heightFor, edgeState, edgeLeft, grindScore,
} from "../grind.js";
import { commission, dayKey, STOCK } from "../game.js";
import { bladeById } from "../blades.js";

const c = commission("2026-10-15");
const blade = bladeById[c.blade];
const cols = geometry(blade, c.widths, c.lengths, c.billet, c.stock);
const PEN = give(cols);
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

test("only the strips over the belt with their edge pushed onto it grind", () => {
  const x = 0.5;
  const low = lowest(newGrind(c.bevel), cols, x);
  const g = grind(newGrind(c.bevel), cols, { x, y: low - PEN / 2, at: 0 }, 1);
  for (let j = 0; j < COLUMNS; j++) {
    const touching = underBelt(cols[j], x) && edgeDown(cols[j], 0) > low - PEN / 2;
    assert.equal(g.lines[0][j] > 0, touching, `strip ${j}`);
  }
  assert.ok(cols.filter((col) => underBelt(col, x)).length >= BELT * COLUMNS - 1);
  // Held clear of the belt, nothing.
  assert.equal(grind(newGrind(c.bevel), cols, { x, y: low + 1, at: 0 }, 5).lines[0].every((h) => h === 0), true);
  // Off the end of the blade, nothing.
  assert.equal(lowest(newGrind(c.bevel), cols, 1.2), null);
});

test("pushing harder grinds faster, up to as far as the belt gives", () => {
  const j = 20;
  const x = cols[j].x;
  const at = (pen) => grind(newGrind(c.bevel), cols, { x, y: cols[j].edge - pen, at: 0 }, 0.5).lines[0][j];
  assert.ok(Math.abs(at(PEN) - RATE * 0.5) < 2 * RATE * DT);
  assert.ok(Math.abs(at(PEN / 2) - (RATE * 0.5) / 2) < 2 * RATE * DT);
  assert.equal(at(2 * PEN), at(PEN));
  // And never past the spine.
  assert.equal(grind(newGrind(c.bevel), cols, { x, y: cols[j].edge - PEN, at: 0 }, 60).lines[0][j], 1);
});

test("splitting the time between events doesn't change the result", () => {
  const hold = { x: 0.3, y: lowest(newGrind(c.bevel), cols, 0.3) - 1, at: 0.013 };
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
  const two = cols.map((col) => ({ ...col }));
  const g = flip(newGrind(c.bevel), 1);
  assert.equal(g.down, 1);
  const x = 0.5;
  const y = lowest(g, two, x) - PEN;
  assert.deepEqual(grind(g, two, { x, y, at: 1 }, 1 + FLIP_TIME - DT).lines, g.lines);
  const later = grind(g, two, { x, y, at: 1 }, 2);
  assert.ok(later.lines[1].some((h) => h > 0));
  assert.ok(later.lines[0].every((h) => h === 0));
  // The top edge, turned down, is mirrored: as far below 0 as the bottom
  // edge is span below the centre line.
  const col = two[20];
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
    for (const t of [3, 1.3, 1, 0.6, 0.2]) assert.ok(Math.abs(thickness(col, heightFor(col, t, c.bevel), c.bevel) - t) < 1e-9);
    assert.ok(heightFor(col, 0.6, c.bevel) > heightFor(col, EDGE, c.bevel));
  }
  assert.deepEqual([2, 1.3, 1, 0.7, 0.65, 0.6, 0.3].map(edgeState), ["thick", "ok", "ok", "ok", "over", "over", "thin"]);
});

test("a perfect grind scores 100, and mistakes cost", () => {
  for (const edges of [1, 2]) {
    const perfect = perfectGrind(c.bevel, edges);
    const s = grindScore(c, perfect, cols, edges);
    assert.equal(s.score, 100);
    assert.equal(s.thin, 0);
    for (let j = 0; j < COLUMNS; j++) assert.ok(Math.abs(edgeLeft(perfect, cols, j, edges) - EDGE) < 1e-9);
    assert.ok(grindScore(c, newGrind(c.bevel), cols, edges).score < 10);
    const high = { ...perfect, lines: [perfect.lines[0].map((h) => Math.min(1, h + 0.15)), perfect.lines[1]] };
    const hs = grindScore(c, high, cols, edges);
    assert.ok(hs.line < 100 && hs.edge < 100 && hs.thin > 0);
  }
  // A double-edged blade ground on one edge only is half done.
  const one = grindScore(c, perfectGrind(c.bevel, 1), cols, 2);
  assert.ok(one.score < 60);
});

test("a steady player sweeping along, lifting where it's done, grinds it in time", () => {
  // Falcata, longsword, katana and jian: one edge and two, straight and curved.
  for (const key of ["2026-10-16", "2026-10-17", "2026-10-23", "2026-10-26"]) {
    const k = commission(key);
    const b = bladeById[k.blade];
    const cs = geometry(b, k.widths, k.lengths, k.billet, k.stock);
    const most = give(cs);
    let g = newGrind(k.bevel);
    let t = 0, x = -0.06, vx = 0.6;
    const step = 1 / 60;
    for (let e = 0; e < b.edges; e++) {
      if (e) {
        g = flip(g, t);
        t += FLIP_TIME;
      }
      const need = (j) => g.lines[g.down][j] < k.bevel - 0.03;
      while (t < GRIND_TIME && cs.some((_, j) => j < COLUMNS - 3 && need(j))) {
        // Push halfway in over the strips still to do, as far as the belt gives.
        const under = cs.filter((col, j) => underBelt(col, x) && need(j));
        let y = under.length ? Math.max(...under.map((col) => edgeDown(col, g.down))) - most / 2 : Infinity;
        const low = lowest(g, cs, x);
        if (low !== null) y = Math.max(y, low - most);
        g = grind(g, cs, { x, y, at: t }, t + step);
        t += step;
        x += vx * step;
        if (x > 1.06 || x < -0.06) vx = -vx;
      }
    }
    const s = grindScore(k, g, cs, b.edges);
    assert.ok(t < GRIND_TIME, `${k.blade} took ${t}s`);
    assert.ok(s.score >= 80, `${k.blade} scored ${s.score}`);
  }
});
