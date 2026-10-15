import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS, SWEEP, BELT, OVERRUN, RATE, EDGE, FLIP_TIME, DT,
  beltAt, heightAt, geometry, newGrind, sideLeft, edgeLeft, grind, flip, grindScore,
} from "../grind.js";
import { commission, dayKey, STOCK } from "../game.js";
import { bladeById } from "../blades.js";

const c = commission("2026-10-15");
const blade = bladeById[c.blade];
const cols = geometry(blade, c.widths, c.lengths, c.billet, c.stock);
const days = (n) => Array.from({ length: n }, (_, d) => dayKey(new Date(Date.UTC(2026, 9, 15 + d))));

test("the belt runs end to end and back", () => {
  assert.ok(Math.abs(beltAt(0) + OVERRUN) < 1e-9);
  assert.ok(Math.abs(beltAt(SWEEP) - (1 + OVERRUN)) < 1e-9);
  assert.ok(Math.abs(beltAt(2 * SWEEP) + OVERRUN) < 1e-9);
  assert.ok(Math.abs(beltAt(SWEEP / 2) - 0.5) < 1e-9);
});

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

// hold grinds strip j's height h on the current side for a whole sweep there and back.
const holdAt = (g, j, h) => grind(g, cols, 0, 2 * SWEEP, cols[j].edge - h * cols[j].span);

test("grinding raises the line to the held height, and only up", () => {
  let g = holdAt(newGrind(), 10, 0.4);
  assert.ok(Math.abs(g.lines[0][10] - 0.4) < 0.05);
  g = holdAt(g, 10, 0.2);
  assert.ok(g.lines[0][10] >= 0.39, "a lower pass doesn't lower the line");
  assert.deepEqual(g.lines[1], Array(COLUMNS).fill(0), "the other side's untouched");
});

test("held below the edge, or not at all, grinds nothing", () => {
  const g = newGrind();
  assert.equal(grind(g, cols, 0, 5, null), g);
  const below = grind(g, cols, 0, 5, Math.max(...cols.map((col) => col.edge)) + 1);
  assert.deepEqual(below.depth[0], Array(COLUMNS).fill(0));
});

test("a strip thins at RATE while it's under the belt, never below nothing", () => {
  const g = holdAt(newGrind(), 20, 0.3);
  const t = g.depth[0][20] / RATE;
  // The belt covers a strip for about BELT of each traverse's time.
  assert.ok(t > BELT * SWEEP && t < 3 * BELT * SWEEP, `under the belt for ${t}s`);
  let long = grind(newGrind(), cols, 0, 120, cols[20].edge - 0.3 * cols[20].span);
  long = grind(flip(long, 120), cols, 120, 240, cols[20].edge - 0.3 * cols[20].span);
  for (let j = 0; j < COLUMNS; j++) assert.ok(edgeLeft(long, cols, j) >= 0);
  assert.equal(edgeLeft(long, cols, 20), 0);
});

test("splitting the time between events doesn't change the result", () => {
  const y = cols[15].edge - 0.35 * cols[15].span;
  const once = grind(newGrind(), cols, 0.013, 3.7, y);
  let many = newGrind();
  let t = 0.013;
  for (const step of [0.016, 0.0331, 0.5, 0.0001, 1.2, 0.017]) {
    many = grind(many, cols, t, t + step, y);
    t += step;
  }
  many = grind(many, cols, t, 3.7, y);
  assert.deepEqual(many, once);
});

test("flipping grinds the other side, after a moment to turn it over", () => {
  const y = cols[15].edge - 0.35 * cols[15].span;
  const g = flip(newGrind(), 1);
  assert.equal(g.side, 1);
  const early = grind(g, cols, 1, 1 + FLIP_TIME - DT, y);
  assert.deepEqual(early.depth[1], Array(COLUMNS).fill(0));
  const later = grind(g, cols, 1, 1 + 2 * SWEEP, y);
  assert.ok(later.depth[1][15] > 0);
  assert.deepEqual(later.depth[0], Array(COLUMNS).fill(0));
});

test("a perfect grind scores 100, and mistakes cost", () => {
  const perfect = {
    side: 1,
    lines: [Array(COLUMNS).fill(c.bevel), Array(COLUMNS).fill(c.bevel)],
    depth: [cols.map((col) => (col.stock - EDGE) / 2), cols.map((col) => (col.stock - EDGE) / 2)],
  };
  const s = grindScore(c, perfect, cols);
  assert.equal(s.score, 100);
  assert.equal(s.thin, 0);
  assert.ok(s.uneven < 1e-9);
  assert.ok(grindScore(c, newGrind(), cols).score < 10);
  const high = { ...perfect, lines: [Array(COLUMNS).fill(c.bevel + 0.05), perfect.lines[1]] };
  assert.ok(grindScore(c, high, cols).line < 100);
  const thin = { ...perfect, depth: [cols.map((col) => col.stock / 2), cols.map((col) => col.stock / 2)] };
  const ts = grindScore(c, thin, cols);
  assert.equal(ts.thin, COLUMNS);
  assert.ok(ts.edge < 100);
  const lopsided = { ...perfect, depth: [cols.map((col) => col.stock - EDGE), Array(COLUMNS).fill(0)] };
  assert.ok(grindScore(c, lopsided, cols).uneven > 1);
});

test("a hold moving on the arrow keys is the same however the time is split, and stays in bounds", () => {
  const y = cols[15].edge - 0.2 * cols[15].span;
  const lo = y - 6, hi = y + 2;
  assert.equal(heightAt(y, -2, 0, 100, lo, hi), lo);
  assert.equal(heightAt(y, 5, 0, 100, lo, hi), hi);
  const once = grind(newGrind(), cols, 0.02, 3.1, y, -1.5, lo, hi);
  let many = newGrind();
  let t = 0.02, at = y;
  for (const step of [0.4, 0.013, 1.1, 0.25]) {
    many = grind(many, cols, t, t + step, at, -1.5, lo, hi);
    at = heightAt(at, -1.5, t, t + step, lo, hi);
    t += step;
  }
  many = grind(many, cols, t, 3.1, at, -1.5, lo, hi);
  // Equal but for floating-point rounding in the height.
  for (const k of ["lines", "depth"]) {
    for (let side = 0; side < 2; side++) {
      once[k][side].forEach((v, j) => assert.ok(Math.abs(v - many[k][side][j]) < 1e-9, `${k} ${side} ${j}`));
    }
  }
  // Moving up grinds higher than holding still.
  const still = grind(newGrind(), cols, 0.02, 3.1, y);
  assert.ok(Math.max(...once.lines[0]) > Math.max(...still.lines[0]));
});

test("each side's target is half of what has to come off, so two done sides leave the edge", () => {
  const g = newGrind();
  for (let j = 0; j < COLUMNS; j++) {
    assert.ok(Math.abs(sideLeft(g, cols, j, 0) * 2 - (cols[j].stock - EDGE)) < 1e-9);
    g.depth[0][j] = g.depth[1][j] = (cols[j].stock - EDGE) / 2;
    assert.ok(Math.abs(sideLeft(g, cols, j, 0)) < 1e-9 && Math.abs(sideLeft(g, cols, j, 1)) < 1e-9);
    assert.ok(Math.abs(edgeLeft(g, cols, j) - EDGE) < 1e-9);
  }
});
